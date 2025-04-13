import { EmbedBuilder } from "discord.js";

export function createServerEmbed(guild, owner) {
    return new EmbedBuilder()
        .setTitle(`Server Information - ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setColor("#2F3136")
        .addFields(
            { name: "Owner", value: owner.user.tag, inline: true },
            {
                name: "Created",
                value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
            { name: "Members", value: `${guild.memberCount}`, inline: true },
            {
                name: "Channels",
                value: `${guild.channels.cache.size}`,
                inline: true,
            },
            { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
            { name: "Boost Level", value: `${guild.premiumTier}`, inline: true },
            {
                name: "Boosts",
                value: `${guild.premiumSubscriptionCount || 0}`,
                inline: true,
            },
        )
        .setTimestamp();
}