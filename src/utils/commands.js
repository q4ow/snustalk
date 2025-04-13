import { setupTicketSystem } from "../handlers/ticketHandler.js";
import { handleVerification } from "../handlers/verificationHandler.js";
import { handleWelcome } from "../handlers/welcomeHandler.js";
import { handlePurge } from "../handlers/purgeHandler.js";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import {
  addNote,
  deleteNote,
  editNote,
  listNotes,
} from "../handlers/notesHandler.js";
import {
  warnUser,
  kickUser,
  banUser,
  timeoutUser,
  removeTimeout,
  getUserWarnings,
  getUserModActions,
  createModActionEmbed,
  removeWarning,
} from "../handlers/moderationHandler.js";

export const BOT_PREFIX = process.env.BOT_PREFIX || "$";

const slashCommands = [
  new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Sets up the ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName("title").setDescription("Title for the ticket panel"),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Description for the ticket panel"),
    )
    .addRoleOption((option) =>
      option
        .setName("moderator_role")
        .setDescription("Role for ticket moderators"),
    )
    .addStringOption((option) =>
      option.setName("color").setDescription("Color for the embed (hex code)"),
    )
    .addStringOption((option) =>
      option.setName("thumbnail").setDescription("URL for the embed thumbnail"),
    )
    .addStringOption((option) =>
      option.setName("footer").setDescription("Footer text for the embed"),
    )
    .addIntegerOption((option) =>
      option
        .setName("max_tickets")
        .setDescription("Maximum tickets per user")
        .setMinValue(1)
        .setMaxValue(5),
    )
    .addIntegerOption((option) =>
      option
        .setName("auto_close")
        .setDescription(
          "Auto-close tickets after X hours of inactivity (0 to disable)",
        )
        .setMinValue(0),
    )
    .addBooleanOption((option) =>
      option
        .setName("enable_claiming")
        .setDescription("Enable ticket claiming system"),
    )
    .addBooleanOption((option) =>
      option
        .setName("close_confirmation")
        .setDescription("Require confirmation when closing tickets"),
    ),

  new SlashCommandBuilder()
    .setName("resend-verify")
    .setDescription("Resends verification embeds")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Sends a welcome message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Purges messages from the channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to purge")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    ),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Shows information about a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get info about")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Shows information about the server"),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Locks a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to lock")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlocks a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to unlock")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Change a user's nickname")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to change nickname")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("nickname")
        .setDescription("The new nickname")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Shows the bot's latency"),
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Returns user avatar")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose avatar to show")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("note")
    .setDescription("Manage your personal notes")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a new note")
        .addStringOption((option) =>
          option
            .setName("content")
            .setDescription("The content of your note")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all your notes"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete one of your notes")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the note to delete")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit one of your notes")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The ID of the note to edit")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("content")
            .setDescription("The new content of your note")
            .setRequired(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows all available commands"),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to warn")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the warning")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to ban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_days")
        .setDescription("Number of days of messages to delete")
        .setRequired(false)
        .addChoices(
          { name: "None", value: 0 },
          { name: "1 day", value: 1 },
          { name: "7 days", value: 7 },
        ),
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to timeout")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Timeout duration (e.g., 1h, 1d)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the timeout")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to remove timeout from")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for removing the timeout")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check warnings for")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("View moderation history for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check moderation history for")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("removewarning")
    .setDescription("Remove a warning from a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("The ID of the warning to remove")
        .setRequired(true),
    ),
];

