import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Sets up the ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addStringOption((option) =>
      option.setName("title").setDescription("Title for the ticket panel"),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Description for the ticket panel"),
    )
    .addStringOption((option) =>
      option
        .setName("description_line2")
        .setDescription("Second line of the description (optional)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("description_line3")
        .setDescription("Third line of the description (optional)")
        .setRequired(false),
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString()),

  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Sends a welcome message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString()),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Purges messages from the channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels.toString())
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to lock")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlocks a channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels.toString())
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to unlock")
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Change a user's nickname")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames.toString())
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
    .setName("warn")
    .setDescription("Warn a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check warnings for")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("View moderation history for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check moderation history for")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("removewarning")
    .setDescription("Remove a warning from a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
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
    .setName("embed")
    .setDescription("Create and send a custom embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the embed in")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
      option.setName("title").setDescription("Embed title").setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Embed description (use \\n for new lines)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Embed color (hex code)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("thumbnail")
        .setDescription("Thumbnail URL")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("Large image URL")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option.setName("author").setDescription("Author name").setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("author_icon")
        .setDescription("Author icon URL")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option.setName("footer").setDescription("Footer text").setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("footer_icon")
        .setDescription("Footer icon URL")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("fields")
        .setDescription(
          "Fields (format: name1|value1|inline,name2|value2|inline)",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("timestamp")
        .setDescription("Add timestamp? (yes/no)")
        .setRequired(false)
        .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" }),
    ),

  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage auto-moderation settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand((subcommand) =>
      subcommand
        .setName("toggle")
        .setDescription("Enable or disable automod")
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Whether to enable or disable automod")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("logchannel")
        .setDescription("Set the channel for automod logs")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to send automod logs to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("exempt")
        .setDescription("Add/remove role/channel exemptions")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("What to exempt")
            .setRequired(true)
            .addChoices(
              { name: "Add Role", value: "add_role" },
              { name: "Remove Role", value: "remove_role" },
              { name: "Add Channel", value: "add_channel" },
              { name: "Remove Channel", value: "remove_channel" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("target")
            .setDescription("The role/channel ID to exempt")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("filter")
        .setDescription("Configure automod filters")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The filter to configure")
            .setRequired(true)
            .addChoices(
              { name: "Spam", value: "spam" },
              { name: "Invites", value: "invites" },
              { name: "Mentions", value: "mentions" },
              { name: "Caps", value: "caps" },
              { name: "Links", value: "links" },
              { name: "Words", value: "words" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Action to take when filter is triggered")
            .setRequired(true)
            .addChoices(
              { name: "Delete Message", value: "delete" },
              { name: "Warn User", value: "warn" },
              { name: "Timeout User", value: "timeout" },
            ),
        )
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("Enable or disable this filter")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("settings")
            .setDescription(
              "Filter-specific settings in JSON format (optional)",
            )
            .setRequired(false),
        ),
    ),

  new SlashCommandBuilder()
    .setName("typingscore")
    .setDescription("Show your top typing speed (WPM)"),

  new SlashCommandBuilder()
    .setName("typingleaderboard")
    .setDescription("Show the typing leaderboard for the server"),

  new SlashCommandBuilder()
    .setName("typinggame")
    .setDescription("Get the URL to play the SnusTalk typing game"),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configure server logging settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Set up logging for a specific type of events")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of events to log")
            .setRequired(true)
            .addChoices(
              { name: "Member Events", value: "MEMBER" },
              { name: "Message Events", value: "MESSAGE" },
              { name: "Moderation Events", value: "MOD" },
              { name: "Voice Events", value: "VOICE" },
              { name: "Channel Events", value: "CHANNEL" },
              { name: "Role Events", value: "ROLE" },
              { name: "Server Events", value: "SERVER" },
              { name: "User Events", value: "USER" },
              { name: "Invite Events", value: "INVITE" },
              { name: "Thread Events", value: "THREAD" },
              { name: "File Events", value: "FILE" },
              { name: "Boost Events", value: "BOOST" },
            ),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to send logs to")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((option) =>
          option
            .setName("allowed_roles")
            .setDescription("Roles that can view the logs (comma-separated)")
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("ping_roles")
            .setDescription("Roles to ping for these events (comma-separated)")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disable")
        .setDescription("Disable logging for a specific type of events")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of events to disable logging for")
            .setRequired(true)
            .addChoices(
              { name: "Member Events", value: "MEMBER" },
              { name: "Message Events", value: "MESSAGE" },
              { name: "Moderation Events", value: "MOD" },
              { name: "Voice Events", value: "VOICE" },
              { name: "Channel Events", value: "CHANNEL" },
              { name: "Role Events", value: "ROLE" },
              { name: "Server Events", value: "SERVER" },
              { name: "User Events", value: "USER" },
              { name: "Invite Events", value: "INVITE" },
              { name: "Thread Events", value: "THREAD" },
              { name: "File Events", value: "FILE" },
              { name: "Boost Events", value: "BOOST" },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View current logging settings"),
    ),

  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents.toString())
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new giveaway")
        .addStringOption((option) =>
          option
            .setName("prize")
            .setDescription("What is being given away")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Duration of the giveaway (e.g., 1h, 1d, 1w)")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setDescription("Number of winners")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description of the giveaway")
            .setRequired(false),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to host the giveaway in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addRoleOption((option) =>
          option
            .setName("required_role")
            .setDescription("Role required to enter the giveaway")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("min_account_age")
            .setDescription("Minimum account age to enter (e.g., 1d, 1w)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("min_server_age")
            .setDescription("Minimum server age to enter (e.g., 1d, 1w)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("button_label")
            .setDescription("Custom label for the entry button")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("embed_color")
            .setDescription("Embed color (hex code)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("image")
            .setDescription("Image URL for the embed")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("end_message")
            .setDescription("Custom message to send when the giveaway ends")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("End a giveaway")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("The message ID of the giveaway")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setDescription("Reroll a giveaway to pick new winners")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("The message ID of the giveaway")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setDescription(
              "Number of winners to pick (defaults to original winner count)",
            )
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("blacklist")
        .setDescription("Blacklist a user from a giveaway")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("The message ID of the giveaway")
            .setRequired(true),
        )
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to blacklist from the giveaway")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("entries")
        .setDescription("View all entries for a giveaway")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("The message ID of the giveaway")
            .setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName("reactionroles")
    .setDescription("Create a reaction roles message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send the reaction roles message in")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("The title of the embed")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("The description of the embed")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("roles")
        .setDescription("Role configurations in JSON format")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("The color of the embed (hex code)"),
    ),

  new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Manage bot settings for the server")
    .setDefaultMemberPermissions("0")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set a server setting")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of setting to set")
            .setRequired(true)
            .addChoices(
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the setting")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName("value")
            .setDescription("The value to set")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("get")
        .setDescription("Get a server setting")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of setting to get")
            .setRequired(true)
            .addChoices(
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the setting")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List server settings")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of settings to list")
            .setRequired(false)
            .addChoices(
              { name: "All", value: "all" },
              { name: "Channels", value: "channel" },
              { name: "Roles", value: "role" },
              { name: "API Keys", value: "api" },
              { name: "External Links", value: "link" },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a server setting")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of setting to remove")
            .setRequired(true)
            .addChoices(
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the setting to remove")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("available-keys")
        .setDescription(
          "View all possible setting keys with configuration status",
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of settings to list")
            .setRequired(true)
            .addChoices(
              { name: "Channel", value: "channel" },
              { name: "Role", value: "role" },
              { name: "API Key", value: "api" },
              { name: "External Link", value: "link" },
            ),
        ),
    ),

  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Generate or view your dashboard API key"),

  new SlashCommandBuilder()
    .setName("setboostchannel")
    .setDescription("Set a dedicated channel for server boost notifications")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to send boost notifications to")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    ),

  new SlashCommandBuilder()
    .setName("donate")
    .setDescription("Get links to support the bot through Ko-fi and GitHub"),
];
