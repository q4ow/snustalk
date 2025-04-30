import { EmbedBuilder } from "discord.js";
import { db } from "../../utils/database.js";
import { logger } from "../../utils/logger.js";

const settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getSettings(guildId) {
  try {
    const cacheKey = `settings_${guildId}`;
    const cachedSettings = settingsCache.get(cacheKey);

    if (cachedSettings && cachedSettings.timestamp > Date.now() - CACHE_TTL) {
      logger.debug(`Using cached settings for guild ${guildId}`);
      return cachedSettings.data;
    }

    logger.debug(`Fetching fresh settings for guild ${guildId}`);
    const settings = await db.getGuildSettings(guildId);
    settingsCache.set(cacheKey, {
      data: settings,
      timestamp: Date.now(),
    });

    return settings;
  } catch (error) {
    logger.error(`Error getting settings for guild ${guildId}:`, error);
    throw error;
  }
}

function invalidateCache(guildId) {
  try {
    const cacheKey = `settings_${guildId}`;
    settingsCache.delete(cacheKey);
    logger.debug(`Cache invalidated for guild ${guildId}`);
  } catch (error) {
    logger.error(`Error invalidating cache for guild ${guildId}:`, error);
  }
}

async function handleSetSetting(interaction, type, name, value) {
  try {
    logger.info(`Setting ${type}.${name} for guild ${interaction.guildId}`);
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
        logger.warn(`Invalid setting type attempted: ${type}`);
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

    logger.info(
      `Successfully updated ${type}.${name} for guild ${interaction.guildId}`,
    );

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
  } catch (error) {
    logger.error(
      `Error setting ${type}.${name} for guild ${interaction.guildId}:`,
      error,
    );

    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription("An error occurred while updating the setting.")
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
    logger.error(
      `Error getting ${type}.${name} for guild ${interaction.guildId}:`,
      error,
    );

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
        const channelEntries = Object.entries(channels).map(
          ([key, value]) =>
            `• **${key}**: ${formatChannelValue(value, interaction)}`,
        );

        let currentChunk = [];
        let currentLength = 0;

        for (const entry of channelEntries) {
          if (currentLength + entry.length + 1 > 1024) {
            listEmbed.addFields({
              name:
                currentChunk === channelEntries
                  ? "📝 Channel Settings"
                  : "📝 Channel Settings (cont.)",
              value: currentChunk.join("\n"),
            });
            currentChunk = [entry];
            currentLength = entry.length;
          } else {
            currentChunk.push(entry);
            currentLength += entry.length + 1;
          }
        }

        if (currentChunk.length > 0) {
          listEmbed.addFields({
            name:
              channelEntries.length === currentChunk.length
                ? "📝 Channel Settings"
                : "📝 Channel Settings (cont.)",
            value: currentChunk.join("\n") || "No channel settings",
          });
        }
      }
    }

    if (!type || type === "role") {
      const roles = settings.role_ids || {};
      if (Object.keys(roles).length > 0) {
        hasSettings = true;
        const roleEntries = Object.entries(roles).map(([key, value]) => {
          if (Array.isArray(value)) {
            return `• **${key}**: ${value.length > 0 ? value.join(", ") : "None"}`;
          }
          return `• **${key}**: ${formatRoleValue(value, interaction)}`;
        });

        let currentChunk = [];
        let currentLength = 0;

        for (const entry of roleEntries) {
          if (currentLength + entry.length + 1 > 1024) {
            listEmbed.addFields({
              name:
                currentChunk === roleEntries
                  ? "👑 Role Settings"
                  : "👑 Role Settings (cont.)",
              value: currentChunk.join("\n"),
            });
            currentChunk = [entry];
            currentLength = entry.length;
          } else {
            currentChunk.push(entry);
            currentLength += entry.length + 1;
          }
        }

        if (currentChunk.length > 0) {
          listEmbed.addFields({
            name:
              roleEntries.length === currentChunk.length
                ? "👑 Role Settings"
                : "👑 Role Settings (cont.)",
            value: currentChunk.join("\n") || "No role settings",
          });
        }
      }
    }

    if (!type || type === "api") {
      const apis = settings.api_keys || {};
      if (Object.keys(apis).length > 0) {
        hasSettings = true;
        const apiEntries = Object.entries(apis).map(
          ([key, value]) => `• **${key}**: ${value ? "✅ Set" : "❌ Not set"}`,
        );

        let currentChunk = [];
        let currentLength = 0;

        for (const entry of apiEntries) {
          if (currentLength + entry.length + 1 > 1024) {
            listEmbed.addFields({
              name:
                currentChunk === apiEntries
                  ? "🔑 API Settings"
                  : "🔑 API Settings (cont.)",
              value: currentChunk.join("\n"),
            });
            currentChunk = [entry];
            currentLength = entry.length;
          } else {
            currentChunk.push(entry);
            currentLength += entry.length + 1;
          }
        }

        if (currentChunk.length > 0) {
          listEmbed.addFields({
            name:
              apiEntries.length === currentChunk.length
                ? "🔑 API Settings"
                : "🔑 API Settings (cont.)",
            value: currentChunk.join("\n") || "No API settings",
          });
        }
      }
    }

    if (!type || type === "link") {
      const links = settings.external_links || {};
      if (Object.keys(links).length > 0) {
        hasSettings = true;
        const linkEntries = Object.entries(links).map(
          ([key, value]) => `• **${key}**: ${value || "Not set"}`,
        );

        let currentChunk = [];
        let currentLength = 0;

        for (const entry of linkEntries) {
          if (currentLength + entry.length + 1 > 1024) {
            listEmbed.addFields({
              name:
                currentChunk === linkEntries
                  ? "🔗 External Links"
                  : "🔗 External Links (cont.)",
              value: currentChunk.join("\n"),
            });
            currentChunk = [entry];
            currentLength = entry.length;
          } else {
            currentChunk.push(entry);
            currentLength += entry.length + 1;
          }
        }

        if (currentChunk.length > 0) {
          listEmbed.addFields({
            name:
              linkEntries.length === currentChunk.length
                ? "🔗 External Links"
                : "🔗 External Links (cont.)",
            value: currentChunk.join("\n") || "No external links",
          });
        }
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
    logger.error(
      `Error listing settings for guild ${interaction.guildId}:`,
      error,
    );

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
    logger.info(`Removing ${type}.${name} for guild ${interaction.guildId}`);
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

      logger.info(
        `Successfully removed ${type}.${name} for guild ${interaction.guildId}`,
      );

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
    logger.error(
      `Error removing ${type}.${name} for guild ${interaction.guildId}:`,
      error,
    );

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
        "wall_of_shame",
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
    logger.error(
      `Error retrieving available keys for guild ${interaction.guildId}:`,
      error,
    );

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

    logger.info(
      `Set up boost logging for channel ${channelId} in guild ${interaction.guildId}`,
    );
  } catch (error) {
    logger.error(
      `Error setting up boost channel ${channelId} in guild ${interaction.guildId}:`,
      error,
    );
    throw error;
  }
}

async function handleSetBoostChannel(interaction, channelId) {
  try {
    logger.info(
      `Setting boost channel ${channelId} for guild ${interaction.guildId}`,
    );

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

    logger.info(
      `Successfully configured boost channel ${channelId} for guild ${interaction.guildId}`,
    );
  } catch (error) {
    logger.error(
      `Error setting boost channel for guild ${interaction.guildId}:`,
      error,
    );

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
  getSettings,
};
