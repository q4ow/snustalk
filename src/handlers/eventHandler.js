import { LogHandler } from "./loggingHandler.js";

export function setupLoggingEvents(client) {
  console.log("Setting up logging events...");
  const logger = new LogHandler(client);

  logger
    .initialize()
    .then(() => {
      console.log("Logger initialized successfully");
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
      logger.createLog("MEMBER", {
        action: "USERNAME",
        user: newUser,
        oldUsername: oldUser.username,
        newUsername: newUser.username,
      });
    }
    if (oldUser.avatar !== newUser.avatar) {
      logger.createLog("MEMBER", {
        action: "AVATAR",
        user: newUser,
        oldAvatar: oldUser.displayAvatarURL(),
        newAvatar: newUser.displayAvatarURL(),
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

  client.on("channelCreate", (channel) => {
    logger.createLog("CHANNEL", {
      action: "CREATE",
      channel,
    });
  });

  client.on("channelDelete", (channel) => {
    logger.createLog("CHANNEL", {
      action: "DELETE",
      channel,
    });
  });

  client.on("channelUpdate", (oldChannel, newChannel) => {
    logger.createLog("CHANNEL", {
      action: "UPDATE",
      oldChannel,
      newChannel,
    });
  });

  client.on("threadCreate", async (thread) => {
    const creator = (await thread.fetchOwner()).user;
    logger.createLog("CHANNEL", {
      action: "THREAD_CREATE",
      thread,
      creator,
    });
  });

  client.on("threadDelete", (thread) => {
    logger.createLog("CHANNEL", {
      action: "THREAD_DELETE",
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

      logger.createLog("CHANNEL", {
        action: "THREAD_UPDATE",
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
    logger.createLog("SERVER", {
      action: "INVITE_CREATE",
      creator: invite.inviter,
      channel: invite.channel,
      code: invite.code,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    });
  });

  client.on("inviteDelete", (invite) => {
    logger.createLog("SERVER", {
      action: "INVITE_DELETE",
      code: invite.code,
      creator: invite.inviter,
      uses: invite.uses,
    });
  });
}
