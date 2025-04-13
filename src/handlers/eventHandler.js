import { LogHandler } from "./loggingHandler.js";

export function setupLoggingEvents(client) {
  const logger = new LogHandler(client);
  logger.initialize();

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

  client.on("guildMemberUpdate", (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
      logger.createLog("MEMBER", {
        action: "NICKNAME",
        member: newMember,
        oldNick: oldMember.nickname,
        newNick: newMember.nickname,
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
    logger.createLog("SERVER", {
      action: "CHANNEL_CREATE",
      channel,
    });
  });

  client.on("channelDelete", (channel) => {
    logger.createLog("SERVER", {
      action: "CHANNEL_DELETE",
      channel,
    });
  });

  client.on("emojiCreate", (emoji) => {
    logger.createLog("SERVER", {
      action: "EMOJI_UPDATE",
      type: "Created",
      emoji,
    });
  });

  client.on("emojiDelete", (emoji) => {
    logger.createLog("SERVER", {
      action: "EMOJI_UPDATE",
      type: "Deleted",
      emoji,
    });
  });

  client.on("roleCreate", (role) => {
    logger.createLog("ROLE", {
      action: "ROLE_CREATE",
      role,
    });
  });

  client.on("roleDelete", (role) => {
    logger.createLog("ROLE", {
      action: "ROLE_DELETE",
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
        action: "ROLE_UPDATE",
        role: newRole,
        changes,
      });
    }
  });

  client.on("threadCreate", async (thread) => {
    const creator = (await thread.fetchOwner()).user;
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
