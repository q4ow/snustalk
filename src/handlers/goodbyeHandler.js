import { EmbedBuilder } from "discord.js";

export async function handleGoodbye(member) {
  try {
    const { guild } = member;

    const goodbyeChannel = await guild.channels.fetch(
      process.env.GOODBYE_CHANNEL_ID,
    );
    if (!goodbyeChannel) return;

    const memberCount = guild.memberCount;

    const goodbyeEmbed = new EmbedBuilder()
      .setTitle("Goodbye!")
      .setDescription(
        `**${member.user.username}** has left the server\nWe now have ${memberCount} members`,
      )
      .setColor("#ff0000")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setTimestamp();

    await goodbyeChannel.send({ embeds: [goodbyeEmbed] });
  } catch (error) {
    console.error("Error in goodbye handler:", error);
  }
}
