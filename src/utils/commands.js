import { setupTicketSystem } from "../handlers/ticketHandler.js";
import { handleVerification } from "../handlers/verificationHandler.js";
import { handleWelcome } from "../handlers/welcomeHandler.js";
import { handlePurge } from "../handlers/purgeHandler.js";
import { REST, Routes, EmbedBuilder } from "discord.js";
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
import { createHelpEmbed } from "../embeds/helpEmbed.js";
import { createUserEmbed } from "../embeds/userEmbed.js";
import { createServerEmbed } from "../embeds/serverEmbed.js";
import { createAvatarEmbed } from "../embeds/avatarEmbed.js";
import { slashCommands } from "./slashCommands.js";
import { startApplication } from "../handlers/applicationHandler.js";
import {
  handleSettingsCommand,
  handleSetBoostChannel,
} from "../handlers/settingsHandler.js";
import { antiRaidCommands } from "../handlers/antiRaid/commands.js";
import { automodCommands } from "../handlers/automod/commands.js";
import {
  getAutomodSettings,
  updateAutomodSettings,
  handleAutomodWhitelistRole,
  handleAutomodUnwhitelistRole,
  handleAutomodListWhitelists,
} from "../handlers/automod/handlers.js";
import { db } from "./database.js";
import { generateApiKey } from "./generateApiKey.js";

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