export const commands = {
  "setup-tickets": {
    permissions: ["Administrator"],
    deleteAfter: true,
    async execute(message) {
      await setupTicketSystem(message.channel);
    },
    errorMessage: "There was an error setting up the ticket system.",
  },
  "resend-verify": {
    permissions: ["ManageRoles"],
    deleteAfter: true,
    async execute(message) {
      const mockReaction = {
        message: {
          channelId: process.env.VERIFICATION_CHANNEL_ID,
          guild: message.guild,
          channel: message.channel,
        },
        emoji: { name: "✅" },
      };
      await handleVerification(mockReaction, message.author);
      await message.reply("✅ Verification embeds have been sent to your DMs.");
    },
    errorMessage: "❌ An error occurred while sending verification embeds.",
  },
  welcome: {
    permissions: ["ManageRoles"],
    deleteAfter: true,
    async execute(message) {
      await handleWelcome(message.member);
    },
    errorMessage: "❌ An error occurred while sending welcome message.",
  },
  purge: {
    permissions: ["ManageMessages"],
    deleteAfter: true,
    async execute(message) {
      const args = message.content.trim().split(/ +/);
      const amount = args[1];
      await handlePurge(message, [amount]);
    },
    errorMessage: "❌ An error occurred while purging messages.",
  },
  userinfo: {
    permissions: [],
    deleteAfter: false,
    async execute(message) {
      const mentionedUser = message.mentions.users.first() || message.author;
      const member = await message.guild.members.fetch(mentionedUser.id);

      const userEmbed = new EmbedBuilder()
        .setTitle(`User Information - ${mentionedUser.tag}`)
        .setThumbnail(mentionedUser.displayAvatarURL({ dynamic: true }))
        .setColor("#2F3136")
        .addFields(
          { name: "User ID", value: mentionedUser.id, inline: true },
          {
            name: "Account Created",
            value: `<t:${Math.floor(mentionedUser.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Joined Server",
            value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Roles",
            value:
              member.roles.cache.size > 1
                ? member.roles.cache
                    .filter((r) => r.id !== message.guild.id)
                    .map((r) => r)
                    .join(", ")
                : "No roles",
          },
        )
        .setTimestamp();

      await message.reply({ embeds: [userEmbed] });
    },
    errorMessage: "❌ Could not fetch user information.",
  },

  serverinfo: {
    permissions: [],
    deleteAfter: false,
    async execute(message) {
      const guild = message.guild;
      const owner = await guild.fetchOwner();

      const serverEmbed = new EmbedBuilder()
        .setTitle(`Server Information - ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setColor("#2F3136")
        .addFields(
          { name: "Owner", value: owner.user.tag, inline: true },
          {
            name: "Created",
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          { name: "Members", value: `${guild.memberCount}`, inline: true },
          {
            name: "Channels",
            value: `${guild.channels.cache.size}`,
            inline: true,
          },
          { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
          { name: "Boost Level", value: `${guild.premiumTier}`, inline: true },
          {
            name: "Boosts",
            value: `${guild.premiumSubscriptionCount || 0}`,
            inline: true,
          },
        )
        .setTimestamp();

      await message.reply({ embeds: [serverEmbed] });
    },
    errorMessage: "❌ Could not fetch server information.",
  },

  lock: {
    permissions: ["ManageChannels"],
    deleteAfter: false,
    async execute(message) {
      const channel = message.mentions.channels.first() || message.channel;
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false,
      });
      await message.reply(`🔒 ${channel} has been locked.`);
    },
    errorMessage: "❌ Could not lock the channel.",
  },

  unlock: {
    permissions: ["ManageChannels"],
    deleteAfter: false,
    async execute(message) {
      const channel = message.mentions.channels.first() || message.channel;
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null,
      });
      await message.reply(`🔓 ${channel} has been unlocked.`);
    },
    errorMessage: "❌ Could not unlock the channel.",
  },

  nickname: {
    permissions: ["ManageNicknames"],
    deleteAfter: false,
    async execute(message) {
      const args = message.content.split(" ").slice(1);
      const targetUser = message.mentions.members.first();
      if (!targetUser)
        return message.reply(
          "❌ Please mention a user to change their nickname.",
        );

      const newNickname = args.slice(1).join(" ");
      if (!newNickname)
        return message.reply("❌ Please provide a new nickname.");

      await targetUser.setNickname(newNickname);
      await message.reply(
        `✅ Changed ${targetUser.user.tag}'s nickname to \`${newNickname}\``,
      );
    },
    errorMessage: "❌ Could not change the nickname.",
  },

  ping: {
    permissions: [],
    deleteAfter: false,
    async execute(message) {
      const sent = await message.reply("Pinging...");
      const roundtrip = sent.createdTimestamp - message.createdTimestamp;
      const wsHeartbeat = message.client.ws.ping;

      await sent.edit(
        `🏓 Pong!\n> Roundtrip: ${roundtrip}ms\n> Websocket: ${wsHeartbeat}ms`,
      );
    },
    errorMessage: "❌ Could not check ping.",
  },

  avatar: {
    permissions: [],
    deleteAfter: false,
    async execute(message) {
      const user = message.mentions.users.first() || message.author;

      const avatarEmbed = new EmbedBuilder()
        .setTitle(`${user.tag}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
        .setColor("#2F3136")
        .setTimestamp();

      await message.reply({ embeds: [avatarEmbed] });
    },
    errorMessage: "❌ Could not fetch avatar.",
  },

  note: {
    permissions: [],
    deleteAfter: false,
    async execute(message, args) {
      if (!args.length) {
        return message.reply(
          "Usage: `note <add|list|delete|edit> [content|id]`",
        );
      }

      const subcommand = args[0].toLowerCase();
      const content = args.slice(1).join(" ");

      try {
        switch (subcommand) {
          case "add":
            if (!content) return message.reply("Please provide note content.");
            const noteId = await addNote(message.author.id, content);
            return message.reply(`✅ Note added with ID: ${noteId}`);

          case "list":
            const notes = await listNotes(message.author.id);
            const embed = new EmbedBuilder()
              .setTitle("Your Notes")
              .setColor("#2F3136")
              .setDescription(
                notes
                  .map(
                    (note) =>
                      `**ID:** ${note.id}\n${note.content}\n*Created: <t:${Math.floor(new Date(note.timestamp).getTime() / 1000)}:R>*${note.edited ? `\n*Edited: <t:${Math.floor(new Date(note.edited).getTime() / 1000)}:R>*` : ""}\n`,
                  )
                  .join("\n"),
              );
            return message.reply({ embeds: [embed] });

          case "delete":
            if (!content) return message.reply("Please provide a note ID.");
            await deleteNote(message.author.id, content);
            return message.reply("✅ Note deleted successfully.");

          case "edit":
            const [id, ...newContent] = args.slice(1);
            if (!id || !newContent.length)
              return message.reply(
                "Please provide both note ID and new content.",
              );
            await editNote(message.author.id, id, newContent.join(" "));
            return message.reply("✅ Note edited successfully.");

          default:
            return message.reply(
              "Invalid subcommand. Use `add`, `list`, `delete`, or `edit`.",
            );
        }
      } catch (error) {
        return message.reply(`❌ ${error.message}`);
      }
    },
  },

  help: {
    permissions: [],
    deleteAfter: false,
    async execute(message) {
      const commandGroups = {
        "🛡️ Moderation": ["purge", "lock", "unlock", "nickname"],
        "🎫 Tickets": ["setup-tickets"],
        "🔧 Utility": ["userinfo", "serverinfo", "avatar", "ping", "help"],
        "📝 Notes": ["note"],
        "⚙️ System": ["resend-verify", "welcome"],
      };

      const helpEmbed = new EmbedBuilder()
        .setTitle("Command Help")
        .setColor("#2F3136")
        .setDescription(
          `Use \`${BOT_PREFIX}command\` or \`/command\` to execute a command.`,
        )
        .setTimestamp();

      for (const [category, cmds] of Object.entries(commandGroups)) {
        const commandList = cmds
          .map((cmdName) => {
            const slashCmd = slashCommands.find((cmd) => cmd.name === cmdName);
            return `\`${cmdName}\` - ${slashCmd ? slashCmd.description : "No description available"}`;
          })
          .join("\n");

        helpEmbed.addFields({ name: category, value: commandList });
      }

      helpEmbed.addFields({
        name: "📌 Note",
        value: "Some commands may require special permissions to use.",
      });

      await message.reply({ embeds: [helpEmbed] });
    },
    errorMessage: "❌ Could not display help menu.",
  },
};

