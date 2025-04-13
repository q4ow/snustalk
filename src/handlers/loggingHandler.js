import { EmbedBuilder } from "discord.js";
import { formatDuration } from "../utils/moderation.js";

const LOG_TYPES = {
  MEMBER: {
    color: "#3498db",
    channelEnv: "MEMBER_LOGS_CHANNEL_ID",
    emoji: "👥",
  },
  MESSAGE: {
    color: "#e74c3c",
    channelEnv: "MESSAGE_LOGS_CHANNEL_ID",
    emoji: "📝",
  },
  MOD: {
    color: "#e67e22",
    channelEnv: "MOD_LOGS_CHANNEL_ID",
    emoji: "🔨",
  },
  VOICE: {
    color: "#2ecc71",
    channelEnv: "VOICE_LOGS_CHANNEL_ID",
    emoji: "🎤",
  },
  CHANNEL: {
    color: "#9b59b6",
    channelEnv: "CHANNEL_LOGS_CHANNEL_ID",
    emoji: "#️⃣",
  },
  ROLE: {
    color: "#f1c40f",
    channelEnv: "ROLE_LOGS_CHANNEL_ID",
    emoji: "🎭",
  },
  SERVER: {
    color: "#34495e",
    channelEnv: "SERVER_LOGS_CHANNEL_ID",
    emoji: "🖥️",
  },
  USER: {
    color: "#1abc9c",
    channelEnv: "USER_LOGS_CHANNEL_ID",
    emoji: "👤",
  },
  INVITE: {
    color: "#8e44ad",
    channelEnv: "INVITE_LOGS_CHANNEL_ID",
    emoji: "📨",
  },
  THREAD: {
    color: "#2c3e50",
    channelEnv: "THREAD_LOGS_CHANNEL_ID",
    emoji: "🧵",
  },
};

class LogHandler {
  constructor(client) {
    this.client = client;
    this.channels = new Map();
    this.blacklistedChannels =
      process.env.LOGGING_BLACKLIST_CHANNELS?.split(",") || [];
  }

  isChannelBlacklisted(channelId) {
    return this.blacklistedChannels.includes(channelId);
  }

  async initialize() {
    for (const [type, config] of Object.entries(LOG_TYPES)) {
      const channelId = process.env[config.channelEnv];
      if (!channelId) {
        console.warn(`Warning: No channel ID configured for ${type} logs`);
        continue;
      }

      try {
        const channel = await this.client.channels.fetch(channelId);
        if (channel) {
          this.channels.set(type, channel);
          console.log(`✅ Initialized ${type} logs channel`);
        }
      } catch (error) {
        console.error(`Failed to initialize ${type} logs channel:`, error);
      }
    }
  }

