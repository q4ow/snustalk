import { EmbedBuilder } from "discord.js";

export function createUserEmbed(user, member) {
  return new EmbedBuilder()
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
                .filter((r) => r.id !== member.guild.id)
                .map((r) => r)
                .join(", ")
            : "No roles",
      },
    )
    .setTimestamp();
}
