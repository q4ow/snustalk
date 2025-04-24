import { PermissionFlagsBits } from "discord.js";
import {
  handleSetSetting,
  handleGetSetting,
  handleListSettings,
  handleRemoveSetting,
  handleAvailableKeys,
  handleSetBoostChannel,
} from "./settings/handler.js";

export async function handleSettingsCommand(interaction) {
  try {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: "You need Administrator permissions to use this command.",
        ephemeral: true,
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
      case "remove":
        await handleRemoveSetting(interaction, settingType, settingName);
        break;
      case "available-keys":
        await handleAvailableKeys(interaction, settingType);
        break;
      case "boost-channel":
        const channelId = interaction.options.getString("channel_id");
        await handleSetBoostChannel(interaction, channelId);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand. Please use a valid settings command.",
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error("Error in settings command handler:", error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "An error occurred while processing the settings command. Please try again later.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error reply:", replyError);
    }
  }
}

export { handleSetBoostChannel };
export * from "./settings/handler.js";
