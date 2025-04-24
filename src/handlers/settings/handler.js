import { EmbedBuilder } from "discord.js";
import { db } from "../../utils/database.js";

const settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getSettings(guildId) {
  const cacheKey = `settings_${guildId}`;
  const cachedSettings = settingsCache.get(cacheKey);

  if (cachedSettings && cachedSettings.timestamp > Date.now() - CACHE_TTL) {
    return cachedSettings.data;
  }

  const settings = await db.getGuildSettings(guildId);
  settingsCache.set(cacheKey, {
    data: settings,
    timestamp: Date.now(),
  });

  return settings;
}

function invalidateCache(guildId) {
  const cacheKey = `settings_${guildId}`;
  settingsCache.delete(cacheKey);
}

async function handleSetSetting(interaction, type, name, value) {
  try {
    const guildSettings = await getSettings(interaction.guildId);
    let updateData = { ...guildSettings };
    let updatedValue;

    switch (type) {
      case "channel": {
        if (!updateData.channel_ids) updateData.channel_ids = {};
        updateData.channel_ids[name] = value;
        updatedValue = value;
        break;
      }
      case "role": {
        if (!updateData.role_ids) updateData.role_ids = {};
        if (name === "additional_verified") {
          updateData.role_ids[name] = value.split(",").map((id) => id.trim());
        } else {
          updateData.role_ids[name] = value;
        }
        updatedValue = value;
        break;
      }
      case "api": {
        if (!updateData.api_keys) updateData.api_keys = {};
        updateData.api_keys[name] = value;
        updatedValue = value;
        break;
      }
      case "link": {
        if (!updateData.external_links) updateData.external_links = {};
        updateData.external_links[name] = value;
        updatedValue = value;
        break;
      }
      default:
        await interaction.reply({
          content:
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          flags: 64,
        });
        return;
    }

    await db.updateGuildSettings(interaction.guildId, updateData);
    invalidateCache(interaction.guildId);

    if (type === "channel" && name === "boost_channel") {
      await setupBoostChannel(interaction, value);
    }

    const successEmbed = new EmbedBuilder()
      .setTitle("Setting Updated")
      .setDescription(`Successfully updated \`${type}.${name}\` setting`)
      .setColor("#00FF00")
      .addFields({
        name: "New Value",
        value: `\`${updatedValue}\``,
        inline: true,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [successEmbed],
      flags: 64,
    });
  } catch (err) {
    console.error("Error setting guild setting:", err);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while updating the setting.")
      .setColor("#FF0000")
      .addFields({
        name: "Details",
        value: err.message || "Unknown error",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

async function handleGetSetting(interaction, type, name) {
  try {
    let value;
    let errorEmbed;

    switch (type) {
      case "channel":
        value = await db.getChannelId(interaction.guildId, name);
        break;
      case "role":
        value = await db.getRoleId(interaction.guildId, name);
        break;
      case "api":
        value = await db.getApiKey(interaction.guildId, name);
        break;
      case "link":
        value = await db.getExternalLink(interaction.guildId, name);
        break;
      default:
        errorEmbed = new EmbedBuilder()
          .setTitle("Invalid Type")
          .setDescription(
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          )
          .setColor("#FF0000")
          .setTimestamp();

        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64,
        });
        return;
    }

    const displayValue = formatValueForDisplay(value);

    const responseEmbed = new EmbedBuilder()
      .setTitle("Setting Value")
      .setDescription(`Value for \`${type}.${name}\``)
      .setColor("#0099FF")
      .addFields({
        name: "Value",
        value: displayValue ? `\`${displayValue}\`` : "*Not set*",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [responseEmbed],
      flags: 64,
    });
  } catch (error) {
    console.error("Error getting guild setting:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while retrieving the setting.")
      .setColor("#FF0000")
      .addFields({
        name: "Details",
        value: error.message || "Unknown error",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

function formatValueForDisplay(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Empty array";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

async function handleListSettings(interaction, type) {
  try {
    const settings = await getSettings(interaction.guildId);
    let listEmbed = new EmbedBuilder()
      .setTitle(`Guild Settings - ${type || "All"}`)
      .setColor("#2F3136")
      .setTimestamp();

    let hasSettings = false;

    if (!type || type === "channel") {
      const channels = settings.channel_ids || {};
      if (Object.keys(channels).length > 0) {
        hasSettings = true;
        listEmbed.addFields({
          name: "📝 Channel Settings",
          value:
            Object.entries(channels)
              .map(
                ([key, value]) =>
                  `• **${key}**: ${formatChannelValue(value, interaction)}`,
              )
              .join("\n") || "No channel settings",
        });
      }
    }

    if (!type || type === "role") {
      const roles = settings.role_ids || {};
      if (Object.keys(roles).length > 0) {
        hasSettings = true;
        listEmbed.addFields({
          name: "👑 Role Settings",
          value:
            Object.entries(roles)
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `• **${key}**: ${value.length > 0 ? value.join(", ") : "None"}`;
                }
                return `• **${key}**: ${formatRoleValue(value, interaction)}`;
              })
              .join("\n") || "No role settings",
        });
      }
    }

    if (!type || type === "api") {
      const apis = settings.api_keys || {};
      if (Object.keys(apis).length > 0) {
        hasSettings = true;
        listEmbed.addFields({
          name: "🔑 API Settings",
          value:
            Object.entries(apis)
              .map(
                ([key, value]) =>
                  `• **${key}**: ${value ? "✅ Set" : "❌ Not set"}`,
              )
              .join("\n") || "No API settings",
        });
      }
    }

    if (!type || type === "link") {
      const links = settings.external_links || {};
      if (Object.keys(links).length > 0) {
        hasSettings = true;
        listEmbed.addFields({
          name: "🔗 External Links",
          value:
            Object.entries(links)
              .map(([key, value]) => `• **${key}**: ${value || "Not set"}`)
              .join("\n") || "No external links",
        });
      }
    }

    if (!hasSettings) {
      listEmbed.setDescription("No settings configured yet for this server.");
    }

    await interaction.reply({
      embeds: [listEmbed],
      flags: 64,
    });
  } catch (error) {
    console.error("Error listing guild settings:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while retrieving the settings.")
      .setColor("#FF0000")
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

function formatChannelValue(value, interaction) {
  if (!value) return "Not set";
  const channel = interaction.guild.channels.cache.get(value);
  return channel ? `<#${value}> (${value})` : `${value} (Not found)`;
}

function formatRoleValue(value, interaction) {
  if (!value) return "Not set";
  const role = interaction.guild.roles.cache.get(value);
  return role ? `<@&${value}> (${value})` : `${value} (Not found)`;
}

async function handleRemoveSetting(interaction, type, name) {
  try {
    const guildSettings = await getSettings(interaction.guildId);
    let updateData = { ...guildSettings };
    let removed = false;
    let errorEmbed;

    switch (type) {
      case "channel":
        if (
          updateData.channel_ids &&
          updateData.channel_ids[name] !== undefined
        ) {
          delete updateData.channel_ids[name];
          removed = true;
        }
        break;
      case "role":
        if (updateData.role_ids && updateData.role_ids[name] !== undefined) {
          delete updateData.role_ids[name];
          removed = true;
        }
        break;
      case "api":
        if (updateData.api_keys && updateData.api_keys[name] !== undefined) {
          delete updateData.api_keys[name];
          removed = true;
        }
        break;
      case "link":
        if (
          updateData.external_links &&
          updateData.external_links[name] !== undefined
        ) {
          delete updateData.external_links[name];
          removed = true;
        }
        break;
      default:
        errorEmbed = new EmbedBuilder()
          .setTitle("Invalid Type")
          .setDescription(
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          )
          .setColor("#FF0000")
          .setTimestamp();

        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64,
        });
        return;
    }

    if (removed) {
      await db.updateGuildSettings(interaction.guildId, updateData);
      invalidateCache(interaction.guildId);

      const successEmbed = new EmbedBuilder()
        .setTitle("Setting Removed")
        .setDescription(`Successfully removed \`${type}.${name}\` setting`)
        .setColor("#00FF00")
        .setTimestamp();

      await interaction.reply({
        embeds: [successEmbed],
        flags: 64,
      });
    } else {
      const notFoundEmbed = new EmbedBuilder()
        .setTitle("Setting Not Found")
        .setDescription(
          `Setting \`${type}.${name}\` does not exist or is already not set.`,
        )
        .setColor("#FFA500")
        .setTimestamp();

      await interaction.reply({
        embeds: [notFoundEmbed],
        flags: 64,
      });
    }
  } catch (error) {
    console.error("Error removing guild setting:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while removing the setting.")
      .setColor("#FF0000")
      .addFields({
        name: "Details",
        value: error.message || "Unknown error",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

async function handleAvailableKeys(interaction, type) {
  try {
    const settings = await getSettings(interaction.guildId);
    let configuredSettings = {};
    const availableKeys = {
      channel: [
        "welcome",
        "goodbye",
        "verification",
        "logs",
        "boost_channel",
        "applications",
        "ticket_category",
        "stats_members",
        "stats_bots",
        "stats_total_tickets",
        "stats_open_tickets",
        "stats_online_members",
        "stats_roles",
        "announcements",
        "rules",
        "moderation_logs",
      ],
      role: [
        "verified",
        "unverified",
        "staff",
        "admin",
        "moderator",
        "muted",
        "member",
        "bot",
        "additional_verified",
        "support",
        "ticket_manager",
        "giveaway_manager",
      ],
      api: [
        "youtube",
        "twitter",
        "twitch",
        "reddit",
        "spotify",
        "github",
        "stripe",
        "paypal",
        "weather",
        "news",
        "translation",
      ],
      link: [
        "website",
        "forum",
        "store",
        "documentation",
        "support",
        "twitter",
        "instagram",
        "youtube",
        "twitch",
        "discord",
        "patreon",
      ],
    };

    switch (type) {
      case "channel":
        configuredSettings = settings.channel_ids || {};
        break;
      case "role":
        configuredSettings = settings.role_ids || {};
        break;
      case "api":
        configuredSettings = settings.api_keys || {};
        break;
      case "link":
        configuredSettings = settings.external_links || {};
        break;
      default: {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Invalid Type")
          .setDescription(
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          )
          .setColor("#FF0000")
          .setTimestamp();

        await interaction.reply({
          embeds: [errorEmbed],
          flags: 64,
        });
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(
        `Available ${type.charAt(0).toUpperCase() + type.slice(1)} Settings`,
      )
      .setColor("#2F3136")
      .setDescription(
        "Below is a list of all available setting keys and their configuration status:",
      )
      .setTimestamp();

    const keys = availableKeys[type];
    if (keys && keys.length > 0) {
      const configStatus = keys.map((key) => {
        const isConfigured = configuredSettings[key] !== undefined;
        return `${isConfigured ? "✅" : "❌"} \`${key}\``;
      });

      const chunkSize = Math.ceil(configStatus.length / 3);
      for (let i = 0; i < configStatus.length; i += chunkSize) {
        const chunk = configStatus.slice(i, i + chunkSize);
        embed.addFields({
          name: i === 0 ? "Status" : "\u200B",
          value: chunk.join("\n"),
          inline: true,
        });
      }
    } else {
      embed.setDescription("No available keys found for this setting type.");
    }

    await interaction.reply({
      embeds: [embed],
      flags: 64,
    });
  } catch (error) {
    console.error("Error retrieving available keys:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while retrieving the available keys.")
      .setColor("#FF0000")
      .addFields({
        name: "Details",
        value: error.message || "Unknown error",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

async function setupBoostChannel(interaction, channelId) {
  try {
    await db.updateLoggingSettings(interaction.guildId, "BOOST", {
      channel_id: channelId,
      enabled: true,
      allowed_roles: [],
      ping_roles: [],
    });

    console.log(
      `Successfully set up boost logging for channel ${channelId} in guild ${interaction.guildId}`,
    );
  } catch (error) {
    console.error("Error setting up boost channel:", error);
    throw error;
  }
}

async function handleSetBoostChannel(interaction, channelId) {
  try {
    const guildSettings = await getSettings(interaction.guildId);
    let updateData = { ...guildSettings };

    if (!updateData.channel_ids) updateData.channel_ids = {};
    updateData.channel_ids.boost_channel = channelId;

    await db.updateGuildSettings(interaction.guildId, updateData);
    invalidateCache(interaction.guildId);

    await setupBoostChannel(interaction, channelId);

    const channel = interaction.guild.channels.cache.get(channelId);

    const successEmbed = new EmbedBuilder()
      .setTitle("Boost Channel Set")
      .setDescription(
        `Server boost notifications will now be sent to ${channel.toString()}`,
      )
      .setColor("#FF73FA")
      .setTimestamp();

    await interaction.reply({
      embeds: [successEmbed],
      flags: 64,
    });
  } catch (error) {
    console.error("Error setting boost channel:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while setting up the boost channel.")
      .setColor("#FF0000")
      .addFields({
        name: "Details",
        value: error.message || "Unknown error",
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}

export {
  handleSetSetting,
  handleGetSetting,
  handleListSettings,
  handleRemoveSetting,
  handleAvailableKeys,
  handleSetBoostChannel,
};
