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
  handleAppeal,
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
  await interaction.deferReply({ flags: 64 });
  const userToWarn = interaction.options.getUser("user");
  const warnReason = interaction.options.getString("reason");
  const warnMember = await interaction.guild.members.fetch(userToWarn.id);

  if (
    warnMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.editReply({
      content: "❌ You cannot warn this user due to role hierarchy.",
    });
    return;
  }

  try {
    const warning = await warnUser(
      interaction.guild,
      interaction.user,
      warnMember,
      warnReason,
    );

    await interaction.editReply({
      embeds: [createModActionEmbed(warning, interaction.guild)],
    });
  } catch (error) {
    if (error.message.includes("rate limited")) {
      await interaction.editReply({
        content: "❌ " + error.message,
      });
    } else {
      await interaction.editReply({
        content: "❌ Failed to warn user. Please try again.",
      });
      console.error("Warn error:", error);
    }
  }
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
  await interaction.deferReply({ flags: 64 });
  const userToKick = interaction.options.getUser("user");
  const kickReason = interaction.options.getString("reason");
  const kickMember = await interaction.guild.members.fetch(userToKick.id);

  if (
    kickMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.editReply({
      content: "❌ You cannot kick this user due to role hierarchy.",
    });
    return;
  }

  try {
    const kick = await kickUser(
      interaction.guild,
      interaction.user,
      kickMember,
      kickReason,
    );

    await interaction.editReply({
      embeds: [createModActionEmbed(kick, interaction.guild)],
    });
  } catch (error) {
    if (error.message.includes("rate limited")) {
      await interaction.editReply({
        content: "❌ " + error.message,
      });
    } else {
      await interaction.editReply({
        content: "❌ Failed to kick user. Please try again.",
      });
      console.error("Kick error:", error);
    }
  }
}

export async function handleBanCommand(interaction) {
  await interaction.deferReply({ flags: 64 });
  const userToBan = interaction.options.getUser("user");
  const banReason = interaction.options.getString("reason");
  const deleteDays = interaction.options.getInteger("delete_days") || 0;
  const banMember = await interaction.guild.members.fetch(userToBan.id);

  if (
    banMember.roles.highest.position >=
    interaction.member.roles.highest.position
  ) {
    await interaction.editReply({
      content: "❌ You cannot ban this user due to role hierarchy.",
    });
    return;
  }

  try {
    const ban = await banUser(
      interaction.guild,
      interaction.user,
      banMember,
      banReason,
      deleteDays,
    );

    await interaction.editReply({
      embeds: [createModActionEmbed(ban, interaction.guild)],
    });
  } catch (error) {
    if (error.message.includes("rate limited")) {
      await interaction.editReply({
        content: "❌ " + error.message,
      });
    } else {
      await interaction.editReply({
        content: "❌ Failed to ban user. Please try again.",
      });
      console.error("Ban error:", error);
    }
  }
}

export async function handleTimeoutCommand(interaction) {
  await interaction.deferReply({ flags: 64 });
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
      });
      return;
    }

    const duration = parseDuration(durationStr);
    if (!duration) {
      await interaction.editReply({
        content: "❌ Invalid duration format. Use format like: 1h, 1d, 30m",
      });
      return;
    }

    try {
      const timeout = await timeoutUser(
        interaction.guild,
        interaction.user,
        timeoutMember,
        duration,
        timeoutReason,
      );

      await interaction.editReply({
        embeds: [createModActionEmbed(timeout, interaction.guild)],
      });
    } catch (error) {
      if (error.message.includes("rate limited")) {
        await interaction.editReply({
          content: "❌ " + error.message,
        });
      } else {
        await interaction.editReply({
          content:
            error.code === "UND_ERR_CONNECT_TIMEOUT"
              ? "❌ Connection timeout. Please try again."
              : "❌ Failed to timeout user. Please try again.",
        });
        console.error("Timeout error:", error);
      }
    }
  } catch (error) {
    console.error("Error in timeout command:", error);
    await interaction.editReply({
      content:
        error.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "❌ Connection timeout. Please try again."
          : "❌ Failed to timeout user. Please try again.",
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
    });
  } catch (error) {
    console.error("Error in untimeout command:", error);
    await interaction.editReply({
      content:
        error.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "❌ Connection timeout. Please try again."
          : "❌ Failed to remove timeout. Please try again.",
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

export async function handleAppealCommand(interaction) {
  await interaction.deferReply({ flags: 64 });
  const actionId = interaction.options.getString("case_id");
  const status = interaction.options.getString("status");
  const reason = interaction.options.getString("reason");

  try {
    const result = await handleAppeal(
      interaction.guild,
      actionId,
      status,
      reason,
    );

    const embed = new EmbedBuilder()
      .setTitle("Appeal Status Updated")
      .setColor(
        status === "approved"
          ? "#32CD32"
          : status === "denied"
            ? "#FF0000"
            : "#FFA500",
      )
      .addFields(
        { name: "Case ID", value: actionId, inline: true },
        { name: "Status", value: status.toUpperCase(), inline: true },
        {
          name: "Updated By",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        { name: "Reason", value: reason },
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`,
    });
  }
}

export async function handleBulkActionCommand(interaction) {
  await interaction.deferReply({ flags: 64 });
  const users = interaction.options.getString("users").split(/,\s*/);
  const action = interaction.options.getString("action");
  const reason = interaction.options.getString("reason");
  const duration =
    action === "timeout" ? interaction.options.getString("duration") : null;

  const results = {
    success: [],
    failed: [],
  };

  for (const userId of users) {
    try {
      const cleanId = userId.replace(/[<@!>]/g, "");
      const target = await interaction.guild.members.fetch(cleanId);

      switch (action) {
        case "warn":
          await warnUser(interaction.guild, interaction.user, target, reason);
          break;
        case "kick":
          await kickUser(interaction.guild, interaction.user, target, reason);
          break;
        case "ban":
          await banUser(interaction.guild, interaction.user, target, reason, 0);
          break;
        case "timeout":
          const parsedDuration = parseDuration(duration);
          if (!parsedDuration) throw new Error("Invalid duration");
          await timeoutUser(
            interaction.guild,
            interaction.user,
            target,
            parsedDuration,
            reason,
          );
          break;
      }
      results.success.push(cleanId);
    } catch (error) {
      results.failed.push({ id: userId, reason: error.message });
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("Bulk Action Results")
    .setColor(results.failed.length === 0 ? "#32CD32" : "#FFA500")
    .addFields(
      {
        name: "✅ Successful Actions",
        value:
          results.success.length > 0
            ? results.success.map((id) => `<@${id}>`).join("\n")
            : "None",
      },
      {
        name: "❌ Failed Actions",
        value:
          results.failed.length > 0
            ? results.failed.map((f) => `<@${f.id}> - ${f.reason}`).join("\n")
            : "None",
      },
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}

export async function handleActiveTimeoutsCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  try {
    const timeouts = await db.getModActions(interaction.guild.id, {
      actionType: MOD_ACTIONS.TIMEOUT,
      activeOnly: true,
    });

    const embed = new EmbedBuilder()
      .setTitle("Active Timeouts")
      .setColor("#FFD700")
      .setDescription(
        timeouts.length > 0
          ? timeouts
              .map(
                (t) =>
                  `<@${t.targetId}> - Expires: <t:${Math.floor(
                    new Date(t.expires_at).getTime() / 1000,
                  )}:R>\nReason: ${t.reason}`,
              )
              .join("\n\n")
          : "No active timeouts",
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    await interaction.editReply({
      content: "❌ Failed to fetch active timeouts.",
    });
  }
}
