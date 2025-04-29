import { EmbedBuilder } from "discord.js";
import { db } from "../../utils/database.js";
import {
  formatDuration,
  MOD_ACTIONS,
  getActionColor,
} from "../../utils/moderation.js";

const RATE_LIMITS = {
  ACTIONS_PER_WINDOW: 10,
  TIME_WINDOW_MS: 5 * 60 * 1000,
};

const APPEAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
};

async function checkRateLimit(guild, moderator) {
  const actionsCount = await db.getRateLimitedActions(
    guild.id,
    moderator.id,
    RATE_LIMITS.TIME_WINDOW_MS,
  );

  if (actionsCount >= RATE_LIMITS.ACTIONS_PER_WINDOW) {
    throw new Error(
      `You are being rate limited. Please wait before taking more moderation actions.`,
    );
  }
}

async function sendModActionDM(guild, target, action) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Moderation Action - ${action.type.toUpperCase()}`)
      .setColor(getActionColor(action.type))
      .setDescription("You have received a moderation action in " + guild.name)
      .addFields(
        { name: "Action", value: action.type.toUpperCase(), inline: true },
        { name: "Reason", value: action.reason, inline: true },
        {
          name: "Time",
          value: `<t:${Math.floor(new Date(action.timestamp).getTime() / 1000)}:R>`,
          inline: true,
        },
      )
      .setFooter({ text: guild.name, iconURL: guild.iconURL() })
      .setTimestamp();

    if (action.duration) {
      embed.addFields({
        name: "Duration",
        value: formatDuration(action.duration),
        inline: true,
      });
    }

    if (
      action.type === MOD_ACTIONS.BAN ||
      (action.duration && action.duration > 24 * 60 * 60 * 1000)
    ) {
      embed.addFields({
        name: "📝 Appeal Information",
        value:
          "You can appeal this action by contacting the server moderators. Include your case ID in your appeal: " +
          action.id,
      });
    }

    let consequenceText = "";
    switch (action.type) {
      case MOD_ACTIONS.WARN:
        consequenceText =
          "Further violations may result in more severe actions such as timeouts or bans.";
        break;
      case MOD_ACTIONS.KICK:
        consequenceText =
          "You may rejoin the server, but further violations may result in a permanent ban.";
        break;
      case MOD_ACTIONS.BAN:
        consequenceText =
          "This is a permanent ban from the server. If you believe this was in error, you may appeal this decision using the information above.";
        break;
      case MOD_ACTIONS.TIMEOUT:
        consequenceText =
          "During your timeout, you cannot send messages or join voice channels. Further violations may result in longer timeouts or bans.";
        break;
    }

    if (consequenceText) {
      embed.addFields({
        name: "⚠️ Warning",
        value: consequenceText,
      });
    }

    embed.addFields({
      name: "📜 Reminder",
      value:
        "Please review our server rules to avoid future incidents. Being a positive member of our community is important to us.",
    });

    const user = await guild.client.users.fetch(action.targetId);
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error("Failed to send moderation DM:", error);
    return false;
  }
}

export async function warnUser(guild, moderator, target, reason) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  const warning = {
    type: MOD_ACTIONS.WARN,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  warning.id = await db.addModAction(guild.id, warning);
  await sendModActionDM(guild, target, warning);
  return warning;
}

export async function removeWarning(guildId, moderator, warningId) {
  return {
    id: warningId,
    type: "warning_removed",
    moderatorId: moderator.id,
    timestamp: new Date().toISOString(),
  };
}

export async function kickUser(guild, moderator, target, reason) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  const kick = {
    type: MOD_ACTIONS.KICK,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  kick.id = await db.addModAction(guild.id, kick);
  const dmSent = await sendModActionDM(guild, target, kick);
  await target.kick(reason);

  return { ...kick, dmSent };
}

export async function banUser(
  guild,
  moderator,
  target,
  reason,
  deleteDays = 0,
) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  try {
    await guild.bans.fetch(target.id);
    throw new Error("User is already banned from this server.");
  } catch (error) {
    if (!error.message.includes("Unknown Ban")) {
      throw error;
    }
  }

  const ban = {
    type: MOD_ACTIONS.BAN,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
    metadata: { deleteDays },
  };

  ban.id = await db.addModAction(guild.id, ban);
  const dmSent = await sendModActionDM(guild, target, ban);

  let deleteMessageSeconds = 0;
  if (typeof deleteDays === "number" && deleteDays > 0) {
    deleteMessageSeconds = Math.min(deleteDays * 86400, 604800);
  }

  await guild.members.ban(target, {
    deleteMessageSeconds,
    reason,
  });

  return { ...ban, dmSent };
}

export async function unbanUser(guild, moderator, target, reason) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  try {
    await guild.bans.fetch(target.id);
  } catch (error) {
    if (error.message.includes("Unknown Ban")) {
      throw new Error("This user is not banned from this server.");
    }
    throw error;
  }

  const unban = {
    type: MOD_ACTIONS.UNBAN,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  unban.id = await db.addModAction(guild.id, unban);

  const dmSent = false;

  await guild.members.unban(target.id, reason);

  return { ...unban, dmSent };
}

export async function timeoutUser(guild, moderator, target, duration, reason) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  const timeout = {
    type: MOD_ACTIONS.TIMEOUT,
    moderatorId: moderator.id,
    targetId: target.id,
    duration,
    reason,
    timestamp: new Date().toISOString(),
  };

  timeout.id = await db.addModAction(guild.id, timeout);
  const dmSent = await sendModActionDM(guild, target, timeout);
  await target.timeout(duration, reason);

  return { ...timeout, dmSent };
}

export async function removeTimeout(guild, moderator, target, reason) {
  await checkRateLimit(guild, moderator);
  if (!reason) reason = "No reason provided";

  const untimeout = {
    type: MOD_ACTIONS.REMOVE_TIMEOUT,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  untimeout.id = await db.addModAction(guild.id, untimeout);
  const dmSent = await sendModActionDM(guild, target, untimeout);
  await target.timeout(null, reason);

  return { ...untimeout, dmSent };
}

export async function getUserWarnings(guildId, userId) {
  return await db.getModActions(guildId, {
    targetId: userId,
    actionType: MOD_ACTIONS.WARN,
    activeOnly: true,
  });
}

export async function getUserModActions(guildId, userId) {
  return await db.getModActions(guildId, { targetId: userId });
}

export async function handleAppeal(guild, actionId, status, reason) {
  if (!Object.values(APPEAL_STATUS).includes(status)) {
    throw new Error("Invalid appeal status");
  }

  await db.updateAppealStatus(guild.id, actionId, status);
  const action = await db.getModActions(guild.id, { actionId });

  if (action && status === APPEAL_STATUS.APPROVED) {
    const target = await guild.client.users.fetch(action.targetId);
    if (action.type === MOD_ACTIONS.BAN) {
      await guild.members.unban(target.id, `Appeal approved: ${reason}`);
    } else if (action.type === MOD_ACTIONS.TIMEOUT) {
      const member = await guild.members.fetch(target.id);
      await member.timeout(null, `Appeal approved: ${reason}`);
    }
  }

  return { actionId, status, reason };
}

export function createModActionEmbed(action) {
  const embed = new EmbedBuilder()
    .setTitle(`Moderation Action - ${action.type.toUpperCase()}`)
    .setColor(getActionColor(action.type))
    .addFields(
      { name: "User", value: `<@${action.targetId}>`, inline: true },
      { name: "Moderator", value: `<@${action.moderatorId}>`, inline: true },
      { name: "Reason", value: action.reason },
      {
        name: "Time",
        value: `<t:${Math.floor(new Date(action.timestamp).getTime() / 1000)}:R>`,
      },
    )
    .setTimestamp();

  if (action.duration) {
    embed.addFields({
      name: "Duration",
      value: formatDuration(action.duration),
      inline: true,
    });
  }

  if (action.id) {
    embed.addFields({
      name: "Case ID",
      value: action.id.toString(),
      inline: true,
    });
  }

  if (!action.dmSent) {
    embed.addFields({
      name: "⚠️ Notice",
      value: "Unable to send DM to user",
      inline: true,
    });
  }

  if (action.appeal_status) {
    embed.addFields({
      name: "Appeal Status",
      value: action.appeal_status.toUpperCase(),
      inline: true,
    });
  }

  return embed;
}
