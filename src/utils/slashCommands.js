import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const slashCommands = [
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

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows all available commands"),

  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Start a staff application process")
    .setDMPermission(false) // TODO figure this shit out
    .addStringOption((option) =>
      option
        .setName("position")
        .setDescription("The staff position you're applying for")
        .setRequired(true)
        .addChoices(
          { name: "Moderator", value: "moderator" },
          { name: "Helper", value: "helper" },
          { name: "Trial Staff", value: "trial" },
        ),
    ),
];
