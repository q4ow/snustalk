import { PermissionFlagsBits } from "discord.js";
import { ratio } from "fuzzball";

export function calculateUsernameSimilarity(username1, username2) {
  return ratio(username1.toLowerCase(), username2.toLowerCase()) / 100;
}

export function isUserSuspicious(member, settings) {
  const accountAge = Date.now() - member.user.createdTimestamp;
  const minAccountAge = settings.accountAgeDays * 24 * 60 * 60 * 1000;

  return accountAge < minAccountAge;
}

export function findSimilarUsernames(members, threshold) {
  const groups = new Map();
  const processed = new Set();

  members.forEach((member1) => {
    if (processed.has(member1.id)) return;

    const similar = members.filter((member2) => {
      if (member1.id === member2.id || processed.has(member2.id)) return false;
      return (
        calculateUsernameSimilarity(
          member1.user.username,
          member2.user.username,
        ) >= threshold
      );
    });

    if (similar.length > 0) {
      const group = [member1, ...similar];
      const groupId = `group_${groups.size}`;
      groups.set(groupId, group);
      group.forEach((m) => processed.add(m.id));
    }
  });

  return groups;
}

export function isExemptFromRaidProtection(member, settings) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  return settings.exemptRoles.some((roleId) => member.roles.cache.has(roleId));
}

export async function lockdownServer(guild, settings, reason) {
  const channels = await guild.channels.fetch();
  const lockPromises = [];

  for (const [_, channel] of channels) {
    if (settings.exemptChannels.includes(channel.id)) continue;
    if (
      !channel
        .permissionsFor(guild.roles.everyone)
        .has(PermissionFlagsBits.SendMessages)
    )
      continue;

    const originalPerms = channel.permissionOverwrites.cache.get(
      guild.roles.everyone.id,
    );
    if (originalPerms) {
      await channel.setProperty("originalPerms", originalPerms);
    }

    lockPromises.push(
      channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      }),
    );
  }

  await Promise.all(lockPromises);
  return channels.size - settings.exemptChannels.length;
}

export async function unlockServer(guild, settings) {
  const channels = await guild.channels.fetch();
  const unlockPromises = [];

  for (const [_, channel] of channels) {
    if (settings.exemptChannels.includes(channel.id)) continue;

    const originalPerms = await channel.getProperty("originalPerms");
    if (originalPerms) {
      unlockPromises.push(
        channel.permissionOverwrites.edit(guild.roles.everyone, originalPerms),
      );
      await channel.setProperty("originalPerms", null);
    } else {
      unlockPromises.push(
        channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null,
          AddReactions: null,
          CreatePublicThreads: null,
          CreatePrivateThreads: null,
        }),
      );
    }
  }

  await Promise.all(unlockPromises);
  return channels.size - settings.exemptChannels.length;
}

export function getRaidSeverity(recentJoins, settings) {
  const joinRate = recentJoins.length / (settings.joinTimeWindow / 1000);

  if (joinRate >= settings.joinThreshold * 2) return "SEVERE";
  if (joinRate >= settings.joinThreshold) return "MODERATE";
  return "LOW";
}

export function isSuspiciousMessagePattern(messages, settings) {
  if (messages.length < 3) return false;

  const uniqueContents = new Set(messages.map((m) => m.content));
  if (uniqueContents.size === 1 && messages.length >= 3) return true;

  const totalMentions = messages.reduce(
    (sum, msg) => sum + (msg.mentions.users.size + msg.mentions.roles.size),
    0,
  );
  if (totalMentions >= settings.mentionThreshold) return true;

  const links = messages
    .map((m) => m.content.match(/https?:\/\/[^\s]+/g))
    .filter(Boolean)
    .flat();
  if (new Set(links).size === 1 && links.length >= 3) return true;

  return false;
}

export function getMemberJoinStats(members) {
  const joinTimes = members.map((m) => m.joinedTimestamp).sort((a, b) => a - b);
  const intervals = [];

  for (let i = 1; i < joinTimes.length; i++) {
    intervals.push(joinTimes[i] - joinTimes[i - 1]);
  }

  const averageInterval =
    intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce(
      (sum, int) => sum + Math.pow(int - averageInterval, 2),
      0,
    ) / intervals.length,
  );

  return {
    total: members.length,
    averageInterval,
    stdDev,
    isUnnatural: stdDev < averageInterval / 2 && intervals.length > 5,
  };
}

export async function banSuspiciousMembers(guild, members, reason) {
  const banPromises = members.map((member) =>
    guild.members
      .ban(member, { reason, deleteMessageSeconds: 604800 })
      .catch((error) =>
        console.error(`Failed to ban ${member.user.tag}:`, error),
      ),
  );

  const results = await Promise.allSettled(banPromises);
  return results.filter((r) => r.status === "fulfilled").length;
}

export async function kickSuspiciousMembers(guild, members, reason) {
  const kickPromises = members.map((member) =>
    member
      .kick(reason)
      .catch((error) =>
        console.error(`Failed to kick ${member.user.tag}:`, error),
      ),
  );

  const results = await Promise.allSettled(kickPromises);
  return results.filter((r) => r.status === "fulfilled").length;
}
