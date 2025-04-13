import { EmbedBuilder } from "discord.js";

export function createAvatarEmbed(user) {
    return new EmbedBuilder()
        .setTitle(`${user.tag}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
        .setColor("#2F3136")
        .setTimestamp();
}