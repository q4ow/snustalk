import { EmbedBuilder, ChannelType } from "discord.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

export async function handleGoodbye(member) {
  try {
    const { guild } = member;
    logger.info(`Processing goodbye for ${member.user.tag} in ${guild.name}`);

    const goodbyeChannelId = await db.getChannelId(guild.id, "goodbye");

    if (!goodbyeChannelId) {
      logger.warn(`No goodbye channel configured for guild ${guild.name}`);
      return;
    }

    const goodbyeChannel = await guild.channels
      .fetch(goodbyeChannelId)
      .catch((error) => {
        logger.error(
          `Failed to fetch goodbye channel ${goodbyeChannelId} in ${guild.name}:`,
          error,
        );
        return null;
      });

    if (
      !goodbyeChannel ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
        goodbyeChannel.type,
      )
    ) {
      logger.warn(
        `Invalid goodbye channel ${goodbyeChannelId} in ${guild.name}: ${goodbyeChannel ? "Wrong channel type" : "Channel not found"}`,
      );
      return;
    }

    const memberCount = guild.memberCount;
    const joinDate = member.joinedAt;
    const leaveDate = new Date();
    const membershipDuration = Math.floor(
      (leaveDate - joinDate) / (1000 * 60 * 60 * 24),
    );

    logger.debug(
      `Member ${member.user.tag} was in ${guild.name} for ${membershipDuration} days`,
    );

    let durationText;
    if (membershipDuration < 1) {
      durationText = "Less than a day";
    } else if (membershipDuration === 1) {
      durationText = "1 day";
    } else {
      durationText = `${membershipDuration} days`;
    }

    const goodbyeEmbed = new EmbedBuilder()
      .setAuthor({
        name: `Member Left ${guild.name}`,
        iconURL: guild.iconURL({ dynamic: true }),
      })
      .setDescription(
        `**${member.user.tag}** has left the server 👋\n\n` +
          `They were a member for ${durationText}\n` +
          `We now have **${memberCount}** members remaining`,
      )
      .setColor("#FF6B6B")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .addFields(
        {
          name: "📅 Joined Server",
          value: `<t:${Math.floor(joinDate.getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name: "📤 Left Server",
          value: `<t:${Math.floor(leaveDate.getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name: "👥 Member Count",
          value: `${memberCount} members`,
          inline: true,
        },
      )
      .setFooter({ text: `ID: ${member.user.id}` })
      .setTimestamp();

    try {
      await goodbyeChannel.send({ embeds: [goodbyeEmbed] });
      logger.info(
        `Sent goodbye message for ${member.user.tag} in ${guild.name}`,
      );
    } catch (sendError) {
      logger.error(
        `Failed to send goodbye message for ${member.user.tag} in ${guild.name}:`,
        sendError,
      );
    }
  } catch (error) {
    logger.error(`Error processing goodbye for ${member?.user?.tag}:`, error);
  }
}