  async createLog(type, data) {
    const channel = this.channels.get(type);
    if (!channel) {
      console.warn(`No channel configured for ${type} logs`);
      return;
    }

    if (
      data.message?.channelId &&
      this.isChannelBlacklisted(data.message.channelId)
    ) {
      console.log(
        `Skipping log for blacklisted channel: ${data.message.channelId}`,
      );
      return;
    }

    if (data.channel?.id && this.isChannelBlacklisted(data.channel.id)) {
      console.log(`Skipping log for blacklisted channel: ${data.channel.id}`);
      return;
    }

    try {
      if (!data || !data.action) {
        console.error(`Invalid log data for ${type}:`, data);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(LOG_TYPES[type].color)
        .setTimestamp()
        .setFooter({ text: `${LOG_TYPES[type].emoji} ${type} Log` });

      switch (type) {
        case "MEMBER":
          this.formatMemberLog(embed, data);
          break;
        case "MESSAGE":
          this.formatMessageLog(embed, data);
          break;
        case "MOD":
          this.formatModerationLog(embed, data);
          break;
        case "VOICE":
          this.formatVoiceLog(embed, data);
          break;
        case "CHANNEL":
          this.formatChannelLog(embed, data);
          break;
        case "ROLE":
          this.formatRoleLog(embed, data);
          break;
        case "SERVER":
          this.formatServerLog(embed, data);
          break;
        case "USER":
          this.formatUserLog(embed, data);
          break;
        case "INVITE":
          this.formatInviteLog(embed, data);
          break;
        case "THREAD":
          this.formatThreadLog(embed, data);
          break;
        default:
          console.warn(`Unknown log type: ${type}`);
          return;
      }

      if (!embed.data.title || !embed.data.fields?.length) {
        console.error(`Invalid embed generated for ${type} log:`, embed);
        return;
      }

      console.log(`Attempting to send ${type} log to channel ${channel.name}`);
      await channel.send({ embeds: [embed] });
      console.log(`Successfully sent ${type} log`);
    } catch (error) {
      console.error(`Failed to send ${type} log:`, error);
      console.error("Full error:", error.stack);
    }
  }

  formatChannelLog(embed, data) {
    switch (data.action) {
      case "CREATE":
        embed.setTitle("📝 Channel Created").addFields(
          { name: "Name", value: data.channel.name, inline: true },
          { name: "Type", value: data.channel.type.toString(), inline: true },
          {
            name: "Category",
            value: data.channel.parent?.name || "None",
            inline: true,
          },
          {
            name: "Created By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
        );
        break;

      case "DELETE":
        embed.setTitle("🗑️ Channel Deleted").addFields(
          { name: "Name", value: data.channel.name, inline: true },
          { name: "Type", value: data.channel.type.toString(), inline: true },
          {
            name: "Category",
            value: data.channel.parent?.name || "None",
            inline: true,
          },
          {
            name: "Deleted By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
        );
        break;

      case "UPDATE":
        const changes = [];
        if (data.oldChannel.name !== data.newChannel.name) {
          changes.push(
            `Name: ${data.oldChannel.name} → ${data.newChannel.name}`,
          );
        }
        if (data.oldChannel.topic !== data.newChannel.topic) {
          changes.push(
            `Topic: ${data.oldChannel.topic || "None"} → ${data.newChannel.topic || "None"}`,
          );
        }
        if (data.oldChannel.nsfw !== data.newChannel.nsfw) {
          changes.push(
            `NSFW: ${data.oldChannel.nsfw} → ${data.newChannel.nsfw}`,
          );
        }
        if (
          data.oldChannel.rateLimitPerUser !== data.newChannel.rateLimitPerUser
        ) {
          changes.push(
            `Slowmode: ${formatDuration(data.oldChannel.rateLimitPerUser * 1000)} → ${formatDuration(data.newChannel.rateLimitPerUser * 1000)}`,
          );
        }
        if (data.oldChannel.parent?.id !== data.newChannel.parent?.id) {
          changes.push(
            `Category: ${data.oldChannel.parent?.name || "None"} → ${data.newChannel.parent?.name || "None"}`,
          );
        }
        if (
          data.oldChannel.permissionOverwrites !==
          data.newChannel.permissionOverwrites
        ) {
          changes.push("Permissions were updated");
        }

        embed.setTitle("📝 Channel Updated").addFields(
          {
            name: "Channel",
            value: data.newChannel.toString(),
            inline: true,
          },
          {
            name: "Updated By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
          {
            name: "Changes",
            value: changes.join("\n") || "No notable changes",
          },
        );
        break;

      case "PINS_UPDATE":
        embed.setTitle("📌 Channel Pins Updated").addFields(
          {
            name: "Channel",
            value: data.channel.toString(),
            inline: true,
          },
          {
            name: "Updated By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
          {
            name: "Time",
            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true,
          },
        );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Channel Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }
    return embed;
  }

  formatMemberLog(embed, data) {
    switch (data.action) {
      case "JOIN":
        embed
          .setTitle("👋 Member Joined")
          .setDescription(`${data.member} joined the server`)
          .addFields(
            {
              name: "Account Created",
              value: `<t:${Math.floor(data.member.user.createdTimestamp / 1000)}:R>`,
              inline: true,
            },
            { name: "Member ID", value: data.member.id, inline: true },
          );
        break;

      case "LEAVE":
        embed
          .setTitle("🚶 Member Left")
          .setDescription(`${data.member} left the server`)
          .addFields(
            {
              name: "Joined At",
              value: `<t:${Math.floor(data.member.joinedTimestamp / 1000)}:R>`,
              inline: true,
            },
            { name: "Member ID", value: data.member.id, inline: true },
          );
        break;

      case "NICKNAME":
        embed.setTitle("📝 Nickname Changed").addFields(
          { name: "Member", value: `${data.member}`, inline: true },
          { name: "Changed By", value: `${data.moderator}`, inline: true },
          {
            name: "Old Nickname",
            value: data.oldNick || "None",
            inline: true,
          },
          {
            name: "New Nickname",
            value: data.newNick || "None",
            inline: true,
          },
        );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Member Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }

    return embed;
  }

  formatMessageLog(embed, data) {
    switch (data.action) {
      case "DELETE":
        embed.setTitle("🗑️ Message Deleted").addFields(
          { name: "Author", value: `${data.message.author}`, inline: true },
          { name: "Channel", value: `${data.message.channel}`, inline: true },
          {
            name: "Content",
            value:
              data.message.content ||
              "No content (possibly embed or attachment)",
          },
        );
        break;

      case "EDIT":
        embed
          .setTitle("✏️ Message Edited")
          .addFields(
            { name: "Author", value: `${data.message.author}`, inline: true },
            { name: "Channel", value: `${data.message.channel}`, inline: true },
            { name: "Before", value: data.oldContent || "Empty message" },
            { name: "After", value: data.newContent || "Empty message" },
          );
        break;

      case "BULK_DELETE":
        embed.setTitle("🗑️ Bulk Messages Deleted").addFields(
          { name: "Channel", value: `${data.channel}`, inline: true },
          { name: "Count", value: `${data.count} messages`, inline: true },
          {
            name: "Authors",
            value: data.authors.map((author) => `${author}`).join(", "),
          },
          {
            name: "Timespan",
            value: `Between ${data.oldestMessage.createdAt.toLocaleString()} and ${data.newestMessage.createdAt.toLocaleString()}`,
          },
        );
        break;

      case "REACTION_ADD":
      case "REACTION_REMOVE":
        embed
          .setTitle(
            `${data.action === "REACTION_ADD" ? "➕" : "➖"} Reaction ${data.action === "REACTION_ADD" ? "Added" : "Removed"}`,
          )
          .addFields(
            { name: "User", value: `${data.user}`, inline: true },
            {
              name: "Message Author",
              value: `${data.message.author}`,
              inline: true,
            },
            { name: "Channel", value: `${data.message.channel}`, inline: true },
            { name: "Emoji", value: `${data.emoji}`, inline: true },
            {
              name: "Message Link",
              value: `[Jump to Message](${data.message.url})`,
            },
          );
        break;

      case "PINS_UPDATE":
        embed.setTitle("📌 Channel Pins Updated").addFields(
          { name: "Channel", value: `${data.channel}`, inline: true },
          {
            name: "Time",
            value: `<t:${Math.floor(data.time.getTime() / 1000)}:F>`,
            inline: true,
          },
        );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Message Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }
    return embed;
  }

  formatVoiceLog(embed, data) {
    switch (data.action) {
      case "JOIN":
        embed
          .setTitle("🎙️ Member Joined Voice")
          .addFields(
            { name: "Member", value: `${data.member}`, inline: true },
            { name: "Channel", value: `${data.channel}`, inline: true },
          );
        break;
      case "LEAVE":
        embed.setTitle("🎙️ Member Left Voice").addFields(
          { name: "Member", value: `${data.member}`, inline: true },
          { name: "Channel", value: `${data.channel}`, inline: true },
          {
            name: "Duration",
            value: formatDuration(data.duration),
            inline: true,
          },
        );
        break;
      case "MOVE":
        embed
          .setTitle("🔄 Member Moved in Voice")
          .addFields(
            { name: "Member", value: `${data.member}`, inline: true },
            { name: "From", value: `${data.oldChannel}`, inline: true },
            { name: "To", value: `${data.newChannel}`, inline: true },
          );
        break;
    }
  }

  formatModerationLog(embed, data) {
    switch (data.action) {
      case "BAN":
        embed
          .setTitle("🔨 Member Banned")
          .addFields(
            { name: "Member", value: `${data.target}`, inline: true },
            { name: "Moderator", value: `${data.moderator}`, inline: true },
            { name: "Reason", value: data.reason || "No reason provided" },
          );
        break;
      case "UNBAN":
        embed
          .setTitle("🔓 Member Unbanned")
          .addFields(
            { name: "Member", value: `${data.target}`, inline: true },
            { name: "Moderator", value: `${data.moderator}`, inline: true },
            { name: "Reason", value: data.reason || "No reason provided" },
          );
        break;
      case "TIMEOUT":
        embed.setTitle("⏰ Member Timed Out").addFields(
          { name: "Member", value: `${data.target}`, inline: true },
          { name: "Moderator", value: `${data.moderator}`, inline: true },
          {
            name: "Duration",
            value: formatDuration(data.duration),
            inline: true,
          },
          { name: "Reason", value: data.reason || "No reason provided" },
        );
        break;
    }
  }

  formatServerLog(embed, data) {
    switch (data.action) {
      case "CHANNEL_CREATE":
        embed.setTitle("📝 Channel Created").addFields(
          { name: "Name", value: data.channel.name, inline: true },
          { name: "Type", value: data.channel.type, inline: true },
          {
            name: "Category",
            value: data.channel.parent?.name || "None",
            inline: true,
          },
        );
        break;
      case "CHANNEL_DELETE":
        embed
          .setTitle("🗑️ Channel Deleted")
          .addFields(
            { name: "Name", value: data.channel.name, inline: true },
            { name: "Type", value: data.channel.type, inline: true },
          );
        break;
      case "EMOJI_UPDATE":
        embed
          .setTitle("😀 Emoji Updated")
          .addFields(
            { name: "Action", value: data.type, inline: true },
            { name: "Emoji", value: data.emoji.toString(), inline: true },
          );
        break;
    }
  }

  formatRoleLog(embed, data) {
    switch (data.action) {
      case "ROLE_CREATE":
        embed.setTitle("✨ Role Created").addFields(
          { name: "Name", value: data.role.name, inline: true },
          { name: "Color", value: data.role.hexColor, inline: true },
          {
            name: "Hoisted",
            value: data.role.hoist ? "Yes" : "No",
            inline: true,
          },
          {
            name: "Mentionable",
            value: data.role.mentionable ? "Yes" : "No",
            inline: true,
          },
        );
        break;

      case "ROLE_DELETE":
        embed
          .setTitle("🗑️ Role Deleted")
          .addFields(
            { name: "Name", value: data.role.name, inline: true },
            { name: "Color", value: data.role.hexColor, inline: true },
          );
        break;

      case "ROLE_UPDATE":
        embed.setTitle("📝 Role Updated").addFields(
          { name: "Role", value: data.role.name, inline: true },
          {
            name: "Changes",
            value: Object.entries(data.changes)
              .map(([key, value]) => `${key}: ${value.old} → ${value.new}`)
              .join("\n"),
          },
        );
        break;

      case "MEMBER_ROLE_ADD":
        embed.setTitle("➕ Role Added to Member").addFields(
          { name: "Member", value: `${data.member}`, inline: true },
          { name: "Added By", value: `${data.moderator}`, inline: true },
          {
            name: "Roles Added",
            value: data.roles.map((role) => role.name).join(", "),
          },
        );
        break;

      case "MEMBER_ROLE_REMOVE":
        embed.setTitle("➖ Role Removed from Member").addFields(
          { name: "Member", value: `${data.member}`, inline: true },
          { name: "Removed By", value: `${data.moderator}`, inline: true },
          {
            name: "Roles Removed",
            value: data.roles.map((role) => role.name).join(", "),
          },
        );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Role Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }
    return embed;
  }

  async formatUserLog(embed, data) {
    switch (data.action) {
      case "USERNAME_CHANGE":
        embed
          .setTitle("Username Changed")
          .addFields(
            { name: "User", value: `${data.user}`, inline: true },
            { name: "Old Username", value: data.oldUsername, inline: true },
            { name: "New Username", value: data.newUsername, inline: true },
          );
        break;
      case "AVATAR_CHANGE":
        embed
          .setTitle("Avatar Changed")
          .setThumbnail(data.newAvatar)
          .addFields({ name: "User", value: `${data.user}`, inline: true });
        if (data.oldAvatar) {
          embed.setImage(data.oldAvatar);
        }
        break;
      case "DISCRIMINATOR_CHANGE":
        embed.setTitle("Discriminator Changed").addFields(
          { name: "User", value: `${data.user}`, inline: true },
          {
            name: "Old Discriminator",
            value: data.oldDiscriminator,
            inline: true,
          },
          {
            name: "New Discriminator",
            value: data.newDiscriminator,
            inline: true,
          },
        );
        break;
    }
  }

  async formatInviteLog(embed, data) {
    switch (data.action) {
      case "CREATE":
        embed.setTitle("Invite Created").addFields(
          { name: "Creator", value: `${data.creator}`, inline: true },
          { name: "Channel", value: `${data.channel}`, inline: true },
          { name: "Code", value: data.code, inline: true },
          {
            name: "Max Uses",
            value: data.maxUses?.toString() || "Unlimited",
            inline: true,
          },
          {
            name: "Expires",
            value: data.expiresAt
              ? `<t:${Math.floor(data.expiresAt.getTime() / 1000)}:R>`
              : "Never",
            inline: true,
          },
        );
        break;
      case "DELETE":
        embed
          .setTitle("Invite Deleted")
          .addFields(
            { name: "Code", value: data.code, inline: true },
            { name: "Creator", value: `${data.creator}`, inline: true },
            { name: "Uses", value: data.uses.toString(), inline: true },
          );
        break;
      case "USE":
        embed
          .setTitle("Invite Used")
          .addFields(
            { name: "User", value: `${data.user}`, inline: true },
            { name: "Invite Code", value: data.code, inline: true },
            { name: "Creator", value: `${data.creator}`, inline: true },
          );
        break;
    }
  }

  async formatThreadLog(embed, data) {
    switch (data.action) {
      case "CREATE":
        embed.setTitle("Thread Created").addFields(
          { name: "Name", value: data.thread.name, inline: true },
          { name: "Creator", value: `${data.creator}`, inline: true },
          {
            name: "Parent Channel",
            value: `${data.thread.parent}`,
            inline: true,
          },
        );
        break;
      case "DELETE":
        embed.setTitle("Thread Deleted").addFields(
          { name: "Name", value: data.thread.name, inline: true },
          {
            name: "Parent Channel",
            value: `${data.thread.parent}`,
            inline: true,
          },
        );
        break;
      case "ARCHIVE":
        embed
          .setTitle(data.archived ? "Thread Archived" : "Thread Unarchived")
          .addFields(
            { name: "Name", value: data.thread.name, inline: true },
            {
              name: "Parent Channel",
              value: `${data.thread.parent}`,
              inline: true,
            },
            { name: "By", value: `${data.executor}`, inline: true },
          );
        break;
    }
  }
}

export { LogHandler, LOG_TYPES };
