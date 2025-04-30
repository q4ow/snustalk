import { EmbedBuilder } from "discord.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

export async function handleWelcome(member) {
  try {
    const { guild } = member;
    logger.info(`Processing welcome for ${member.user.tag} in ${guild.name}`);

    const unverifiedRoleId = await db.getRoleId(guild.id, "unverified");
    if (unverifiedRoleId) {
      try {
        const unverifiedRole = await guild.roles.fetch(unverifiedRoleId);
        if (unverifiedRole) {
          await member.roles.add(unverifiedRole);
          logger.debug(`Added unverified role to ${member.user.tag}`);
        } else {
          logger.warn(
            `Unverified role ${unverifiedRoleId} not found in guild ${guild.name}`,
          );
        }
      } catch (error) {
        if (error.code === 50013) {
          logger.debug(
            `Skipping role modification for staff member: ${member.user.tag}`,
          );
        } else if (error.code === 10011) {
          logger.error(
            `Role ${unverifiedRoleId} no longer exists in guild ${guild.name}`,
          );
        } else {
          logger.error(
            `Error adding unverified role to ${member.user.tag}:`,
            error,
          );
          throw error;
        }
      }
    } else {
      logger.debug(`No unverified role configured for guild ${guild.name}`);
    }

    const welcomeChannelId = await db.getChannelId(guild.id, "welcome");
    if (!welcomeChannelId) {
      logger.debug(`No welcome channel configured for guild ${guild.name}`);
      return;
    }

    const welcomeChannel = await guild.channels.fetch(welcomeChannelId);
    if (!welcomeChannel) {
      logger.warn(
        `Welcome channel ${welcomeChannelId} not found in guild ${guild.name}`,
      );
      return;
    }

    const memberCount = guild.memberCount;
    logger.debug(
      `Creating welcome embed for ${member.user.tag} (Member #${memberCount})`,
    );

    const welcomeEmbed = new EmbedBuilder()
      .setAuthor({
        name: `Welcome to ${guild.name}!`,
        iconURL: guild.iconURL({ dynamic: true }),
      })
      .setDescription(
        `Hey ${member.user.username.charAt(0).toUpperCase() + member.user.username.slice(1)}, welcome to our community! 🎉\n\n` +
          `You are our **${memberCount}${getSuffix(memberCount)}** member\n\n` +
          `📜 Please read our rules and guidelines\n` +
          `🎭 Get your roles in our roles channel\n` +
          `💬 Introduce yourself to the community`,
      )
      .setColor("#2B82E4")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .addFields(
        {
          name: "📅 Account Created",
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "👥 Member Count",
          value: `${memberCount} members`,
          inline: true,
        },
      )
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .setFooter({ text: `ID: ${member.user.id}` })
      .setTimestamp();

    await welcomeChannel.send({
      content: `Welcome ${member}! 🎉`,
      embeds: [welcomeEmbed],
    });

    logger.info(`Sent welcome message for ${member.user.tag} in ${guild.name}`);
  } catch (error) {
    logger.error(`Error welcoming member ${member?.user?.tag}:`, error);
  }
}

function getSuffix(number) {
  const j = number % 10;
  const k = number % 100;
  if (j == 1 && k != 11) return "st";
  if (j == 2 && k != 12) return "nd";
  if (j == 3 && k != 13) return "rd";
  return "th";
}
