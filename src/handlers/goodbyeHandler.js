import { EmbedBuilder, ChannelType } from "discord.js";

export async function handleGoodbye(member) {
  try {
    const { guild } = member;

    const goodbyeChannel = await db.getChannelId(guild.id, "goodbye");

    if (!goodbyeChannel ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(goodbyeChannel.type)) {
      console.warn(`Goodbye channel not found or not a text channel: ${goodbyeChannel}`);
      return;
    }

    const memberCount = guild.memberCount;
    const joinDate = member.joinedAt;
    const leaveDate = new Date();
    const membershipDuration = Math.floor(
      (leaveDate - joinDate) / (1000 * 60 * 60 * 24),
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
    } catch (sendError) {
      console.error("Failed to send goodbye message:", sendError);
    }
  } catch (error) {
    console.error("Error in goodbye handler:", error);
  }
}
