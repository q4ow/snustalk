import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/database.js";

export async function handleSettingsCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "You need Administrator permissions to use this command.",
      flags: 64,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const settingType = interaction.options.getString("type");
  const settingName = interaction.options.getString("name");
  const settingValue = interaction.options.getString("value");

  switch (subcommand) {
    case "set":
      await handleSetSetting(
        interaction,
        settingType,
        settingName,
        settingValue,
      );
      break;
    case "get":
      await handleGetSetting(interaction, settingType, settingName);
      break;
    case "list":
      await handleListSettings(interaction, settingType);
      break;
  }
}

async function handleSetSetting(interaction, type, name, value) {
  try {
    const guildSettings = await db.getGuildSettings(interaction.guildId);
    let updateData = { ...guildSettings };

    switch (type) {
      case "channel":
        if (!updateData.channel_ids) updateData.channel_ids = {};
        updateData.channel_ids[name] = value;
        break;
      case "role":
        if (!updateData.role_ids) updateData.role_ids = {};
        if (name === "additional_verified") {
          updateData.role_ids[name] = value.split(",").map((id) => id.trim());
        } else {
          updateData.role_ids[name] = value;
        }
        break;
      case "api":
        if (!updateData.api_keys) updateData.api_keys = {};
        updateData.api_keys[name] = value;
        break;
      case "link":
        if (!updateData.external_links) updateData.external_links = {};
        updateData.external_links[name] = value;
        break;
      default:
        await interaction.reply({
          content:
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          flags: 64,
        });
        return;
    }

    await db.updateGuildSettings(interaction.guildId, updateData);

    await interaction.reply({
      content: `✅ Successfully updated ${type} setting: ${name}`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error setting guild setting:", error);
    await interaction.reply({
      content: "❌ An error occurred while updating the setting.",
      flags: 64,
    });
  }
}

async function handleGetSetting(interaction, type, name) {
  try {
    let value;
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
        await interaction.reply({
          content:
            "Invalid setting type. Use 'channel', 'role', 'api', or 'link'.",
          flags: 64,
        });
        return;
    }

    await interaction.reply({
      content: value
        ? `${type}.${name} = ${value}`
        : `${type}.${name} is not set`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error getting guild setting:", error);
    await interaction.reply({
      content: "❌ An error occurred while retrieving the setting.",
      flags: 64,
    });
  }
}

async function handleListSettings(interaction, type) {
  try {
    const settings = await db.getGuildSettings(interaction.guildId);
    let listEmbed = new EmbedBuilder()
      .setTitle(`Guild Settings - ${type || "All"}`)
      .setColor("#2F3136")
      .setTimestamp();

    if (!type || type === "channel") {
      const channels = settings.channel_ids || {};
      if (Object.keys(channels).length > 0) {
        listEmbed.addFields({
          name: "Channel Settings",
          value:
            Object.entries(channels)
              .map(([key, value]) => `${key}: ${value || "Not set"}`)
              .join("\n") || "No channel settings",
        });
      }
    }

    if (!type || type === "role") {
      const roles = settings.role_ids || {};
      if (Object.keys(roles).length > 0) {
        listEmbed.addFields({
          name: "Role Settings",
          value:
            Object.entries(roles)
              .map(([key, value]) => {
                if (Array.isArray(value)) {
                  return `${key}: ${value.join(", ") || "None"}`;
                }
                return `${key}: ${value || "Not set"}`;
              })
              .join("\n") || "No role settings",
        });
      }
    }

    if (!type || type === "api") {
      const apis = settings.api_keys || {};
      if (Object.keys(apis).length > 0) {
        listEmbed.addFields({
          name: "API Settings",
          value:
            Object.entries(apis)
              .map(([key, value]) => `${key}: ${value ? "[Set]" : "Not set"}`)
              .join("\n") || "No API settings",
        });
      }
    }

    if (!type || type === "link") {
      const links = settings.external_links || {};
      if (Object.keys(links).length > 0) {
        listEmbed.addFields({
          name: "External Links",
          value:
            Object.entries(links)
              .map(([key, value]) => `${key}: ${value || "Not set"}`)
              .join("\n") || "No external links",
        });
      }
    }

    await interaction.reply({
      embeds: [listEmbed],
      flags: 64,
    });
  } catch (error) {
    console.error("Error listing guild settings:", error);
    await interaction.reply({
      content: "❌ An error occurred while retrieving the settings.",
      flags: 64,
    });
  }
}

export async function handleSetBoostChannel(interaction, channelId) {
  try {
    const guildSettings = await db.getGuildSettings(interaction.guildId);
    let updateData = { ...guildSettings };

    if (!updateData.channel_ids) updateData.channel_ids = {};
    updateData.channel_ids.boost_channel = channelId;

    await db.updateGuildSettings(interaction.guildId, updateData);

    await db.updateLoggingSettings(interaction.guildId, "BOOST", {
      channel_id: channelId,
      enabled: true,
      allowed_roles: [],
      ping_roles: [],
    });

    const channel = interaction.guild.channels.cache.get(channelId);
    await interaction.reply({
      content: `✅ Server boost notifications will now be sent to ${channel.toString()}`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error setting boost channel:", error);
    await interaction.reply({
      content: "❌ An error occurred while setting up the boost channel.",
      flags: 64,
    });
  }
}
