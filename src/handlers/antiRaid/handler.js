import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../utils/database.js";
import * as RaidProtection from "../../utils/raidProtection.js";
import { LogHandler } from "../loggingHandler.js";

export class AntiRaidHandler {
  constructor(client) {
    this.client = client;
    this.logger = new LogHandler(client);
    this.activeRaids = new Map();
    this.recentJoins = new Map();
    this.messageCache = new Map();
    this.isLocked = new Map();
  }

  async initialize() {
    setInterval(
      () => {
        this.client.guilds.cache.forEach(async (guild) => {
          await db.cleanOldJoinData(guild.id);
        });
      },
      24 * 60 * 60 * 1000,
    );

    console.log("✅ Anti-raid handler initialized");
  }

  async handleMemberJoin(member) {
    const settings = await db.getRaidProtectionSettings(member.guild.id);
    if (!settings.enabled) return;

    if (RaidProtection.isExemptFromRaidProtection(member, settings)) return;

    await db.trackJoinVelocity(member.guild.id, member.id, new Date());
    const recentJoins = await db.getRecentJoins(
      member.guild.id,
      settings.joinTimeWindow,
    );

    const severity = RaidProtection.getRaidSeverity(recentJoins, settings);
    if (severity !== "LOW") {
      await this.handlePotentialRaid(
        member.guild,
        severity,
        recentJoins,
        settings,
      );
    }

    if (RaidProtection.isUserSuspicious(member, settings)) {
      await this.handleSuspiciousMember(member, settings, "New account");
    }

    const similarMembers = RaidProtection.findSimilarUsernames(
      recentJoins
        .map((j) => member.guild.members.cache.get(j.user_id))
        .filter(Boolean),
      settings.similarNameThreshold,
    );

    if (similarMembers.size > 0) {
      await this.handleSimilarUsernames(member.guild, similarMembers, settings);
    }
  }

  async handlePotentialRaid(guild, severity, recentJoins, settings) {
    const raidId = Date.now().toString();
    if (this.activeRaids.has(guild.id)) return;

    this.activeRaids.set(guild.id, raidId);

    const incident = {
      type: "RAID_DETECTED",
      severity,
      details: `Detected ${recentJoins.length} joins in ${settings.joinTimeWindow / 1000}s`,
      action: settings.actionType,
      affectedUsers: recentJoins.map((j) => j.user_id),
    };

    await db.logRaidIncident(guild.id, incident);

    this.logger.createLog("RAID", {
      action: "RAID_DETECTED",
      joins: recentJoins.length,
      timeWindow: settings.joinTimeWindow,
      users: recentJoins.map((join) => guild.members.cache.get(join.user_id)),
      actionType: settings.actionType,
    });

    const embed = new EmbedBuilder()
      .setTitle("🚨 Raid Detection Alert")
      .setColor("#FF0000")
      .setDescription(
        `A potential raid has been detected with ${severity} severity!`,
      )
      .addFields(
        {
          name: "Join Rate",
          value: `${recentJoins.length} joins in ${settings.joinTimeWindow / 1000}s`,
          inline: true,
        },
        {
          name: "Action",
          value: settings.actionType.toUpperCase(),
          inline: true,
        },
      )
      .setTimestamp();

    switch (settings.actionType) {
      case "lockdown":
        const lockedChannels = await RaidProtection.lockdownServer(
          guild,
          settings,
          "Raid protection lockdown",
        );
        embed.addFields({
          name: "Channels Locked",
          value: lockedChannels.toString(),
        });

        setTimeout(
          () => this.endLockdown(guild, settings),
          settings.lockdownDuration,
        );
        this.isLocked.set(guild.id, true);
        break;

      case "ban":
        const recentMembers = recentJoins
          .map((j) => guild.members.cache.get(j.user_id))
          .filter(Boolean);
        const bannedCount = await RaidProtection.banSuspiciousMembers(
          guild,
          recentMembers,
          "Mass join raid detection",
        );
        embed.addFields({
          name: "Members Banned",
          value: bannedCount.toString(),
        });
        break;

      case "kick":
        const kickedCount = await RaidProtection.kickSuspiciousMembers(
          guild,
          recentJoins
            .map((j) => guild.members.cache.get(j.user_id))
            .filter(Boolean),
          "Mass join raid detection",
        );
        embed.addFields({
          name: "Members Kicked",
          value: kickedCount.toString(),
        });
        break;
    }

    if (settings.alertChannel) {
      const channel = await guild.channels.fetch(settings.alertChannel);
      if (channel) {
        if (settings.notifyRole) {
          await channel.send(`<@&${settings.notifyRole}>`);
        }
        await channel.send({ embeds: [embed] });
      }
    }

    setTimeout(() => {
      this.activeRaids.delete(guild.id);
    }, settings.autoModeDuration);
  }

