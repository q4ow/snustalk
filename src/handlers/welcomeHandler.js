import { EmbedBuilder } from 'discord.js';

export async function handleWelcome(member) {
    try {
        const { guild } = member;

        const unverifiedRole = await guild.roles.fetch(process.env.UNVERIFIED_ROLE_ID);
        if (unverifiedRole) {
            try {
                await member.roles.add(unverifiedRole);
            } catch (error) {
                if (error.code === 50013) {
                    console.log(`Skipping role modification for staff member: ${member.user.tag}`);
                } else if (error.code === 10011) {
                    console.error(`Role no longer exists in the guild: ${error.message}`);
                } else {
                    throw error;
                }
            }
        }

        const welcomeChannel = await guild.channels.fetch(process.env.WELCOME_CHANNEL_ID);
        if (!welcomeChannel) return;

        const memberCount = guild.memberCount;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('Welcome to the Server!')
            .setDescription(`Welcome ${member} to **${guild.name}**\nYou are our ${memberCount}${getSuffix(memberCount)} member`)
            .setColor('#00ff00')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setTimestamp();

        await welcomeChannel.send({ embeds: [welcomeEmbed] });

    } catch (error) {
        console.error('Error in welcome handler:', error);
    }
}

function getSuffix(number) {
    const j = number % 10;
    const k = number % 100;
    if (j == 1 && k != 11) return 'st';
    if (j == 2 && k != 12) return 'nd';
    if (j == 3 && k != 13) return 'rd';
    return 'th';
}