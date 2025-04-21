import { EmbedBuilder } from "discord.js";
import {
  warnUser,
  kickUser,
  banUser,
  timeoutUser,
  removeTimeout,
  getUserWarnings,
  getUserModActions,
  createModActionEmbed,
  removeWarning,
} from "./handler.js";

function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2];

  let milliseconds;

  switch (unit) {
    case "s":
      milliseconds = amount * 1000;
      break;
    case "m":
      milliseconds = amount * 60 * 1000;
      break;
    case "h":
      milliseconds = amount * 60 * 60 * 1000;
      break;
    case "d":
      milliseconds = amount * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  return milliseconds;
}

export async function handleWarnCommand(interaction) {
  const userToWarn = interaction.options.getUser("user");
  const warnReason = interaction.options.getString("reason");
  const warnMember = await interaction.guild.members.fetch(userToWarn.id);

  if (
    warnMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.reply({
      content: "❌ You cannot warn this user due to role hierarchy.",
      flags: 64,
    });
    return;
  }

  const warning = await warnUser(
    interaction.guild,
    interaction.user,
    warnMember,
    warnReason,
  );

  await interaction.reply({
    embeds: [createModActionEmbed(warning, interaction.guild)],
    flags: 64,
  });
}

export async function handleRemoveWarningCommand(interaction) {
  const warningId = interaction.options.getString("id");

  try {
    await removeWarning(interaction.guild.id, interaction.user, warningId);

    const embed = new EmbedBuilder()
      .setTitle("Warning Removed")
      .setColor("#32CD32")
      .addFields(
        { name: "Warning ID", value: warningId, inline: true },
        {
          name: "Removed by",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>` },
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: 64,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ ${error.message}`,
      flags: 64,
    });
  }
}

export async function handleKickCommand(interaction) {
  const userToKick = interaction.options.getUser("user");
  const kickReason = interaction.options.getString("reason");
  const kickMember = await interaction.guild.members.fetch(userToKick.id);

  if (
    kickMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.reply({
      content: "❌ You cannot kick this user due to role hierarchy.",
      flags: 64,
    });
    return;
  }

  const kick = await kickUser(
    interaction.guild,
    interaction.user,
    kickMember,
    kickReason,
  );

  await interaction.reply({
    embeds: [createModActionEmbed(kick, interaction.guild)],
    flags: 64,
  });
}

export async function handleBanCommand(interaction) {
  const userToBan = interaction.options.getUser("user");
  const banReason = interaction.options.getString("reason");
  const deleteDays = interaction.options.getInteger("delete_days") || 0;
  const banMember = await interaction.guild.members.fetch(userToBan.id);

  if (
    banMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.reply({
      content: "❌ You cannot ban this user due to role hierarchy.",
      flags: 64,
    });
    return;
  }

  const ban = await banUser(
    interaction.guild,
    interaction.user,
    banMember,
    banReason,
    deleteDays,
  );

  await interaction.reply({
    embeds: [createModActionEmbed(ban, interaction.guild)],
    flags: 64,
  });
}

export async function handleTimeoutCommand(interaction) {
  try {
    const targetTimeoutUser = interaction.options.getUser("user");
    const timeoutReason = interaction.options.getString("reason");
    const durationStr = interaction.options.getString("duration");
    const timeoutMember = await interaction.guild.members.fetch(
      targetTimeoutUser.id,
    );

    if (
      timeoutMember.roles.highest.position >=
      interaction.member.roles.highest.position
    ) {
      await interaction.editReply({
        content: "❌ You cannot timeout this user due to role hierarchy.",
        flags: 64,
      });
      return;
    }

    const duration = parseDuration(durationStr);
    if (!duration) {
      await interaction.editReply({
        content: "❌ Invalid duration format. Use format like: 1h, 1d, 30m",
        flags: 64,
      });
      return;
    }

    const timeout = await timeoutUser(
      interaction.guild,
      interaction.user,
      timeoutMember,
      duration,
      timeoutReason,
    );

    await interaction.editReply({
      embeds: [createModActionEmbed(timeout, interaction.guild)],
      flags: 64,
    });
  } catch (error) {
    console.error("Error in timeout command:", error);
    await interaction.editReply({
      content:
        error.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "❌ Connection timeout. Please try again."
          : "❌ Failed to timeout user. Please try again.",
      flags: 64,
    });
  }
}

export async function handleUntimeoutCommand(interaction) {
  try {
    const untimeoutUser = interaction.options.getUser("user");
    const untimeoutReason = interaction.options.getString("reason");
    const untimeoutMember = await interaction.guild.members.fetch(
      untimeoutUser.id,
    );

    if (
      untimeoutMember.roles.highest.position >=
      interaction.member.roles.highest.position
    ) {
      await interaction.editReply({
        content:
          "❌ You cannot remove timeout from this user due to role hierarchy.",
        flags: 64,
      });
      return;
    }

    const untimeout = await removeTimeout(
      interaction.guild,
      interaction.user,
      untimeoutMember,
      untimeoutReason,
    );

    await interaction.editReply({
      embeds: [createModActionEmbed(untimeout, interaction.guild)],
      flags: 64,
    });
  } catch (error) {
    console.error("Error in untimeout command:", error);
    await interaction.editReply({
      content:
        error.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "❌ Connection timeout. Please try again."
          : "❌ Failed to remove timeout. Please try again.",
      flags: 64,
    });
  }
}

export async function handleWarningsCommand(interaction) {
  const warningsUser = interaction.options.getUser("user");
  const warnings = await getUserWarnings(interaction.guild.id, warningsUser.id);

  const warningsEmbed = new EmbedBuilder()
    .setTitle(`Warnings - ${warningsUser.tag}`)
    .setColor("#FFA500")
    .setTimestamp();

  if (warnings.length === 0) {
    warningsEmbed.setDescription("This user has no warnings.");
  } else {
    warningsEmbed.setDescription(
      warnings
        .map(
          (warning) =>
            `**ID:** ${warning.id}\n**Moderator:** <@${warning.moderatorId}>\n**Reason:** ${warning.reason}\n**Time:** <t:${Math.floor(new Date(warning.timestamp).getTime() / 1000)}:R>\n`,
        )
        .join("\n"),
    );
  }

  await interaction.reply({ embeds: [warningsEmbed], flags: 64 });
}

export async function handleModlogsCommand(interaction) {
  const modlogsUser = interaction.options.getUser("user");
  const modlogs = await getUserModActions(interaction.guild.id, modlogsUser.id);

  const modlogsEmbed = new EmbedBuilder()
    .setTitle(`Moderation History - ${modlogsUser.tag}`)
    .setColor("#2F3136")
    .setTimestamp();

  if (modlogs.length === 0) {
    modlogsEmbed.setDescription("This user has no moderation history.");
  } else {
    modlogsEmbed.setDescription(
      modlogs
        .map(
          (action) =>
            `**Type:** ${action.type.toUpperCase()}\n**ID:** ${action.id}\n**Moderator:** <@${action.moderatorId}>\n**Reason:** ${action.reason}\n**Time:** <t:${Math.floor(new Date(action.timestamp).getTime() / 1000)}:R>\n`,
        )
        .join("\n"),
    );
  }

  await interaction.reply({ embeds: [modlogsEmbed], flags: 64 });
}
