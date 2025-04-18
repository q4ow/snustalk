import { EmbedBuilder } from "discord.js";
import { formatDuration } from "../utils/moderation.js";
import { db } from "../utils/database.js";

const LOG_TYPES = {
  MEMBER: { color: "#3498db", emoji: "👥" },
  MESSAGE: { color: "#e74c3c", emoji: "📝" },
  MOD: { color: "#e67e22", emoji: "🔨" },
  VOICE: { color: "#2ecc71", emoji: "🎤" },
  CHANNEL: { color: "#9b59b6", emoji: "#️⃣" },
  ROLE: { color: "#f1c40f", emoji: "🎭" },
  SERVER: { color: "#34495e", emoji: "🖥️" },
  USER: { color: "#1abc9c", emoji: "👤" },
  INVITE: { color: "#8e44ad", emoji: "📨" },
  THREAD: { color: "#2c3e50", emoji: "🧵" },
  FILE: { color: "#95a5a6", emoji: "📁" },
  BOOST: { color: "#ff73fa", emoji: "🚀" },
  RAID: { color: "#e74c3c", emoji: "⚠️" },
};

class LogHandler {
  constructor(client) {
    this.client = client;
    this.channels = new Map();
    this.blacklistedChannels = [];
  }

  async initialize() {
    console.log("✅ Logging handler initialized");
  }

  isChannelBlacklisted(channelId) {
    return this.blacklistedChannels.includes(channelId);
  }

  async isLoggingChannel(channelId) {
    const allSettings = await db.getLoggingSettings(
      this.client.guilds.cache.first().id,
    );
    return allSettings.some((setting) => setting.channel_id === channelId);
  }

