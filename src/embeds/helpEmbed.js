import { EmbedBuilder } from "discord.js";

export function createHelpEmbed(slashCommands, prefix) {
  const commandGroups = {
    "🛡️ Moderation": [
      "warn",
      "removewarning",
      "kick",
      "ban",
      "timeout",
      "untimeout",
      "warnings",
      "modlogs",
      "purge",
      "lock",
      "unlock",
      "nickname",
    ],
    "🎫 Tickets": ["setup-tickets"],
    "🔧 Utility": ["userinfo", "serverinfo", "avatar", "ping"],
    "⚙️ System": ["resend-verify", "welcome"],
  };

  const helpEmbed = new EmbedBuilder()
    .setTitle("Command Help")
    .setColor("#2F3136")
    .setDescription(
      `Use \`${prefix}command\` or \`/command\` to execute a command.`,
    )
    .setTimestamp();

  for (const [category, cmds] of Object.entries(commandGroups)) {
    const commandList = cmds
      .map((cmdName) => {
        const slashCmd = slashCommands.find((cmd) => cmd.name === cmdName);
        return `\`${cmdName}\` - ${slashCmd ? slashCmd.description : "No description available"}`;
      })
      .join("\n");

    helpEmbed.addFields({ name: category, value: commandList });
  }

  helpEmbed.addFields({
    name: "📌 Note",
    value: [
      "Some commands may require special permissions to use.",
      "Duration format for timeout: `1s`, `1m`, `1h`, `1d` (seconds, minutes, hours, days)",
      "For detailed command usage, type the command without any arguments.",
    ].join("\n"),
  });

  return helpEmbed;
}
