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

export async function handleSlashCommand(interaction) {
  try {
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