  async handleSuspiciousMember(member, settings, reason) {
    if (settings.actionType === "ban") {
      await member.ban({ reason, deleteMessageSeconds: 604800 });
    } else if (settings.actionType === "kick") {
      await member.kick(reason);
    }

    const incident = {
      type: "SUSPICIOUS_MEMBER",
      details: reason,
      action: settings.actionType,
      affectedUsers: [member.id],
    };

    await db.logRaidIncident(member.guild.id, incident);

    this.logger.createLog("RAID", {
      action: "SUSPICIOUS_MEMBER",
      reason: reason,
      actionType: settings.actionType,
      affectedUsers: [member.id],
    });
  }

  async handleSimilarUsernames(guild, similarGroups, settings) {
    for (const [groupId, members] of similarGroups) {
      if (members.length < 3) continue;

      const incident = {
        type: "SIMILAR_USERNAMES",
        details: `Detected ${members.length} members with similar usernames`,
        action: settings.actionType,
        affectedUsers: members.map((m) => m.id),
      };

      await db.logRaidIncident(guild.id, incident);

      this.logger.createLog("RAID", {
        action: "SIMILAR_USERNAMES",
        details: `Detected ${members.length} members with similar usernames`,
        actionType: settings.actionType,
        affectedUsers: members.map((m) => m.id),
      });

      switch (settings.actionType) {
        case "ban":
          await RaidProtection.banSuspiciousMembers(
            guild,
            members,
            "Similar username raid detection",
          );
          break;
        case "kick":
          await RaidProtection.kickSuspiciousMembers(
            guild,
            members,
            "Similar username raid detection",
          );
          break;
      }
    }
  }

  async endLockdown(guild, settings) {
    if (!this.isLocked.get(guild.id)) return;

    const unlockedChannels = await RaidProtection.unlockServer(guild, settings);
    this.isLocked.delete(guild.id);

    if (settings.alertChannel) {
      const channel = await guild.channels.fetch(settings.alertChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle("🔓 Server Unlocked")
          .setColor("#00FF00")
          .setDescription("The server lockdown has been lifted.")
          .addFields({
            name: "Channels Unlocked",
            value: unlockedChannels.toString(),
          })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    }

    this.logger.createLog("RAID", {
      action: "LOCKDOWN_ENDED",
      reason: "Automatic raid mode timeout",
    });
  }

  async handleMessage(message) {
    if (message.author.bot || !message.guild) return;

    const settings = await db.getRaidProtectionSettings(message.guild.id);
    if (!settings.enabled) return;

    if (RaidProtection.isExemptFromRaidProtection(message.member, settings))
      return;

    const userMessages = this.messageCache.get(message.author.id) || [];
    userMessages.push(message);
    if (userMessages.length > 10) userMessages.shift();
    this.messageCache.set(message.author.id, userMessages);

    if (RaidProtection.isSuspiciousMessagePattern(userMessages, settings)) {
      await this.handleSuspiciousMember(
        message.member,
        settings,
        "Suspicious message pattern",
      );

      this.messageCache.delete(message.author.id);
    }
  }
}
