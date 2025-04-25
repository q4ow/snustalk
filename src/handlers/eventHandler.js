import { LogHandler } from "./loggingHandler.js";
import { AuditLogEvent } from "discord.js";
import { formatDuration } from "../utils/moderation.js";

export function setupLoggingEvents(client) {
  const logger = new LogHandler(client);
  const voiceStates = new Map();

  logger
    .initialize()
    .then(() => {
    })
    .catch((error) => {
      console.error("Failed to initialize logger:", error);
    });

  client.on("guildMemberAdd", async (member) => {
    logger.createLog("MEMBER", {
      action: "JOIN",
      member,
    });

    if (client.antiRaid) {
      await client.antiRaid.handleMemberJoin(member);
    }
  });

  client.on("guildMemberRemove", (member) => {
    logger.createLog("MEMBER", {
      action: "LEAVE",
      member,
    });
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 1,
      });

      const auditEntry = auditLogs.entries.first();
      const moderator = auditEntry?.executor || "Unknown";

      logger.createLog("MEMBER", {
        action: "NICKNAME",
        member: newMember,
        oldNick: oldMember.nickname,
        newNick: newMember.nickname,
        moderator: moderator,
      });
    }

    if (oldMember.premiumSince !== newMember.premiumSince) {
      if (!oldMember.premiumSince && newMember.premiumSince) {
        logger.createLog("BOOST", {
          action: "BOOST_START",
          member: newMember,
          since: newMember.premiumSince,
          boostCount: newMember.guild.premiumSubscriptionCount,
          premiumTier: newMember.guild.premiumTier,
        });
      } else if (oldMember.premiumSince && !newMember.premiumSince) {
        const duration = Date.now() - oldMember.premiumSince.getTime();
        logger.createLog("BOOST", {
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
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logger.createLog("ROLE", {
        action: "MEMBER_ROLES_UPDATE",
        member: newMember,
        added: addedRoles.size > 0 ? [...addedRoles.values()] : null,
        removed: removedRoles.size > 0 ? [...removedRoles.values()] : null,
        executor,
      });
    }
  });

  client.on("userUpdate", (oldUser, newUser) => {
    if (oldUser.username !== newUser.username) {
      logger.createLog("USER", {
        action: "USERNAME_CHANGE",
        user: newUser,
        oldUsername: oldUser.username,
        newUsername: newUser.username,
      });
    }
    if (oldUser.avatar !== newUser.avatar) {
      logger.createLog("USER", {
        action: "AVATAR_CHANGE",
        user: newUser,
        oldAvatar: oldUser.displayAvatarURL(),
        newAvatar: newUser.displayAvatarURL(),
      });
    }
    if (oldUser.discriminator !== newUser.discriminator) {
      logger.createLog("USER", {
        action: "DISCRIMINATOR_CHANGE",
        user: newUser,
        oldDiscriminator: oldUser.discriminator,
        newDiscriminator: newUser.discriminator,
      });
    }
  });

  client.on("messageDelete", (message) => {
    if (message.author?.bot) return;
    logger.createLog("MESSAGE", {
      action: "DELETE",
      message,
    });
  });

  client.on("messageUpdate", (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const oldContent = oldMessage.content || "Empty message";
    const newContent = newMessage.content || "Empty message";

    logger.createLog("MESSAGE", {
      action: "EDIT",
      message: newMessage,
      oldContent: oldContent,
      newContent: newContent,
    });
  });

  client.on("messageDeleteBulk", (messages) => {
    logger.createLog("MESSAGE", {
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

    logger.createLog("MESSAGE", {
      action: "REACTION_ADD",
      message,
      user,
      emoji: reaction.emoji,
    });
  });

  client.on("messageReactionRemove", async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;

    logger.createLog("MESSAGE", {
      action: "REACTION_REMOVE",
      message,
      user,
      emoji: reaction.emoji,
    });
  });

  client.on("channelPinsUpdate", (channel, time) => {
    logger.createLog("MESSAGE", {
      action: "PINS_UPDATE",
      channel,
      time,
    });
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    const userId = oldState.member.id || newState.member.id;

    if (!oldState.channelId && newState.channelId) {
      voiceStates.set(userId, Date.now());

      logger.createLog("VOICE", {
        action: "JOIN",
        member: newState.member,
        channel: newState.channel,
      });
    } else if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceStates.get(userId);
      const duration = joinTime ? Date.now() - joinTime : 0;
      voiceStates.delete(userId);

      logger.createLog("VOICE", {
        action: "LEAVE",
        member: oldState.member,
        channel: oldState.channel,
        duration: duration,
      });
    } else if (oldState.channelId !== newState.channelId) {
      voiceStates.set(userId, Date.now());

      logger.createLog("VOICE", {
        action: "MOVE",
        member: newState.member,
        oldChannel: oldState.channel,
        newChannel: newState.channel,
      });
    }
  });

  client.on("channelCreate", async (channel) => {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 1,
    });
    const executor = auditLogs.entries.first()?.executor;

    logger.createLog("CHANNEL", {
      action: "CREATE",
      channel,
      executor,
    });
  });

  client.on("channelDelete", async (channel) => {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 1,
    });
    const executor = auditLogs.entries.first()?.executor;

    logger.createLog("CHANNEL", {
      action: "DELETE",
      channel,
      executor,
    });
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
      const auditLogs = await newChannel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logger.createLog("CHANNEL", {
        action: "UPDATE",
        oldChannel,
        newChannel,
        changes,
        executor,
      });
    }
  });

  client.on("threadCreate", async (thread) => {
    const creator = (await thread.fetchOwner())?.user;
    logger.createLog("THREAD", {
      action: "CREATE",
      thread,
      creator,
    });
  });

  client.on("threadDelete", (thread) => {
    logger.createLog("THREAD", {
      action: "DELETE",
      thread,
    });
  });

  client.on("threadUpdate", async (oldThread, newThread) => {
    if (oldThread.archived !== newThread.archived) {
      const auditLogs = await newThread.guild.fetchAuditLogs({
        type: AuditLogEvent.ThreadUpdate,
        limit: 1,
      });
      const executor = auditLogs.entries.first()?.executor;

      logger.createLog("THREAD", {
        action: "ARCHIVE",
        thread: newThread,
        archived: newThread.archived,
        executor,
      });
    }
  });

  client.on("roleCreate", async (role) => {
    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleCreate,
      limit: 1,
    });
    const executor = auditLogs.entries.first()?.executor;

    logger.createLog("ROLE", {
      action: "CREATE",
      role,
      executor,
    });
  });

  client.on("roleDelete", async (role) => {
    const auditLogs = await role.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleDelete,
      limit: 1,
    });
    const executor = auditLogs.entries.first()?.executor;

    logger.createLog("ROLE", {
      action: "DELETE",
      role,
      executor,
    });
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1,
    });
    const executor = auditLogs.entries.first()?.executor;

    const changes = {};
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
      logger.createLog("ROLE", {
        action: "UPDATE",
        role: newRole,
        changes,
        executor,
      });
    }
  });

  client.on("emojiCreate", (emoji) => {
    logger.createLog("SERVER", {
      action: "EMOJI_CREATE",
      emoji,
    });
  });

  client.on("emojiDelete", (emoji) => {
    logger.createLog("SERVER", {
      action: "EMOJI_DELETE",
      emoji,
    });
  });

  client.on("emojiUpdate", (oldEmoji, newEmoji) => {
    logger.createLog("SERVER", {
      action: "EMOJI_UPDATE",
      oldEmoji,
      newEmoji,
    });
  });

  client.on("inviteCreate", (invite) => {
    logger.createLog("INVITE", {
      action: "CREATE",
      creator: invite.inviter,
      channel: invite.channel,
      code: invite.code,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    });
  });

  client.on("inviteDelete", (invite) => {
    logger.createLog("INVITE", {
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
      logger.createLog("FILE", {
        action: "UPLOAD",
        user: message.author,
        channel: message.channel,
        files: message.attachments.map((att) => ({
          name: att.name,
          url: att.url,
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