export async function handleCommand(message, commands) {
  if (!message.content.startsWith(BOT_PREFIX)) return false;

  const args = message.content.slice(BOT_PREFIX.length).trim().split(/ +/);
  const commandName = args[0];
  const command = commands[commandName];

  if (!command) return false;

  try {
    if (command.permissions) {
      const hasPermission = command.permissions.every((permission) =>
        message.member.permissions.has(permission),
      );

      if (!hasPermission) {
        await message.reply({
          content: "❌ You do not have permission to use this command.",
          flags: 64,
        });
        return true;
      }
    }

    await command.execute(message, args.slice(1));

    if (command.deleteAfter) {
      await message.delete().catch((err) => {
        if (err.code !== 10008) {
          console.error("Could not delete command message:", err);
        }
      });
    }
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    await message.reply(
      command.errorMessage ||
        "❌ An error occurred while executing the command.",
    );
  }

  return true;
}

export async function handleSlashCommand(interaction) {
  try {
    switch (interaction.commandName) {
      case "setup-tickets":
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        const moderatorRole = interaction.options.getRole("moderator_role");
        const color = interaction.options.getString("color");
        const enableClaiming =
          interaction.options.getBoolean("enable_claiming");

        const options = {
          ...(title && { title }),
          ...(description && { description }),
          ...(moderatorRole && { moderatorRoleId: moderatorRole.id }),
          ...(color && { color }),
          ...(enableClaiming !== null && { enableClaiming }),
        };

        await setupTicketSystem(interaction.channel, options);
        await interaction.reply({
          content:
            "✅ Ticket system has been set up with your custom configuration!",
          flags: 64,
        });
        break;

      case "resend-verify":
        const mockReaction = {
          message: {
            channelId: process.env.VERIFICATION_CHANNEL_ID,
            guild: interaction.guild,
            channel: interaction.channel,
          },
          emoji: { name: "✅" },
        };
        await handleVerification(mockReaction, interaction.user);
        await interaction.reply({
          content: "✅ Verification embeds have been sent!",
          flags: 64,
        });
        break;

      case "welcome":
        await handleWelcome(interaction.member);
        await interaction.reply({
          content: "✅ Welcome message sent!",
          flags: 64,
        });
        break;

      case "purge":
        const amount = interaction.options.getInteger("amount");
        await handlePurge(interaction, [amount]);
        await interaction.reply({
          content: `✅ Purged ${amount} messages!`,
          flags: 64,
        });
        break;

      case "userinfo":
        const user = interaction.options.getUser("user") || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const userEmbed = new EmbedBuilder()
          .setTitle(`User Information - ${user.tag}`)
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setColor("#2F3136")
          .addFields(
            { name: "User ID", value: user.id, inline: true },
            {
              name: "Account Created",
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
              inline: true,
            },
            {
              name: "Joined Server",
              value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
              inline: true,
            },
            {
              name: "Roles",
              value:
                member.roles.cache.size > 1
                  ? member.roles.cache
                      .filter((r) => r.id !== interaction.guild.id)
                      .map((r) => r)
                      .join(", ")
                  : "No roles",
            },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [userEmbed] });
        break;

      case "serverinfo":
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();

        const serverEmbed = new EmbedBuilder()
          .setTitle(`Server Information - ${guild.name}`)
          .setThumbnail(guild.iconURL({ dynamic: true }))
          .setColor("#2F3136")
          .addFields(
            { name: "Owner", value: owner.user.tag, inline: true },
            {
              name: "Created",
              value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
              inline: true,
            },
            { name: "Members", value: `${guild.memberCount}`, inline: true },
            {
              name: "Channels",
              value: `${guild.channels.cache.size}`,
              inline: true,
            },
            { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
            {
              name: "Boost Level",
              value: `${guild.premiumTier}`,
              inline: true,
            },
            {
              name: "Boosts",
              value: `${guild.premiumSubscriptionCount || 0}`,
              inline: true,
            },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [serverEmbed] });
        break;

      case "lock":
        const lockChannel =
          interaction.options.getChannel("channel") || interaction.channel;
        await lockChannel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: false,
          },
        );
        await interaction.reply(`🔒 ${lockChannel} has been locked.`);
        break;

      case "unlock":
        const unlockChannel =
          interaction.options.getChannel("channel") || interaction.channel;
        await unlockChannel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: null,
          },
        );
        await interaction.reply(`🔓 ${unlockChannel} has been unlocked.`);
        break;

      case "nickname":
        const targetUser = interaction.options.getUser("user");
        const newNickname = interaction.options.getString("nickname");
        const targetMember = await interaction.guild.members.fetch(
          targetUser.id,
        );

        try {
          await targetMember.setNickname(newNickname);
          await interaction.reply({
            content: `✅ Changed ${targetUser.tag}'s nickname to \`${newNickname}\``,
            flags: 64,
          });
        } catch (error) {
          await interaction.reply({
            content:
              "❌ Could not change nickname. User might have higher permissions.",
            flags: 64,
          });
        }
        break;

      case "ping":
        const sent = await interaction.reply({
          content: "Pinging...",
          fetchReply: true,
        });
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const wsHeartbeat = interaction.client.ws.ping;

        await interaction.editReply({
          content: `🏓 Pong!\n> Roundtrip: ${roundtrip}ms\n> Websocket: ${wsHeartbeat}ms`,
        });
        break;

      case "avatar":
        const avatarUser =
          interaction.options.getUser("user") || interaction.user;

        const avatarEmbed = new EmbedBuilder()
          .setTitle(`${avatarUser.tag}'s Avatar`)
          .setImage(avatarUser.displayAvatarURL({ size: 4096, dynamic: true }))
          .setColor("#2F3136")
          .setTimestamp();

        await interaction.reply({ embeds: [avatarEmbed] });
        break;

      case "note":
        const subcommand = interaction.options.getSubcommand();
        try {
          switch (subcommand) {
            case "add":
              const content = interaction.options.getString("content");
              const noteId = await addNote(interaction.user.id, content);
              await interaction.reply({
                content: `✅ Note added with ID: ${noteId}`,
                flags: 64,
              });
              break;

            case "list":
              const notes = await listNotes(interaction.user.id);
              const embed = new EmbedBuilder()
                .setTitle("Your Notes")
                .setColor("#2F3136")
                .setDescription(
                  notes
                    .map(
                      (note) =>
                        `**ID:** ${note.id}\n${note.content}\n*Created: <t:${Math.floor(new Date(note.timestamp).getTime() / 1000)}:R>*${note.edited ? `\n*Edited: <t:${Math.floor(new Date(note.edited).getTime() / 1000)}:R>*` : ""}\n`,
                    )
                    .join("\n"),
                );
              await interaction.reply({ embeds: [embed], flags: 64 });
              break;

            case "delete":
              const deleteId = interaction.options.getString("id");
              await deleteNote(interaction.user.id, deleteId);
              await interaction.reply({
                content: "✅ Note deleted successfully.",
                flags: 64,
              });
              break;

            case "edit":
              const editId = interaction.options.getString("id");
              const newContent = interaction.options.getString("content");
              await editNote(interaction.user.id, editId, newContent);
              await interaction.reply({
                content: "✅ Note edited successfully.",
                flags: 64,
              });
              break;
          }
        } catch (error) {
          await interaction.reply({
            content: `❌ ${error.message}`,
            flags: 64,
          });
        }
        break;
      case "help":
        const commandGroups = {
          "🛡️ Moderation": ["purge", "lock", "unlock", "nickname"],
          "🎫 Tickets": ["setup-tickets"],
          "🔧 Utility": ["userinfo", "serverinfo", "avatar", "ping", "help"],
          "📝 Notes": ["note"],
          "⚙️ System": ["resend-verify", "welcome"],
        };

        const helpEmbed = new EmbedBuilder()
          .setTitle("Command Help")
          .setColor("#2F3136")
          .setDescription(
            `Use \`${BOT_PREFIX}command\` or \`/command\` to execute a command.`,
          )
          .setTimestamp();

        for (const [category, cmds] of Object.entries(commandGroups)) {
          const commandList = cmds
            .map((cmdName) => {
              const slashCmd = slashCommands.find(
                (cmd) => cmd.name === cmdName,
              );
              return `\`${cmdName}\` - ${slashCmd ? slashCmd.description : "No description available"}`;
            })
            .join("\n");

          helpEmbed.addFields({ name: category, value: commandList });
        }

        helpEmbed.addFields({
          name: "📌 Note",
          value: "Some commands may require special permissions to use.",
        });

        await interaction.reply({ embeds: [helpEmbed] });
        break;

      case "warn":
        const userToWarn = interaction.options.getUser("user");
        const warnReason = interaction.options.getString("reason");
        const warnMember = await interaction.guild.members.fetch(userToWarn.id);

        if (
          warnMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          await interaction.reply({
            content: "❌ You cannot warn this user due to role hierarchy.",
            flags: 64,
          });
          return;
        }

        const warning = await warnUser(
          interaction.guild,
          interaction.user,
          warnMember,
          warnReason,
        );

        await interaction.reply({
          embeds: [createModActionEmbed(warning, interaction.guild)],
          flags: 64,
        });
        break;

      case "removewarning":
        const warningId = interaction.options.getString("id");

        try {
          await removeWarning(
            interaction.guild.id,
            interaction.user,
            warningId,
          );

          const embed = new EmbedBuilder()
            .setTitle("Warning Removed")
            .setColor("#32CD32")
            .addFields(
              { name: "Warning ID", value: warningId, inline: true },
              {
                name: "Removed by",
                value: `<@${interaction.user.id}>`,
                inline: true,
              },
              { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>` },
            )
            .setTimestamp();

          await interaction.reply({
            embeds: [embed],
            flags: 64,
          });
        } catch (error) {
          await interaction.reply({
            content: `❌ ${error.message}`,
            flags: 64,
          });
        }
        break;

      case "kick":
        const userToKick = interaction.options.getUser("user");
        const kickReason = interaction.options.getString("reason");
        const kickMember = await interaction.guild.members.fetch(userToKick.id);

        if (
          kickMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          await interaction.reply({
            content: "❌ You cannot kick this user due to role hierarchy.",
            flags: 64,
          });
          return;
        }

        const kick = await kickUser(
          interaction.guild,
          interaction.user,
          kickMember,
          kickReason,
        );

        await interaction.reply({
          embeds: [createModActionEmbed(kick, interaction.guild)],
          flags: 64,
        });
        break;

      case "ban":
        const userToBan = interaction.options.getUser("user");
        const banReason = interaction.options.getString("reason");
        const deleteDays = interaction.options.getInteger("delete_days") || 0;
        const banMember = await interaction.guild.members.fetch(userToBan.id);

        if (
          banMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          await interaction.reply({
            content: "❌ You cannot ban this user due to role hierarchy.",
            flags: 64,
          });
          return;
        }

        const ban = await banUser(
          interaction.guild,
          interaction.user,
          banMember,
          banReason,
          deleteDays,
        );

        await interaction.reply({
          embeds: [createModActionEmbed(ban, interaction.guild)],
          flags: 64,
        });
        break;

      case "timeout":
        const targetTimeoutUser = interaction.options.getUser("user");
        const timeoutReason = interaction.options.getString("reason");
        const durationStr = interaction.options.getString("duration");
        const timeoutMember = await interaction.guild.members.fetch(
          targetTimeoutUser.id,
        );

        if (
          timeoutMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          await interaction.reply({
            content: "❌ You cannot timeout this user due to role hierarchy.",
            flags: 64,
          });
          return;
        }

        const duration = parseDuration(durationStr);
        if (!duration) {
          await interaction.reply({
            content: "❌ Invalid duration format. Use format like: 1h, 1d, 30m",
            flags: 64,
          });
          return;
        }

        const timeout = await timeoutUser(
          interaction.guild,
          interaction.user,
          timeoutMember,
          duration,
          timeoutReason,
        );

        await interaction.reply({
          embeds: [createModActionEmbed(timeout, interaction.guild)],
          flags: 64,
        });
        break;

      case "untimeout":
        const untimeoutUser = interaction.options.getUser("user");
        const untimeoutReason = interaction.options.getString("reason");
        const untimeoutMember = await interaction.guild.members.fetch(
          untimeoutUser.id,
        );

        if (
          untimeoutMember.roles.highest.position >=
          interaction.member.roles.highest.position
        ) {
          await interaction.reply({
            content:
              "❌ You cannot remove timeout from this user due to role hierarchy.",
            flags: 64,
          });
          return;
        }

        const untimeout = await removeTimeout(
          interaction.guild,
          interaction.user,
          untimeoutMember,
          untimeoutReason,
        );

        await interaction.reply({
          embeds: [createModActionEmbed(untimeout, interaction.guild)],
          flags: 64,
        });
        break;

      case "warnings":
        const warningsUser = interaction.options.getUser("user");
        const warnings = await getUserWarnings(
          interaction.guild.id,
          warningsUser.id,
        );

        const warningsEmbed = new EmbedBuilder()
          .setTitle(`Warnings - ${warningsUser.tag}`)
          .setColor("#FFA500")
          .setTimestamp();

        if (warnings.length === 0) {
          warningsEmbed.setDescription("This user has no warnings.");
        } else {
          warningsEmbed.setDescription(
            warnings
              .map(
                (warning) =>
                  `**ID:** ${warning.id}\n**Moderator:** <@${warning.moderatorId}>\n**Reason:** ${warning.reason}\n**Time:** <t:${Math.floor(new Date(warning.timestamp).getTime() / 1000)}:R>\n`,
              )
              .join("\n"),
          );
        }

        await interaction.reply({ embeds: [warningsEmbed], flags: 64 });
        break;

      case "modlogs":
        const modlogsUser = interaction.options.getUser("user");
        const modlogs = await getUserModActions(
          interaction.guild.id,
          modlogsUser.id,
        );

        const modlogsEmbed = new EmbedBuilder()
          .setTitle(`Moderation History - ${modlogsUser.tag}`)
          .setColor("#2F3136")
          .setTimestamp();

        if (modlogs.length === 0) {
          modlogsEmbed.setDescription("This user has no moderation history.");
        } else {
          modlogsEmbed.setDescription(
            modlogs
              .map(
                (action) =>
                  `**Type:** ${action.type.toUpperCase()}\n**ID:** ${action.id}\n**Moderator:** <@${action.moderatorId}>\n**Reason:** ${action.reason}\n**Time:** <t:${Math.floor(new Date(action.timestamp).getTime() / 1000)}:R>\n`,
              )
              .join("\n"),
          );
        }

        await interaction.reply({ embeds: [modlogsEmbed], flags: 64 });
        break;
    }
  } catch (error) {
    console.error(
      `Error executing slash command ${interaction.commandName}:`,
      error,
    );
    await interaction.reply({
      content: "❌ An error occurred while executing the command.",
      flags: 64,
    });
  }
}

function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2];

  let milliseconds;

  switch (unit) {
    case "s":
      milliseconds = amount * 1000;
      break;
    case "m":
      milliseconds = amount * 60 * 1000;
      break;
    case "h":
      milliseconds = amount * 60 * 60 * 1000;
      break;
    case "d":
      milliseconds = amount * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  return milliseconds;
}

export async function registerSlashCommands(client) {
  try {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN,
    );

    await rest.put(Routes.applicationCommands(client.user.id), {
      body: slashCommands.map((command) => command.toJSON()),
    });
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
}
