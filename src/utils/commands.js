import { setupTicketSystem } from '../handlers/ticketHandler.js';
import { handleVerification } from '../handlers/verificationHandler.js';
import { handleWelcome } from '../handlers/welcomeHandler.js';
import { handlePurge } from '../handlers/purgeHandler.js';
import {
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

export const BOT_PREFIX = process.env.BOT_PREFIX || '$';

const slashCommands = [
    new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Sets up the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title for the ticket panel')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description for the ticket panel')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('moderator_role')
                .setDescription('Role for ticket moderators')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color for the embed (hex code)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('enable_claiming')
                .setDescription('Enable ticket claiming system')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('resend-verify')
        .setDescription('Resends verification embeds')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Sends a welcome message')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Purges messages from the channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to purge')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
];

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
                    guild: message.guild,
                    channel: message.channel
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
                    flags: 64
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

export async function handleSlashCommand(interaction) {
    try {
        switch (interaction.commandName) {
            case 'setup-tickets':
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const moderatorRole = interaction.options.getRole('moderator_role');
                const color = interaction.options.getString('color');
                const enableClaiming = interaction.options.getBoolean('enable_claiming');

                const options = {
                    ...(title && { title }),
                    ...(description && { description }),
                    ...(moderatorRole && { moderatorRoleId: moderatorRole.id }),
                    ...(color && { color }),
                    ...(enableClaiming !== null && { enableClaiming })
                };

                await setupTicketSystem(interaction.channel, options);
                await interaction.reply({
                    content: '✅ Ticket system has been set up with your custom configuration!',
                    flags: 64
                });
                break;

            case 'resend-verify':
                const mockReaction = {
                    message: {
                        channelId: process.env.VERIFICATION_CHANNEL_ID,
                        guild: interaction.guild,
                        channel: interaction.channel
                    },
                    emoji: { name: '✅' }
                };
                await handleVerification(mockReaction, interaction.user);
                await interaction.reply({ content: '✅ Verification embeds have been sent!', flags: 64 });
                break;

            case 'welcome':
                await handleWelcome(interaction.member);
                await interaction.reply({ content: '✅ Welcome message sent!', flags: 64 });
                break;

            case 'purge':
                const amount = interaction.options.getInteger('amount');
                await handlePurge(interaction, [amount]);
                await interaction.reply({ content: `✅ Purged ${amount} messages!`, flags: 64 });
                break;
        }
    } catch (error) {
        console.error(`Error executing slash command ${interaction.commandName}:`, error);
        await interaction.reply({
            content: '❌ An error occurred while executing the command.',
            flags: 64
        });
    }
}

export async function registerSlashCommands(client) {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands.map(command => command.toJSON()) }
        );

        console.log('Successfully registered slash commands!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}