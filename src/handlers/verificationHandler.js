import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function handleVerification(reaction, user) {
    try {
        if (user.bot) return;

        if (reaction.message.channelId !== process.env.VERIFICATION_CHANNEL_ID) return;
        if (reaction.emoji.name !== '✅') return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);

        const verifiedRole = await guild.roles.fetch(process.env.VERIFIED_ROLE_ID);
        const unverifiedRole = await guild.roles.fetch(process.env.UNVERIFIED_ROLE_ID);

        if (!verifiedRole || !unverifiedRole) {
            console.error('Required roles not found');
            return;
        }

        try {
            await member.roles.add(verifiedRole);
            await member.roles.remove(unverifiedRole);
        } catch (error) {
            if (error.code === 50013) {
                console.log(`Skipping role modification for staff member: ${member.user.tag}`);
                return;
            } else if (error.code === 10011) {
                console.error(`Role no longer exists in the guild: ${error.message}`);
                return;
            } else {
                throw error;
            }
        }

        try {
            const verificationEmbed = new EmbedBuilder()
                .setTitle('🎉 Welcome to ' + guild.name + '!')
                .setDescription('You have been successfully verified!')
                .setColor('#2ECC71')
                .addFields(
                    { name: '✨ Access Granted', value: 'You now have access to all public channels.' },
                    { name: '❓ Need Help?', value: 'Feel free to ask in our help channels!' }
                )
                .setFooter({ text: 'Thanks for joining us!' })
                .setTimestamp();

            const backupEmbed = new EmbedBuilder()
                .setTitle('🛡️ Optional Security Measure')
                .setDescription('While completely optional, we recommend backing up your access with RestoreCore.')
                .setColor('#3498DB')
                .addFields(
                    {
                        name: 'Why RestoreCore?',
                        value: 'In the unlikely event of a server grief, this helps us quickly restore your roles and access.'
                    },
                    {
                        name: '⚠️ Important Note',
                        value: 'This is **100% optional** and not required to maintain your access in the server.'
                    }
                );

            const restoreButton = new ButtonBuilder()
                .setLabel('Backup Access (Optional)')
                .setURL(process.env.RESTORE_CORE_LINK || 'https://restore.bot/link')
                .setStyle(ButtonStyle.Link);

            const row = new ActionRowBuilder().addComponents(restoreButton);

            try {
                await user.send({
                    embeds: [verificationEmbed, backupEmbed],
                    components: [row]
                });
            } catch (error) {
                console.error('Could not send DM to user:', error);
            }

            await reaction.message.channel.send({
                content: `<@${user.id}>`,
                embeds: [verificationEmbed, backupEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('Could not send embeds:', error);
        }

    } catch (error) {
        console.error('Error in verification handler:', error);
    }
}