import { setupTicketSystem } from '../handlers/ticketHandler.js';
import { handleVerification } from '../handlers/verificationHandler.js';
import { handleWelcome } from '../handlers/welcomeHandler.js';
import { handlePurge } from '../handlers/purgeHandler.js';

export const BOT_PREFIX = process.env.BOT_PREFIX || '$';

export const commands = {
    'setup-tickets': {
        permissions: ['Administrator'],
        deleteAfter: true,
        async execute(message) {
            await setupTicketSystem(message.channel);
        },
        errorMessage: 'There was an error setting up the ticket system.'
    },
    'resend-verify': {
        permissions: ['ManageRoles'],
        deleteAfter: true,
        async execute(message) {
            const mockReaction = {
                message: {
                    channelId: process.env.VERIFICATION_CHANNEL_ID,
                    guild: message.guild
                },
                emoji: { name: '✅' }
            };
            await handleVerification(mockReaction, message.author);
            await message.reply('✅ Verification embeds have been sent to your DMs.');
        },
        errorMessage: '❌ An error occurred while sending verification embeds.'
    },
    'welcome': {
        permissions: ['ManageRoles'],
        deleteAfter: true,
        async execute(message) {
            await handleWelcome(message.member);
        },
        errorMessage: '❌ An error occurred while sending welcome message.'
    },
    'purge': {
        permissions: ['ManageMessages'],
        deleteAfter: true,
        async execute(message) {
            const args = message.content.trim().split(/ +/);
            const amount = args[1];
            await handlePurge(message, [amount]);
        },
        errorMessage: '❌ An error occurred while purging messages.'
    }
};

export async function handleCommand(message, commands) {
    if (!message.content.startsWith(BOT_PREFIX)) return false;

    const args = message.content.slice(BOT_PREFIX.length).trim().split(/ +/);
    const commandName = args[0];
    const command = commands[commandName];

    if (!command) return false;

    try {
        if (command.permissions) {
            const hasPermission = command.permissions.every(permission =>
                message.member.permissions.has(permission)
            );

            if (!hasPermission) {
                await message.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
                return true;
            }
        }

        await command.execute(message);

        if (command.deleteAfter) {
            await message.delete().catch(err => {
                if (err.code !== 10008) {
                    console.error('Could not delete command message:', err);
                }
            });
        }
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        await message.reply(command.errorMessage || '❌ An error occurred while executing the command.');
    }

    return true;
}