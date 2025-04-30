import { LogHandler } from "./loggingHandler.js";
import { AuditLogEvent } from "discord.js";
import { formatDuration } from "../utils/moderation.js";
import { logger } from "../utils/logger.js";

export function setupLoggingEvents(client) {
  const logHandler = new LogHandler(client);
  const voiceStates = new Map();

  logHandler
    .initialize()
    .then(() => {
      logger.info("Logging events initialized");
    })
    .catch((error) => {
      logger.error("Failed to initialize logger:", error);
    });

  client.on("guildMemberAdd", async (member) => {
    logHandler.createLog("MEMBER", {
      action: "JOIN",
      member,
    });

    if (client.antiRaid) {
      await client.antiRaid.handleMemberJoin(member);
    }
  });

  client.on("guildMemberRemove", (member) => {
    logHandler.createLog("MEMBER", {
      action: "LEAVE",
      member,
    });
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberUpdate,
          limit: 1,
        });

        const auditEntry = auditLogs.entries.first();
        const moderator = auditEntry?.executor || "Unknown";

        logHandler.createLog("MEMBER", {
          action: "NICKNAME",
          member: newMember,
          oldNick: oldMember.nickname,
          newNick: newMember.nickname,
          moderator: moderator,
        });
      } catch (error) {
        logger.error(
          `Failed to fetch audit logs for nickname change of ${newMember.user.tag}:`,
          error,
        );
        // Still log the change without moderator info
        logHandler.createLog("MEMBER", {
          action: "NICKNAME",
          member: newMember,
          oldNick: oldMember.nickname,
          newNick: newMember.nickname,
          moderator: "Unknown",
        });
      }
    }

    if (oldMember.premiumSince !== newMember.premiumSince) {
      if (!oldMember.premiumSince && newMember.premiumSince) {
        logHandler.createLog("BOOST", {
          action: "BOOST_START",
          member: newMember,
          since: newMember.premiumSince,
          boostCount: newMember.guild.premiumSubscriptionCount,
          premiumTier: newMember.guild.premiumTier,
        });
      } else if (oldMember.premiumSince && !newMember.premiumSince) {
        const duration = Date.now() - oldMember.premiumSince.getTime();
        logHandler.createLog("BOOST", {
          action: "BOOST_END",
          member: newMember,
          duration: duration,
          boostCount: newMember.guild.premiumSubscriptionCount,
          premiumTier: newMember.guild.premiumTier,
        });
      }
    }

    const addedRoles = newMember.roles.cache.filter(
      (role) => !oldMember.roles.cache.has(role.id),
    );
    const removedRoles = oldMember.roles.cache.filter(
      (role) => !newMember.roles.cache.has(role.id),
    );

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberRoleUpdate,
          limit: 1,
        });
        const executor = auditLogs.entries.first()?.executor;

        logHandler.createLog("ROLE", {
          action: "MEMBER_ROLES_UPDATE",
          member: newMember,
          added: addedRoles.size > 0 ? [...addedRoles.values()] : null,
          removed: removedRoles.size > 0 ? [...removedRoles.values()] : null,
          executor,
        });
      } catch (error) {
        logger.error(
          `Failed to fetch audit logs for role update of ${newMember.user.tag}:`,
          error,
        );
        logHandler.createLog("ROLE", {
          action: "MEMBER_ROLES_UPDATE",
          member: newMember,
          added: addedRoles.size > 0 ? [...addedRoles.values()] : null,
          removed: removedRoles.size > 0 ? [...removedRoles.values()] : null,
          executor: null,
        });
      }
    }
  });

  client.on("userUpdate", (oldUser, newUser) => {
    if (oldUser.username !== newUser.username) {
      logHandler.createLog("USER", {
        action: "USERNAME_CHANGE",
        user: newUser,
        oldUsername: oldUser.username,
        newUsername: newUser.username,
      });
    }
    if (oldUser.avatar !== newUser.avatar) {
      logHandler.createLog("USER", {
        action: "AVATAR_CHANGE",
        user: newUser,
        oldAvatar: oldUser.displayAvatarURL(),
        newAvatar: newUser.displayAvatarURL(),
      });
    }
    if (oldUser.discriminator !== newUser.discriminator) {
      logHandler.createLog("USER", {
        action: "DISCRIMINATOR_CHANGE",
        user: newUser,
        oldDiscriminator: oldUser.discriminator,
        newDiscriminator: newUser.discriminator,
      });
    }
  });

  client.on("messageDelete", (message) => {
    if (message.author?.bot) return;
    logHandler.createLog("MESSAGE", {
      action: "DELETE",
      message,
    });
  });

  client.on("messageUpdate", (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const oldContent = oldMessage.content || "Empty message";
    const newContent = newMessage.content || "Empty message";

    logHandler.createLog("MESSAGE", {
      action: "EDIT",
      message: newMessage,
      oldContent: oldContent,
      newContent: newContent,
    });
  });

  client.on("messageDeleteBulk", (messages) => {
    logHandler.createLog("MESSAGE", {
      action: "BULK_DELETE",
      channel: messages.first().channel,
      count: messages.size,
      authors: [...new Set(messages.map((m) => m.author))],
      oldestMessage: messages
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .first(),
      newestMessage: messages
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .first(),
    });
  });

  client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;

    logHandler.createLog("MESSAGE", {
      action: "REACTION_ADD",
      message,
      user,
      emoji: reaction.emoji,
    });
  });

  client.on("messageReactionRemove", async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;

    logHandler.createLog("MESSAGE", {
      action: "REACTION_REMOVE",
      message,
      user,
      emoji: reaction.emoji,
    });
  });

  client.on("channelPinsUpdate", (channel, time) => {
    logHandler.createLog("MESSAGE", {
      action: "PINS_UPDATE",
      channel,
      time,
    });
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    const userId = oldState.member.id || newState.member.id;

    if (!oldState.channelId && newState.channelId) {
      voiceStates.set(userId, Date.now());

      logHandler.createLog("VOICE", {
        action: "JOIN",
        member: newState.member,
        channel: newState.channel,
      });
    } else if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceStates.get(userId);
      const duration = joinTime ? Date.now() - joinTime : 0;
      voiceStates.delete(userId);

      logHandler.createLog("VOICE", {
        action: "LEAVE",
        member: oldState.member,
        channel: oldState.channel,
        duration: duration,
      });
    } else if (oldState.channelId !== newState.channelId) {
      voiceStates.set(userId, Date.now());

      logHandler.createLog("VOICE", {
        action: "MOVE",
        member: newState.member,
        oldChannel: oldState.channel,
        newChannel: newState.channel,
      });
    }
  });

  client.on("channelCreate", async (channel) => {
    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logHandler.createLog("CHANNEL", {
        action: "CREATE",
        channel,
        executor,
      });
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for channel creation ${channel.name}:`,
        error,
      );
      logHandler.createLog("CHANNEL", {
        action: "CREATE",
        channel,
        executor: null,
      });
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logHandler.createLog("CHANNEL", {
        action: "DELETE",
        channel,
        executor,
      });
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for channel deletion ${channel.name}:`,
        error,
      );
      logHandler.createLog("CHANNEL", {
        action: "DELETE",
        channel,
        executor: null,
      });
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push(`Name: ${oldChannel.name} → ${newChannel.name}`);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(
        `Topic: ${oldChannel.topic || "None"} → ${newChannel.topic || "None"}`,
      );
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`NSFW: ${oldChannel.nsfw} → ${newChannel.nsfw}`);
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(
        `Slowmode: ${formatDuration(oldChannel.rateLimitPerUser * 1000)} → ${formatDuration(newChannel.rateLimitPerUser * 1000)}`,
      );
    }

    if (changes.length > 0) {
      try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelUpdate,
          limit: 1,
        });
        const executor = auditLogs.entries.first()?.executor;

        logHandler.createLog("CHANNEL", {
          action: "UPDATE",
          oldChannel,
          newChannel,
          changes,
          executor,
        });
      } catch (error) {
        logger.error(
          `Failed to fetch audit logs for channel update ${newChannel.name}:`,
          error,
        );
        logHandler.createLog("CHANNEL", {
          action: "UPDATE",
          oldChannel,
          newChannel,
          changes,
          executor: null,
        });
      }
    }
  });

  client.on("threadCreate", async (thread) => {
    const creator = (await thread.fetchOwner())?.user;
    logHandler.createLog("THREAD", {
      action: "CREATE",
      thread,
      creator,
    });
  });

  client.on("threadDelete", (thread) => {
    logHandler.createLog("THREAD", {
      action: "DELETE",
      thread,
    });
  });

  client.on("threadUpdate", async (oldThread, newThread) => {
    if (oldThread.archived !== newThread.archived) {
      try {
        const auditLogs = await newThread.guild.fetchAuditLogs({
          type: AuditLogEvent.ThreadUpdate,
          limit: 1,
        });
        const executor = auditLogs.entries.first()?.executor;

        logHandler.createLog("THREAD", {
          action: "ARCHIVE",
          thread: newThread,
          archived: newThread.archived,
          executor,
        });
      } catch (error) {
        logger.error(
          `Failed to fetch audit logs for thread update ${newThread.name}:`,
          error,
        );
        logHandler.createLog("THREAD", {
          action: "ARCHIVE",
          thread: newThread,
          archived: newThread.archived,
          executor: null,
        });
      }
    }
  });

  client.on("roleCreate", async (role) => {
    try {
      const auditLogs = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleCreate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logHandler.createLog("ROLE", {
        action: "CREATE",
        role,
        executor,
      });
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for role creation ${role.name}:`,
        error,
      );
      logHandler.createLog("ROLE", {
        action: "CREATE",
        role,
        executor: null,
      });
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      const auditLogs = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleDelete,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logHandler.createLog("ROLE", {
        action: "DELETE",
        role,
        executor,
      });
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for role deletion ${role.name}:`,
        error,
      );
      logHandler.createLog("ROLE", {
        action: "DELETE",
        role,
        executor: null,
      });
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    const changes = {};
    try {
      const auditLogs = await newRole.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;
      if (oldRole.name !== newRole.name) {
        changes.name = { old: oldRole.name, new: newRole.name };
      }
      if (oldRole.color !== newRole.color) {
        changes.color = { old: oldRole.hexColor, new: newRole.hexColor };
      }
      if (oldRole.hoist !== newRole.hoist) {
        changes.hoist = { old: oldRole.hoist, new: newRole.hoist };
      }
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.mentionable = {
          old: oldRole.mentionable,
          new: newRole.mentionable,
        };
      }
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const oldPerms = oldRole.permissions.toArray();
        const newPerms = newRole.permissions.toArray();
        changes.permissions = {
          added: newPerms.filter((p) => !oldPerms.includes(p)),
          removed: oldPerms.filter((p) => !newPerms.includes(p)),
        };
      }

      if (Object.keys(changes).length > 0) {
        logHandler.createLog("ROLE", {
          action: "UPDATE",
          role: newRole,
          changes,
          executor,
        });
      }
    } catch (error) {
      logger.error(
        `Failed to fetch audit logs for role update ${newRole.name}:`,
        error,
      );
      if (Object.keys(changes).length > 0) {
        logHandler.createLog("ROLE", {
          action: "UPDATE",
          role: newRole,
          changes,
          executor: null,
        });
      }
    }
  });

  client.on("emojiCreate", (emoji) => {
    logHandler.createLog("SERVER", {
      action: "EMOJI_CREATE",
      emoji,
    });
  });

  client.on("emojiDelete", (emoji) => {
    logHandler.createLog("SERVER", {
      action: "EMOJI_DELETE",
      emoji,
    });
  });

  client.on("emojiUpdate", (oldEmoji, newEmoji) => {
    logHandler.createLog("SERVER", {
      action: "EMOJI_UPDATE",
      oldEmoji,
      newEmoji,
    });
  });

  client.on("inviteCreate", (invite) => {
    logHandler.createLog("INVITE", {
      action: "CREATE",
      creator: invite.inviter,
      channel: invite.channel,
      code: invite.code,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    });
  });

  client.on("inviteDelete", (invite) => {
    logHandler.createLog("INVITE", {
      action: "DELETE",
      code: invite.code,
      creator: invite.inviter,
      uses: invite.uses,
    });
  });

  client.on("messageCreate", async (message) => {
    if (
      message.attachments &&
      message.attachments.size > 0 &&
      !message.author.bot
    ) {
      const attachments = [...message.attachments.values()];
      logHandler.createLog("FILE", {
        action: "FILE",
        user: message.author,
        channel: message.channel,
        files: attachments.map((att) => ({
          name: att.name,
          url: att.proxyURL || att.url,
          contentType: att.contentType,
        })),
        messageContent: message.content,
        message,
      });
    }

    if (client.antiRaid) {
      await client.antiRaid.handleMessage(message);
    }
  });
}
