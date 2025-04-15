import { EmbedBuilder } from "discord.js";
import { db } from "../utils/database.js";
import {
  formatDuration,
  MOD_ACTIONS,
  getActionColor,
} from "../utils/moderation.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

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
          "This is a permanent ban from the server. If you believe this was in error, you may appeal this decision.";
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
  } catch (error) {
    console.error("Failed to send moderation DM:", error);
  }
}

export async function warnUser(guild, moderator, target, reason) {
  if (!reason) reason = "No reason provided";

  const warning = {
    id: Date.now().toString(),
    type: MOD_ACTIONS.WARN,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  await db.addModAction(guild.id, warning);
  await sendModActionDM(guild, target, warning);
  return warning;
}

export async function removeWarning(guildId, moderator, warningId) {
  const removed = await db.removeModAction(
    guildId,
    warningId,
    MOD_ACTIONS.WARN,
  );
  if (!removed) {
    throw new Error(
      "Warning not found or you do not have permission to remove it.",
    );
  }

  return {
    id: warningId,
    type: "warning_removed",
    moderatorId: moderator.id,
    timestamp: new Date().toISOString(),
  };
}

export async function kickUser(guild, moderator, target, reason) {
  if (!reason) reason = "No reason provided";

  const kick = {
    id: Date.now().toString(),
    type: MOD_ACTIONS.KICK,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  await sendModActionDM(guild, target, kick);
  await target.kick(reason);
  await db.addModAction(guild.id, kick);
  return kick;
}

export async function banUser(
  guild,
  moderator,
  target,
  reason,
  deleteDays = 0,
) {
  if (!reason) reason = "No reason provided";

  const ban = {
    id: Date.now().toString(),
    type: MOD_ACTIONS.BAN,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    deleteDays,
    timestamp: new Date().toISOString(),
  };

  await sendModActionDM(guild, target, ban);
  await guild.members.ban(target, { deleteMessageDays: deleteDays, reason });
  await db.addModAction(guild.id, ban);
  return ban;
}

export async function timeoutUser(guild, moderator, target, duration, reason) {
  if (!reason) reason = "No reason provided";

  const timeout = {
    id: Date.now().toString(),
    type: MOD_ACTIONS.TIMEOUT,
    moderatorId: moderator.id,
    targetId: target.id,
    duration,
    reason,
    timestamp: new Date().toISOString(),
  };

  await target.timeout(duration, reason);
  await db.addModAction(guild.id, timeout);
  await sendModActionDM(guild, target, timeout);
  return timeout;
}

export async function removeTimeout(guild, moderator, target, reason) {
  if (!reason) reason = "No reason provided";

  const untimeout = {
    id: Date.now().toString(),
    type: MOD_ACTIONS.REMOVE_TIMEOUT,
    moderatorId: moderator.id,
    targetId: target.id,
    reason,
    timestamp: new Date().toISOString(),
  };

  await target.timeout(null, reason);
  await db.addModAction(guild.id, untimeout);
  await sendModActionDM(guild, target, untimeout);
  return untimeout;
}

export async function getUserWarnings(guildId, userId) {
  const actions = await db.getModActions(guildId);
  return actions.filter(
    (action) => action.targetId === userId && action.type === MOD_ACTIONS.WARN,
  );
}

export async function getUserModActions(guildId, userId) {
  const actions = await db.getModActions(guildId);
  return actions.filter((action) => action.targetId === userId);
}

export function createModActionEmbed(action, guild) {
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

  return embed;
}
