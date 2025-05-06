import { setupTicketSystem } from "../handlers/ticketHandler.js";
import { handleVerification } from "../handlers/verificationHandler.js";
import { handleWelcome } from "../handlers/welcomeHandler.js";
import { handlePurge } from "../handlers/purgeHandler.js";
import { REST, Routes, EmbedBuilder } from "discord.js";
import { createHelpEmbed } from "../embeds/helpEmbed.js";
import { createUserEmbed } from "../embeds/userEmbed.js";
import { createServerEmbed } from "../embeds/serverEmbed.js";
import { createAvatarEmbed } from "../embeds/avatarEmbed.js";
import { slashCommands } from "./slashCommands.js";
import { handleApplyCommand } from "../handlers/application/handler.js";
import {
  handleSettingsCommand,
  handleSetBoostChannel,
} from "../handlers/settingsHandler.js";
import { antiRaidCommands } from "../handlers/antiRaid/commands.js";
import { automodCommands } from "../handlers/automod/commands.js";
import { settingsCommands } from "../handlers/settings/commands.js";
import { applicationCommands } from "../handlers/application/commands.js";
import {
  getAutomodSettings,
  updateAutomodSettings,
  handleAutomodWhitelistRole,
  handleAutomodUnwhitelistRole,
  handleAutomodListWhitelists,
} from "../handlers/automod/handlers.js";
import { db } from "./database.js";
import { generateApiKey } from "./generateApiKey.js";
import {
  handleWarnCommand,
  handleRemoveWarningCommand,
  handleKickCommand,
  handleBanCommand,
  handleUnbanCommand,
  handleTimeoutCommand,
  handleUntimeoutCommand,
  handleWarningsCommand,
  handleModlogsCommand,
} from "../handlers/moderation/commands.js";
import { handleGiveawayCommand } from "../handlers/giveaway/commands.js";

const BOT_PREFIX = process.env.BOT_PREFIX || "$";

export const commands = {
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
};

