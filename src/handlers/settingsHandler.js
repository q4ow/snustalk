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
    case "remove":
      await handleRemoveSetting(interaction, settingType, settingName);
      break;
    case "available-keys":
      await handleAvailableKeys(interaction, settingType);
      break;
  }
}

export { handleSetBoostChannel };
export * from "./settings/handler.js";