  async createLog(type, data) {
    if (!LOG_TYPES[type]) {
      console.warn(`Unknown log type: ${type}`);
      return;
    }

    const guildId =
      data.guild?.id ||
      data.message?.guild?.id ||
      this.client.guilds.cache.first().id;
    const settings = await db.getLoggingSettings(guildId, type);

    if (!settings || !settings.enabled) {
      if (process.env.NODE_ENV === "development") {
        console.log(`Logging disabled for ${type} in guild ${guildId}`);
      }
      return;
    }

    const channel = await this.client.channels
      .fetch(settings.channel_id)
      .catch(() => null);
    if (!channel) {
      console.warn(`Could not find logging channel for ${type} logs`);
      return;
    }

    if (
      data.message?.channelId === settings.channel_id ||
      data.channel?.id === settings.channel_id
    ) {
      if (process.env.NODE_ENV === "development") {
        console.log(`Skipping log for logging channel: ${settings.channel_id}`);
      }
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
        case "FILE":
          this.formatFileLog(embed, data);
          break;
        case "BOOST":
          this.formatBoostLog(embed, data);
          break;
        case "RAID":
          this.formatRaidLog(embed, data);
          break;
      }

      if (!embed.data.title || !embed.data.fields?.length) {
        console.error(`Invalid embed generated for ${type} log:`, embed);
        return;
      }

      const content = settings.ping_roles?.length
        ? settings.ping_roles.map((id) => `<@&${id}>`).join(" ")
        : "";

      await channel.send({ content, embeds: [embed] });
      console.log(`Successfully sent ${type} log`);
    } catch (error) {
      console.error(`Failed to send ${type} log:`, error);
    }
  }

  createMessageDiff(oldContent, newContent) {
    if (!oldContent && !newContent) return "No text content in either message";
    if (!oldContent) return `+ ${newContent}`;
    if (!newContent) return `- ${oldContent}`;

    const lines = [];
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    let i = 0,
      j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        lines.push(`+ ${newLines[j]}`);
        j++;
      } else if (j >= newLines.length) {
        lines.push(`- ${oldLines[i]}`);
        i++;
      } else if (oldLines[i] === newLines[j]) {
        lines.push(`  ${oldLines[i]}`);
        i++;
        j++;
      } else {
        lines.push(`- ${oldLines[i]}`);
        lines.push(`+ ${newLines[j]}`);
        i++;
        j++;
      }
    }
    return lines.join("\n");
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
        const diff = this.createMessageDiff(data.oldContent, data.newContent);
        embed
          .setTitle("✏️ Message Edited")
          .addFields(
            { name: "Author", value: `${data.message.author}`, inline: true },
            { name: "Channel", value: `${data.message.channel}`, inline: true },
            { name: "Changes", value: `\`\`\`diff\n${diff}\n\`\`\`` },
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
      case "CREATE":
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

      case "DELETE":
      case "ROLE_DELETE":
        embed
          .setTitle("🗑️ Role Deleted")
          .addFields(
            { name: "Name", value: data.role.name, inline: true },
            { name: "Color", value: data.role.hexColor, inline: true },
          );
        break;

      case "UPDATE":
      case "ROLE_UPDATE":
        const fields = [];
        if (data.changes.name)
          fields.push({
            name: "Name",
            value: `${data.changes.name.old} → ${data.changes.name.new}`,
            inline: true,
          });
        if (data.changes.color)
          fields.push({
            name: "Color",
            value: `${data.changes.color.old} → ${data.changes.color.new}`,
            inline: true,
          });
        if (data.changes.hoist)
          fields.push({
            name: "Hoisted",
            value: `${data.changes.hoist.old} → ${data.changes.hoist.new}`,
            inline: true,
          });
        if (data.changes.mentionable)
          fields.push({
            name: "Mentionable",
            value: `${data.changes.mentionable.old} → ${data.changes.mentionable.new}`,
            inline: true,
          });
        if (data.changes.permissions) {
          const added = data.changes.permissions.added.join(", ") || "None";
          const removed = data.changes.permissions.removed.join(", ") || "None";
          fields.push(
            { name: "Added Permissions", value: added },
            { name: "Removed Permissions", value: removed },
          );
        }

        embed.setTitle("📝 Role Updated").addFields(
          { name: "Role", value: data.role.toString(), inline: true },
          {
            name: "Updated By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
          ...fields,
        );
        break;

      case "MEMBER_ROLES_UPDATE":
        const addedRoles =
          data.added?.map((r) => r.toString()).join(", ") || "None";
        const removedRoles =
          data.removed?.map((r) => r.toString()).join(", ") || "None";

        embed.setTitle("👤 Member Roles Updated").addFields(
          { name: "Member", value: data.member.toString(), inline: true },
          {
            name: "Updated By",
            value: data.executor ? `${data.executor}` : "Unknown",
            inline: true,
          },
          { name: "Added Roles", value: addedRoles },
          { name: "Removed Roles", value: removedRoles },
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

  formatFileLog(embed, data) {
    embed.setTitle("📁 File Uploaded").addFields(
      { name: "User", value: `${data.user}` },
      { name: "Channel", value: `${data.channel}` },
      {
        name: "Filename(s)",
        value: data.files.map((f) => f.name).join(", "),
      },
      {
        name: "File URL(s)",
        value: data.files.map((f) => `[${f.name}](${f.url})`).join("\n"),
      },
    );
    if (data.messageContent) {
      embed.addFields({ name: "Message Content", value: data.messageContent });
    }
    return embed;
  }

  formatBoostLog(embed, data) {
    switch (data.action) {
      case "BOOST_START":
        embed
          .setTitle("🚀 Server Boost Started")
          .setDescription(`${data.member} boosted the server!`)
          .addFields(
            { name: "Member", value: `${data.member}`, inline: true },
            {
              name: "Boosting Since",
              value: `<t:${Math.floor(data.since.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: "Current Boost Count",
              value: `${data.boostCount}`,
              inline: true,
            },
            {
              name: "Server Level",
              value: `${data.premiumTier}`,
              inline: true,
            },
          );
        break;

      case "BOOST_END":
        embed
          .setTitle("💔 Server Boost Ended")
          .setDescription(`${data.member} is no longer boosting the server`)
          .addFields(
            { name: "Member", value: `${data.member}`, inline: true },
            {
              name: "Boosted For",
              value: formatDuration(data.duration),
              inline: true,
            },
            {
              name: "Current Boost Count",
              value: `${data.boostCount}`,
              inline: true,
            },
            {
              name: "Server Level",
              value: `${data.premiumTier}`,
              inline: true,
            },
          );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Boost Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }

    return embed;
  }

  formatRaidLog(embed, data) {
    switch (data.action) {
      case "RAID_DETECTED":
        embed
          .setTitle("⚠️ Raid Detected")
          .setDescription(`A raid has been detected!`)
          .addFields(
            {
              name: "Join Rate",
              value: `${data.joins} joins in ${data.timeWindow / 1000}s`,
              inline: true,
            },
            {
              name: "Action Taken",
              value: data.action,
              inline: true,
            },
            {
              name: "Affected Users",
              value:
                data.users
                  .map((u) => `${u}`)
                  .join("\n")
                  .slice(0, 1024) || "None",
            },
          );
        break;

      case "RAID_MODE_ENABLED":
        embed
          .setTitle("🛡️ Raid Mode Enabled")
          .setDescription(`Server has entered lockdown mode`)
          .addFields(
            {
              name: "Triggered By",
              value: data.moderator ? `${data.moderator}` : "Auto Protection",
              inline: true,
            },
            {
              name: "Reason",
              value: data.reason || "No reason provided",
              inline: true,
            },
            {
              name: "Duration",
              value: data.duration
                ? formatDuration(data.duration)
                : "Manual disable required",
              inline: true,
            },
          );
        break;

      case "RAID_MODE_DISABLED":
        embed
          .setTitle("✅ Raid Mode Disabled")
          .setDescription(`Server has exited lockdown mode`)
          .addFields(
            {
              name: "Disabled By",
              value: data.moderator ? `${data.moderator}` : "Auto Protection",
              inline: true,
            },
            {
              name: "Duration",
              value: formatDuration(data.duration),
              inline: true,
            },
          );
        break;

      default:
        embed
          .setTitle("⚠️ Unknown Raid Action")
          .setDescription(`Unknown action type: ${data.action}`);
        break;
    }
    return embed;
  }
}

export { LogHandler, LOG_TYPES };