export async function handleCommand(message, commands) {
  if (!message.content.startsWith(BOT_PREFIX)) return false;

  const args = message.content.slice(BOT_PREFIX.length).trim().split(/ +/);
  const commandName = args[0];
  const command = commands[commandName];

  if (!command) {
    return false;
  }

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

    if (command.execute) {
      await command.execute(message, args.slice(1));
    }

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

const slashCommandHandlers = {
  "setup-tickets": async (interaction) => {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const description2 = interaction.options.getString("description_line2");
    const description3 = interaction.options.getString("description_line3");
    const moderatorRole = interaction.options.getRole("moderator_role");
    const color = interaction.options.getString("color");
    const enableClaiming = interaction.options.getBoolean("enable_claiming");

    const options = {
      ...(title && { title }),
      ...(description && { description }),
      ...(description2 && { description_line2: description2 }),
      ...(description3 && { description_line3: description3 }),
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
  },

  "resend-verify": async (interaction) => {
    try {
      const verificationChannelId = await db.getChannelId(
        interaction.guild.id,
        "verification",
      );
      const mockReaction = {
        message: {
          channelId: verificationChannelId,
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
    } catch (error) {
      console.error(error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Failed to send verification embeds.",
          flags: 64,
        });
      }
    }
  },

  welcome: async (interaction) => {
    await handleWelcome(interaction.member);
    await interaction.reply({
      content: "✅ Welcome message sent!",
      flags: 64,
    });
  },

  purge: async (interaction) => {
    const amount = interaction.options.getInteger("amount");
    await handlePurge(interaction, [amount]);
    const timeoutSeconds = 3;
    const purgeEmbed = new EmbedBuilder()
      .setDescription(`✅ Purged ${amount} messages!`)
      .setColor("#00ff00")
      .setFooter({
        text: `This message will be deleted in ${timeoutSeconds} seconds.`,
      });

    await interaction.reply({
      embeds: [purgeEmbed],
    });
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, timeoutSeconds * 1000);
  },

  userinfo: async (interaction) => {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);
    const userEmbed = createUserEmbed(user, member);
    await interaction.reply({ embeds: [userEmbed] });
  },

  serverinfo: async (interaction) => {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner();
    const serverEmbed = createServerEmbed(guild, owner);
    await interaction.reply({ embeds: [serverEmbed] });
  },

  lock: async (interaction) => {
    const lockChannel =
      interaction.options.getChannel("channel") || interaction.channel;
    await lockChannel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: false,
      },
    );
    await interaction.reply(`🔒 ${lockChannel} has been locked.`);
  },

  unlock: async (interaction) => {
    const unlockChannel =
      interaction.options.getChannel("channel") || interaction.channel;
    await unlockChannel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: null,
      },
    );
    await interaction.reply(`🔓 ${unlockChannel} has been unlocked.`);
  },

  nickname: async (interaction) => {
    const targetUser = interaction.options.getUser("user");
    const newNickname = interaction.options.getString("nickname");
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    try {
      await targetMember.setNickname(newNickname);
      await interaction.reply({
        content: `✅ Changed ${targetUser.tag}'s nickname to \`${newNickname}\``,
      });
    } catch (error) {
      await interaction.reply({
        content:
          "❌ Could not change nickname. User might have higher permissions.",
        flags: 64,
      });
      console.error(`Error changing nickname for ${targetUser.tag}:`, error);
    }
  },

  ping: async (interaction) => {
    await interaction.reply({
      content: "Pinging...",
    });
    const sent = await interaction.fetchReply();
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsHeartbeat = interaction.client.ws.ping;

    await interaction.editReply({
      content: `🏓 Pong!\n> Roundtrip: ${roundtrip}ms\n> Websocket: ${wsHeartbeat}ms`,
    });
  },

  avatar: async (interaction) => {
    const avatarUser = interaction.options.getUser("user") || interaction.user;
    const avatarEmbed = createAvatarEmbed(avatarUser);
    await interaction.reply({ embeds: [avatarEmbed] });
  },

  warn: handleWarnCommand,
  removewarning: handleRemoveWarningCommand,
  kick: handleKickCommand,
  ban: handleBanCommand,
  unban: handleUnbanCommand,
  timeout: handleTimeoutCommand,
  untimeout: handleUntimeoutCommand,
  warnings: handleWarningsCommand,
  modlogs: handleModlogsCommand,

  help: async (interaction) => {
    const helpEmbed = createHelpEmbed(slashCommands, BOT_PREFIX);
    await interaction.reply({ embeds: [helpEmbed] });
  },

  apply: handleApplyCommand,

  embed: async (interaction) => {
    const embedChannel = interaction.options.getChannel("channel");
    const embedTitle = interaction.options.getString("title");
    const embedDesc = interaction.options
      .getString("description")
      ?.replace(/\\n/g, "\n");
    const embedColor = interaction.options.getString("color");
    const embedThumb = interaction.options.getString("thumbnail");
    const embedImage = interaction.options.getString("image");
    const embedAuthor = interaction.options.getString("author");
    const embedAuthorIcon = interaction.options.getString("author_icon");
    const embedFooter = interaction.options.getString("footer");
    const embedFooterIcon = interaction.options.getString("footer_icon");
    const embedFields = interaction.options.getString("fields");
    const embedTimestamp = interaction.options.getString("timestamp");

    const embed = new EmbedBuilder();

    if (embedTitle) embed.setTitle(embedTitle);
    if (embedDesc) embed.setDescription(embedDesc);
    if (embedColor)
      embed.setColor(
        embedColor.startsWith("#") ? embedColor : `#${embedColor}`,
      );
    if (embedThumb) embed.setThumbnail(embedThumb);
    if (embedImage) embed.setImage(embedImage);
    if (embedAuthor)
      embed.setAuthor({
        name: embedAuthor,
        iconURL: embedAuthorIcon,
      });
    if (embedFooter)
      embed.setFooter({
        text: embedFooter,
        iconURL: embedFooterIcon,
      });
    if (embedTimestamp === "yes") embed.setTimestamp();

    if (embedFields) {
      const fieldArray = embedFields.split(",").map((field) => field.trim());
      for (const field of fieldArray) {
        const [name, value, inline] = field.split("|").map((f) => f.trim());
        if (name && value) {
          embed.addFields({
            name,
            value,
            inline: inline === "true",
          });
        }
      }
    }

    try {
      await embedChannel.send({ embeds: [embed] });
      await interaction.reply({
        content: `✅ Embed sent successfully in ${embedChannel}`,
        flags: 64,
      });
    } catch (error) {
      console.error("Error sending embed:", error);
      await interaction.reply({
        content:
          "❌ Failed to send embed. Make sure all URLs are valid and I have permission to send messages in that channel.",
        flags: 64,
      });
    }
  },

  automod: async (interaction) => {
    const automodSubcommand = interaction.options.getSubcommand();

    switch (automodSubcommand) {
      case "toggle": {
        const enabled = interaction.options.getBoolean("enabled");
        await updateAutomodSettings(interaction.guild.id, { enabled });
        await interaction.reply({
          content: `✅ Automod has been ${enabled ? "enabled" : "disabled"}.`,
          flags: 64,
        });
        break;
      }
      case "logchannel": {
        const logChannel = interaction.options.getChannel("channel");
        await updateAutomodSettings(interaction.guild.id, {
          logChannel: logChannel.id,
        });
        await interaction.reply({
          content: `✅ Automod logs will now be sent to ${logChannel}.`,
          flags: 64,
        });
        break;
      }
      case "exempt": {
        const type = interaction.options.getString("type");
        const target = interaction.options.getString("target");
        const settings = await getAutomodSettings(interaction.guild.id);

        switch (type) {
          case "add_role":
            if (!settings.exemptRoles.includes(target)) {
              settings.exemptRoles.push(target);
            }
            break;
          case "remove_role":
            settings.exemptRoles = settings.exemptRoles.filter(
              (id) => id !== target,
            );
            break;
          case "add_channel":
            if (!settings.exemptChannels.includes(target)) {
              settings.exemptChannels.push(target);
            }
            break;
          case "remove_channel":
            settings.exemptChannels = settings.exemptChannels.filter(
              (id) => id !== target,
            );
            break;
        }

        await updateAutomodSettings(interaction.guild.id, settings);
        await interaction.reply({
          content: `✅ Automod exemption settings updated.`,
          flags: 64,
        });
        break;
      }
      case "filter": {
        const filterType = interaction.options.getString("type");
        const filterAction = interaction.options.getString("action");
        const filterEnabled = interaction.options.getBoolean("enabled");
        const filterSettings = interaction.options.getString("settings");

        const currentSettings = await getAutomodSettings(interaction.guild.id);

        let updatedFilter = {
          ...currentSettings.filters[filterType],
          enabled: filterEnabled,
          action: filterAction,
        };

        if (filterSettings) {
          try {
            const parsedSettings = JSON.parse(filterSettings);
            updatedFilter = {
              ...updatedFilter,
              ...parsedSettings,
            };
          } catch (error) {
            await interaction.reply({
              content: "❌ Invalid JSON format for filter settings.",
              flags: 64,
            });
            console.error("Error parsing filter settings JSON:", error);
            return;
          }
        }

        currentSettings.filters[filterType] = updatedFilter;
        await updateAutomodSettings(interaction.guild.id, currentSettings);

        await interaction.reply({
          content: `✅ ${filterType} filter has been updated.`,
          flags: 64,
        });
        break;
      }
    }
  },

  "automod-whitelist-role": handleAutomodWhitelistRole,
  "automod-unwhitelist-role": handleAutomodUnwhitelistRole,
  "automod-list-whitelists": handleAutomodListWhitelists,
  "automod-exempt-media-channel": async (interaction) => {
    const { handleMediaChannelExemption } = await import("../handlers/automod/handlers.js");
    await handleMediaChannelExemption(interaction);
  },

  logs: async (interaction) => {
    const logsSubcommand = interaction.options.getSubcommand();

    switch (logsSubcommand) {
      case "setup": {
        const type = interaction.options.getString("type");
        const channel = interaction.options.getChannel("channel");
        const allowedRoles = interaction.options.getRole("allowed_roles");
        const pingRoles = interaction.options.getRole("ping_roles");

        const settings = {
          channel_id: channel.id,
          allowed_roles: allowedRoles ? [allowedRoles.id] : [],
          ping_roles: pingRoles ? [pingRoles.id] : [],
          enabled: true,
        };

        await db.updateLoggingSettings(interaction.guild.id, type, settings);

        await channel.permissionOverwrites.edit(interaction.guild.members.me, {
          ViewChannel: true,
          SendMessages: true,
          EmbedLinks: true,
        });

        if (allowedRoles) {
          await channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
              ViewChannel: false,
            },
          );
          await channel.permissionOverwrites.edit(allowedRoles, {
            ViewChannel: true,
          });
        }

        await interaction.reply({
          content: `✅ Successfully set up ${type} logs in ${channel}`,
          flags: 64,
        });
        break;
      }

      case "disable": {
        const type = interaction.options.getString("type");
        await db.updateLoggingSettings(interaction.guild.id, type, {
          enabled: false,
        });

        await interaction.reply({
          content: `✅ Disabled ${type} logs`,
          flags: 64,
        });
        break;
      }

      case "view": {
        const settings = await db.getLoggingSettings(interaction.guild.id);
        if (!settings || settings.length === 0) {
          await interaction.reply({
            content: "❌ No logging settings configured for this server",
            flags: 64,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("📝 Logging Settings")
          .setColor("#00ff00")
          .setDescription(
            settings
              .map((setting) => {
                const channel = setting.channel_id
                  ? interaction.guild.channels.cache.get(setting.channel_id)
                  : null;
                const allowedRoles =
                  setting.allowed_roles && setting.allowed_roles.length
                    ? setting.allowed_roles.map((id) => `<@&${id}>`).join(", ")
                    : "None";
                const pingRoles =
                  setting.ping_roles && setting.ping_roles.length
                    ? setting.ping_roles.map((id) => `<@&${id}>`).join(", ")
                    : "None";

                return `**${setting.log_type}**
Channel: ${channel ? channel.toString() : "Not configured"}
Enabled: ${setting.enabled ? "Yes" : "No"}
Allowed Roles: ${allowedRoles}
Ping Roles: ${pingRoles}`;
              })
              .join("\n\n"),
          );

        await interaction.reply({ embeds: [embed], flags: 64 });
        break;
      }
    }
  },

  giveaway: handleGiveawayCommand,
  settings: handleSettingsCommand,
  setboostchannel: async (interaction) => {
    const boostChannel = interaction.options.getChannel("channel");
    await handleSetBoostChannel(interaction, boostChannel.id);
  },

  dashboard: async (interaction) => {
    try {
      const result = await generateApiKey(interaction.user.id);
      if (!result.success && result.key) {
        await interaction.reply({
          content: `Your existing API key is: \`${result.key}\`\nKeep this key secret! Use it to access the dashboard with the Authorization header: \`Bearer ${result.key}\``,
          flags: 64,
        });
      } else if (result.success) {
        await interaction.reply({
          content: `Your new API key is: \`${result.key}\`\nKeep this key secret! Use it to access the dashboard with the Authorization header: \`Bearer ${result.key}\``,
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: "❌ Failed to generate API key. Please try again later.",
          flags: 64,
        });
      }
    } catch (error) {
      console.error("Error generating API key:", error);
      await interaction.reply({
        content: "❌ An error occurred while generating your API key.",
        flags: 64,
      });
    }
  },

  reactionroles: async (interaction) => {
    const channel = interaction.options.getChannel("channel");
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const rolesJson = interaction.options.getString("roles");
    const color = interaction.options.getString("color");
    const { createReactionRoles } = await import(
      "../handlers/reactionRolesHandler.js"
    );
    try {
      let roles;
      try {
        roles = JSON.parse(rolesJson);
      } catch (error) {
        console.error("Error parsing roles JSON:", error);
        await interaction.reply({
          content:
            '❌ Invalid JSON format. Please use this format:\n```json\n[\n  {\n    "id": "1234567890",\n    "label": "Role Name",\n    "emoji": "👍",\n    "style": "Primary"\n  }\n]\n```\nValid styles: Primary, Secondary, Success, Danger',
          flags: 64,
        });
        return;
      }

      if (!Array.isArray(roles)) {
        await interaction.reply({
          content: "❌ Roles must be provided as an array []",
          flags: 64,
        });
        return;
      }

      for (const role of roles) {
        if (!role || typeof role !== "object") {
          await interaction.reply({
            content:
              "❌ Each role must be an object with id, label, emoji, and style properties",
            flags: 64,
          });
          return;
        }

        if (!role.id || !role.label || !role.style) {
          await interaction.reply({
            content:
              "❌ Each role must have 'id', 'label', and 'style' properties",
            flags: 64,
          });
          return;
        }

        const validStyles = ["Primary", "Secondary", "Success", "Danger"];
        if (!validStyles.includes(role.style)) {
          await interaction.reply({
            content: `❌ Invalid style: ${role.style}. Must be one of: ${validStyles.join(", ")}`,
            flags: 64,
          });
          return;
        }

        if (!interaction.guild.roles.cache.has(role.id)) {
          await interaction.reply({
            content: `❌ Role with ID ${role.id} does not exist in this server`,
            flags: 64,
          });
          return;
        }
      }

      await createReactionRoles(channel, {
        title,
        description,
        roles,
        color,
      });
      await interaction.reply({
        content: `✅ Reaction roles message created in ${channel}`,
        flags: 64,
      });
    } catch (error) {
      console.error("Error creating reaction roles:", error);
      if (error.code === "22P02") {
        await interaction.reply({
          content:
            "❌ There was an error saving the roles configuration. Please make sure your JSON is properly formatted.",
          flags: 64,
        });
      } else {
        await interaction.reply({
          content:
            "❌ An error occurred while creating reaction roles. Make sure the bot has the necessary permissions.",
          flags: 64,
        });
      }
    }
  },

  donate: async (interaction) => {
    const donateEmbed = new EmbedBuilder()
      .setTitle("Support the Bot")
      .setDescription(
        "If you'd like to support the development of this bot, you can do so through these platforms:",
      )
      .addFields(
        {
          name: "Ko-fi",
          value: "[Buy me a coffee! ☕](https://ko-fi.com/yourusername)",
          inline: true,
        },
        {
          name: "GitHub",
          value:
            "[View the source code 💻](https://github.com/yourusername/repository)",
          inline: true,
        },
      )
      .setColor("#FF69B4")
      .setTimestamp();
    await interaction.reply({ embeds: [donateEmbed] });
  },
};

