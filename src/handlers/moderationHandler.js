import { EmbedBuilder } from "discord.js";
import { db } from "../utils/database.js";
import { formatDuration, MOD_ACTIONS, getActionColor } from "../utils/moderation.js";

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

  const mutedRoleID = process.env.MUTED_ROLE_ID;
  if (mutedRoleID) {
    const mutedRole = guild.roles.cache.get(mutedRoleID);
    if (mutedRole) {
      await target.roles.add(mutedRole);

      setTimeout(async () => {
        await target.roles.remove(mutedRole);
      }, duration);
    } else {
      console.error("Muted role not found.");
    }
  }
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