export async function handleSlashCommand(interaction, client) {
  try {
    if (
      ["timeout", "untimeout", "ban", "kick"].includes(interaction.commandName)
    ) {
      await interaction.deferReply({ flags: 64 });
    }

    switch (interaction.commandName) {
      case "setup-tickets":
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        const description2 = interaction.options.getString("description_line2");
        const description3 = interaction.options.getString("description_line3");
        const moderatorRole = interaction.options.getRole("moderator_role");
        const color = interaction.options.getString("color");
        const enableClaiming =
          interaction.options.getBoolean("enable_claiming");

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
        break;

      case "resend-verify":
        try {
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
        } catch (error) {
          console.error(error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ Failed to send verification embeds.",
              flags: 64,
            });
          }
        }
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
        const userEmbed = createUserEmbed(user, member);
        await interaction.reply({ embeds: [userEmbed] });
        break;

      case "serverinfo":
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        const serverEmbed = createServerEmbed(guild, owner);
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
        await interaction.reply({
          content: "Pinging...",
        });
        const sent = await interaction.fetchReply();
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const wsHeartbeat = interaction.client.ws.ping;

        await interaction.editReply({
          content: `🏓 Pong!\n> Roundtrip: ${roundtrip}ms\n> Websocket: ${wsHeartbeat}ms`,
        });
        break;

      case "avatar":
        const avatarUser =
          interaction.options.getUser("user") || interaction.user;
        const avatarEmbed = createAvatarEmbed(avatarUser);
        await interaction.reply({ embeds: [avatarEmbed] });
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
        try {
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
            await interaction.editReply({
              content: "❌ You cannot timeout this user due to role hierarchy.",
              flags: 64,
            });
            return;
          }

          const duration = parseDuration(durationStr);
          if (!duration) {
            await interaction.editReply({
              content:
                "❌ Invalid duration format. Use format like: 1h, 1d, 30m",
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

          await interaction.editReply({
            embeds: [createModActionEmbed(timeout, interaction.guild)],
            flags: 64,
          });
        } catch (error) {
          console.error("Error in timeout command:", error);
          await interaction.editReply({
            content:
              error.code === "UND_ERR_CONNECT_TIMEOUT"
                ? "❌ Connection timeout. Please try again."
                : "❌ Failed to timeout user. Please try again.",
            flags: 64,
          });
        }
        break;

      case "untimeout":
        try {
          const untimeoutUser = interaction.options.getUser("user");
          const untimeoutReason = interaction.options.getString("reason");
          const untimeoutMember = await interaction.guild.members.fetch(
            untimeoutUser.id,
          );

          if (
            untimeoutMember.roles.highest.position >=
            interaction.member.roles.highest.position
          ) {
            await interaction.editReply({
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

          await interaction.editReply({
            embeds: [createModActionEmbed(untimeout, interaction.guild)],
            flags: 64,
          });
        } catch (error) {
          console.error("Error in untimeout command:", error);
          await interaction.editReply({
            content:
              error.code === "UND_ERR_CONNECT_TIMEOUT"
                ? "❌ Connection timeout. Please try again."
                : "❌ Failed to remove timeout. Please try again.",
            flags: 64,
          });
        }
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

      case "help":
        const helpEmbed = createHelpEmbed(slashCommands, BOT_PREFIX);
        await interaction.reply({ embeds: [helpEmbed] });
        break;

      case "apply":
        try {
          let appChannel;
          try {
            appChannel = await interaction.guild.channels.fetch(
              process.env.APPLICATIONS_CHANNEL_ID,
            );
          } catch (error) {
            await interaction.reply({
              content:
                "❌ I don't have access to the applications channel. Please contact an administrator.",
              flags: 64,
            });
            return;
          }

          if (!appChannel) {
            await interaction.reply({
              content:
                "❌ Applications channel not found. Please contact an administrator.",
              flags: 64,
            });
            return;
          }

          const permissions = appChannel.permissionsFor(
            interaction.guild.members.me,
          );
          if (!permissions?.has(["ViewChannel", "SendMessages"])) {
            await interaction.reply({
              content:
                "❌ I don't have the required permissions in the applications channel. Please contact an administrator.",
              flags: 64,
            });
            return;
          }

          if (interaction.channel.id !== process.env.APPLICATIONS_CHANNEL_ID) {
            await interaction.reply({
              content: `❌ Please use this command in ${appChannel}`,
              flags: 64,
            });
            return;
          }

          await startApplication(interaction);
        } catch (error) {
          console.error("Error in apply command:", error);
          await interaction.reply({
            content:
              "❌ An error occurred while processing your application. Please try again later or contact an administrator.",
            flags: 64,
          });
        }
        break;

      case "embed":
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
          const fieldArray = embedFields
            .split(",")
            .map((field) => field.trim());
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
        break;

      case "automod":
        const automodSubcommand = interaction.options.getSubcommand();

        switch (automodSubcommand) {
          case "toggle":
            const enabled = interaction.options.getBoolean("enabled");
            await updateAutomodSettings(interaction.guild.id, { enabled });
            await interaction.reply({
              content: `✅ Automod has been ${enabled ? "enabled" : "disabled"}.`,
              flags: 64,
            });
            break;

          case "logchannel":
            const logChannel = interaction.options.getChannel("channel");
            await updateAutomodSettings(interaction.guild.id, {
              logChannel: logChannel.id,
            });
            await interaction.reply({
              content: `✅ Automod logs will now be sent to ${logChannel}.`,
              flags: 64,
            });
            break;

          case "exempt":
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

          case "filter":
            const filterType = interaction.options.getString("type");
            const filterAction = interaction.options.getString("action");
            const filterEnabled = interaction.options.getBoolean("enabled");
            const filterSettings = interaction.options.getString("settings");

            const currentSettings = await getAutomodSettings(
              interaction.guild.id,
            );

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
        break;

      case "automod-whitelist-role":
      case "automod-unwhitelist-role":
      case "automod-list-whitelists":
        const handler = {
          "automod-whitelist-role": handleAutomodWhitelistRole,
          "automod-unwhitelist-role": handleAutomodUnwhitelistRole,
          "automod-list-whitelists": handleAutomodListWhitelists,
        }[interaction.commandName];

        if (handler) {
          await handler(interaction);
        }
        break;

      case "typingscore": {
        const topWpm = await db.getTypingScore(interaction.user.id);
        const embed = new EmbedBuilder()
          .setTitle("Your Top Typing Speed")
          .setColor("#00bfff")
          .setDescription(
            topWpm
              ? `🏁 **${topWpm} WPM**`
              : "You haven't submitted a typing score yet!",
          );
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "typingleaderboard": {
        const leaderboard = await db.getTypingLeaderboard(10);
        const embed = new EmbedBuilder()
          .setTitle("🏆 Typing Leaderboard")
          .setColor("#FFD700");

        if (!leaderboard.length) {
          embed.setDescription("No scores on the leaderboard yet!");
        } else {
          embed.setDescription(
            leaderboard
              .map(
                (row, i) =>
                  `\`${i + 1}.\` <@${row.user_id}> — **${row.top_wpm} WPM**`,
              )
              .join("\n"),
          );
        }
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "typinggame": {
        const url = process.env.TYPING_GAME_URL || "https://snus.slop.sh";
        const embed = new EmbedBuilder()
          .setTitle("SnusTalk Typing Challenge")
          .setDescription(
            `[Click here to play SnusType!](${url})\n\nCompete for the highest WPM and climb the leaderboard!`,
          )
          .setColor("#00ff99");
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "logs":
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

            await db.updateLoggingSettings(
              interaction.guild.id,
              type,
              settings,
            );

            await channel.permissionOverwrites.edit(
              interaction.guild.members.me,
              {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true,
              },
            );

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
                    const channel = interaction.guild.channels.cache.get(
                      setting.channel_id,
                    );
                    const allowedRoles =
                      setting.allowed_roles
                        .map((id) => `<@&${id}>`)
                        .join(", ") || "None";
                    const pingRoles =
                      setting.ping_roles.map((id) => `<@&${id}>`).join(", ") ||
                      "None";

                    return `**${setting.log_type}**
Channel: ${channel ? channel.toString() : "Invalid Channel"}
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
        break;

      case "giveaway": {
        const sub = interaction.options.getSubcommand();
        if (sub === "create") {
          const prize = interaction.options.getString("prize");
          const durationStr = interaction.options.getString("duration");
          const winnerCount = interaction.options.getInteger("winners") || 1;
          const description = interaction.options.getString("description");
          const channel =
            interaction.options.getChannel("channel") || interaction.channel;
          const requiredRole = interaction.options.getRole("required_role");
          const minAccountAge =
            interaction.options.getString("min_account_age");
          const minServerAge = interaction.options.getString("min_server_age");
          const buttonLabel =
            interaction.options.getString("button_label") ||
            "Enter Giveaway 🎉";
          const embedColor =
            interaction.options.getString("embed_color") || "#FF69B4";
          const image = interaction.options.getString("image");
          const endMessage = interaction.options.getString("end_message");

          const requirements = {};
          if (requiredRole) requirements.roles = [requiredRole.id];
          if (minAccountAge) {
            const duration = parseDuration(minAccountAge);
            if (!duration) {
              await interaction.reply({
                content:
                  "❌ Invalid account age format. Use format like: 1d, 1w",
                flags: 64,
              });
              return;
            }
            requirements.min_account_age = duration;
          }
          if (minServerAge) {
            const duration = parseDuration(minServerAge);
            if (!duration) {
              await interaction.reply({
                content:
                  "❌ Invalid server age format. Use format like: 1d, 1w",
                flags: 64,
              });
              return;
            }
            requirements.min_server_age = duration;
          }

          const duration = parseDuration(durationStr);
          if (!duration) {
            await interaction.reply({
              content:
                "❌ Invalid duration format. Use format like: 1h, 1d, 1w",
              flags: 64,
            });
            return;
          }

          try {
            await client.giveaways.createGiveaway({
              guild_id: interaction.guildId,
              channel_id: channel.id,
              host_id: interaction.user.id,
              prize,
              description,
              duration,
              winner_count: winnerCount,
              requirements,
              button_label: buttonLabel,
              embed_color: embedColor,
              image,
              end_message: endMessage,
            });
            await interaction.reply({
              content: `✅ Created giveaway for **${prize}** in ${channel}`,
              flags: 64,
            });
          } catch (error) {
            await interaction.reply({
              content: `❌ Failed to create giveaway: ${error.message}`,
              flags: 64,
            });
          }
        } else if (sub === "end") {
          const messageId = interaction.options.getString("message_id");
          try {
            const giveaway = await db.getGiveawayByMessageId(
              messageId,
              interaction.guildId,
            );
            if (!giveaway) {
              await interaction.reply({
                content: "❌ Giveaway not found",
                flags: 64,
              });
              return;
            }

            const winners = await client.giveaways.endGiveaway(
              giveaway.id,
              true,
            );
            await interaction.reply({
              content:
                winners.length > 0
                  ? `✅ Giveaway ended! Winners: ${winners.map((id) => `<@${id}>`).join(", ")}`
                  : "✅ Giveaway ended! No valid winners.",
              flags: 64,
            });
          } catch (error) {
            await interaction.reply({
              content: `❌ Failed to end giveaway: ${error.message}`,
              flags: 64,
            });
          }
        } else if (sub === "reroll") {
          const messageId = interaction.options.getString("message_id");
          const winnerCount = interaction.options.getInteger("winners");

          try {
            const giveaway = await db.getGiveawayByMessageId(
              messageId,
              interaction.guildId,
            );
            if (!giveaway) {
              await interaction.reply({
                content: "❌ Giveaway not found",
                flags: 64,
              });
              return;
            }
            if (!giveaway.ended) {
              await interaction.reply({
                content: "❌ This giveaway hasn't ended yet",
                flags: 64,
              });
              return;
            }

            const winners = await client.giveaways.rerollGiveaway(
              giveaway.id,
              winnerCount,
            );
            await interaction.reply({
              content:
                winners.length > 0
                  ? `🎉 New winner${winners.length > 1 ? "s" : ""}: ${winners.map((id) => `<@${id}>`).join(", ")}!`
                  : "❌ Could not determine new winner(s). No valid entries found.",
              flags: 64,
            });
          } catch (error) {
            await interaction.reply({
              content: `❌ Failed to reroll giveaway: ${error.message}`,
              flags: 64,
            });
          }
        } else if (sub === "blacklist") {
          const messageId = interaction.options.getString("message_id");
          const user = interaction.options.getUser("user");

          try {
            const giveaway = await db.getGiveawayByMessageId(
              messageId,
              interaction.guildId,
            );
            if (!giveaway) {
              await interaction.reply({
                content: "❌ Giveaway not found",
                flags: 64,
              });
              return;
            }

            await client.giveaways.blacklistUser(giveaway.id, user.id);
            await interaction.reply({
              content: `✅ ${user.tag} has been blacklisted from the giveaway.`,
              flags: 64,
            });
          } catch (error) {
            await interaction.reply({
              content: `❌ Failed to blacklist user: ${error.message}`,
              flags: 64,
            });
          }
        } else if (sub === "entries") {
          const messageId = interaction.options.getString("message_id");
          const giveaway = await db.getGiveawayByMessageId(
            messageId,
            interaction.guildId,
          );
          if (!giveaway) {
            await interaction.reply({
              content: "❌ Giveaway not found",
              flags: 64,
            });
            return;
          }
          const entries = await db.getGiveawayEntries(giveaway.id);
          if (!entries.length) {
            await interaction.reply({ content: "No entries yet!", flags: 64 });
            return;
          }
          const entryMentions = entries
            .map((e) => `<@${e.user_id}>`)
            .join(", ");
          await interaction.reply({
            content: `Entries (${entries.length}):\n${entryMentions}`,
            flags: 64,
          });
        }
        break;
      }

      case "settings":
        await handleSettingsCommand(interaction);
        break;

      case "dashboard":
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
        break;

      case "reactionroles": {
        const channel = interaction.options.getChannel("channel");
        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        const rolesJson = interaction.options.getString("roles");
        const color = interaction.options.getString("color");
        const { createReactionRoles } = await import(
          "../handlers/reactionRolesHandler.js"
        );
        try {
          const roles = JSON.parse(rolesJson);
          if (!Array.isArray(roles)) {
            await interaction.reply({
              content: "❌ Roles must be provided as an array.",
              flags: 64,
            });
            return;
          }
          for (const role of roles) {
            if (!role.id || !interaction.guild.roles.cache.has(role.id)) {
              await interaction.reply({
                content: `❌ Invalid role ID: ${role.id}`,
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
          await interaction.reply({
            content:
              '❌ Invalid JSON format for roles. Example format:\n```json\n[\n  {\n    "id": "role_id",\n    "label": "Display Name",\n    "emoji": "👍",\n    "style": "Primary"\n  }\n]```\nValid styles: Primary, Secondary, Success, Danger',
            flags: 64,
          });
        }
        break;
      }

      case "setboostchannel":
        const boostChannel = interaction.options.getChannel("channel");
        await handleSetBoostChannel(interaction, boostChannel.id);
        break;

      case "donate":
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
        break;
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

    const allCommands = [
      ...slashCommands.map((command) => command.toJSON()),
      ...automodCommands,
      ...antiRaidCommands,
    ];

    await rest.put(Routes.applicationCommands(client.user.id), {
      body: allCommands,
    });

    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
}