export async function handleSlashCommand(interaction, client) {
  try {
    if (
      ["timeout", "untimeout", "ban", "unban", "kick"].includes(
        interaction.commandName,
      )
    ) {
      await interaction.deferReply({ flags: 64 });
    }

    const handler = slashCommandHandlers[interaction.commandName];

    if (handler) {
      await handler(interaction, client);
    } else {
      console.warn(`No handler found for command: ${interaction.commandName}`);
      await interaction.reply({
        content: "This command is not implemented yet.",
        flags: 64,
      });
    }
  } catch (error) {
    console.error(
      `Error executing slash command ${interaction.commandName}:`,
      error,
    );

    const errorMessage =
      error.code === "UND_ERR_CONNECT_TIMEOUT"
        ? "❌ Connection timeout. Please try again."
        : "❌ An error occurred while executing the command.";

    if (interaction.deferred) {
      await interaction
        .editReply({
          content: errorMessage,
          flags: 64,
        })
        .catch(console.error);
    } else if (!interaction.replied) {
      await interaction
        .reply({
          content: errorMessage,
          flags: 64,
        })
        .catch(console.error);
    }
  }
}

export async function registerSlashCommands(client) {
  try {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN,
    );

    const filteredSlashCommands = slashCommands.filter(
      (command) => !["settings", "setboostchannel"].includes(command.name),
    );

    const allCommands = [
      ...filteredSlashCommands.map((command) => command.toJSON()),
      ...automodCommands,
      ...antiRaidCommands,
      ...settingsCommands,
      ...applicationCommands,
    ];

    const commandNames = new Set();
    const duplicateNames = [];

    allCommands.forEach((cmd) => {
      if (commandNames.has(cmd.name)) {
        duplicateNames.push(cmd.name);
      }
      commandNames.add(cmd.name);
    });

    if (duplicateNames.length > 0) {
      console.error(
        `Found duplicate command names: ${duplicateNames.join(", ")}`,
      );

      const uniqueCommands = [];
      const seenNames = new Set();

      allCommands.forEach((cmd) => {
        if (!seenNames.has(cmd.name)) {
          uniqueCommands.push(cmd);
          seenNames.add(cmd.name);
        }
      });

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: uniqueCommands,
      });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: allCommands,
      });
    }
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
}
