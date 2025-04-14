import { LogHandler } from "./loggingHandler.js";
import { AuditLogEvent } from "discord.js";

export function setupLoggingEvents(client) {
  const logger = new LogHandler(client);

  logger
    .initialize()
    .then(() => {
      console.log("✅ Logger initialized successfully");
    })
    .catch((error) => {
      console.error("Failed to initialize logger:", error);
    });

  client.on("guildMemberAdd", (member) => {
    logger.createLog("MEMBER", {
      action: "JOIN",
      member,
    });
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

    logger.createLog("MESSAGE", {
      action: "EDIT",
      message: newMessage,
      oldContent: oldMessage.content,
      newContent: newMessage.content,
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
    if (!oldState.channelId && newState.channelId) {
      logger.createLog("VOICE", {
        action: "JOIN",
        member: newState.member,
        channel: newState.channel,
      });
    } else if (oldState.channelId && !newState.channelId) {
      logger.createLog("VOICE", {
        action: "LEAVE",
        member: oldState.member,
        channel: oldState.channel,
        duration: Date.now() - oldState.member.voice.joinedTimestamp,
      });
    } else if (oldState.channelId !== newState.channelId) {
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

  client.on("roleCreate", (role) => {
    logger.createLog("ROLE", {
      action: "CREATE",
      role,
    });
  });

  client.on("roleDelete", (role) => {
    logger.createLog("ROLE", {
      action: "DELETE",
      role,
    });
  });

  client.on("roleUpdate", (oldRole, newRole) => {
    const changes = {};
    if (oldRole.name !== newRole.name) {
      changes.name = { old: oldRole.name, new: newRole.name };
    }
    if (oldRole.color !== newRole.color) {
      changes.color = { old: oldRole.hexColor, new: newRole.hexColor };
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.permissions = {
        old: oldRole.permissions.toArray().join(", "),
        new: newRole.permissions.toArray().join(", "),
      };
    }

    if (Object.keys(changes).length > 0) {
      logger.createLog("ROLE", {
        action: "UPDATE",
        role: newRole,
        changes,
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
}
