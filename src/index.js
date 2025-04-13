import {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActivityType
} from 'discord.js';
import dotenv from 'dotenv';
import { handleVerification } from './handlers/verificationHandler.js';
import { handleWelcome } from './handlers/welcomeHandler.js';
import { handleTicketCreate, handleTicketClose } from './handlers/ticketHandler.js';
import { handleCommand, commands } from './utils/commands.js';

dotenv.config();

const requiredEnvVars = [
    'DISCORD_TOKEN',
    'GUILD_ID',
    'VERIFICATION_CHANNEL_ID',
    'WELCOME_CHANNEL_ID',
    'VERIFIED_ROLE_ID',
    'UNVERIFIED_ROLE_ID',
    'TICKET_CATEGORY_ID',
    'MANAGEMENT_ROLE_ID',
    'STAFF_ROLE_ID',
    'TICKET_LOGS_CHANNEL_ID',
    'EZ_HOST_KEY'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

client.once('ready', async () => {
    console.log(`🚀 Bot is online as ${client.user.tag}`);
    console.log(`👥 Connected to ${client.guilds.cache.size} guild(s)`)
    console.log(`🔗 Bot ID: ${client.user.id}`)
    console.log()

    console.log('Initializing systems...');
    console.log('✅ Ticketing system initialized');

    client.user.setPresence({
        activities: [{
            name: 'SnusTalk Central',
            type: ActivityType.Watching
        }],
        status: 'dnd'
    });

    try {
        await setupVerificationMessage();
        console.log('✅ Verification system initialized');

        const welcomeChannel = await client.channels.fetch(process.env.WELCOME_CHANNEL_ID);
        if (!welcomeChannel) throw new Error('Welcome channel not found');

        const unverifiedRole = await client.guilds.cache.first().roles.fetch(process.env.UNVERIFIED_ROLE_ID);
        if (!unverifiedRole) throw new Error('Unverified role not found');


        console.log('✅ Welcome system initialized');
    } catch (error) {
        console.error('❌ Failed to initialize systems:', error);
    }
});

async function setupVerificationMessage() {
    const channel = await client.channels.fetch(process.env.VERIFICATION_CHANNEL_ID);
    if (!channel) throw new Error('Verification channel not found');

    const messages = await channel.messages.fetch({ limit: 10 });
    const existingVerification = messages.find(msg =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].title === 'Member Verification'
    );

    if (existingVerification) {
        const checkReaction = existingVerification.reactions.cache.get('✅');
        if (!checkReaction) await existingVerification.react('✅');
        return;
    }

    const verificationEmbed = new EmbedBuilder()
        .setTitle('Member Verification')
        .setDescription('React with ✅ to verify yourself and gain access to the server.')
        .setColor('#00ff00')
        .setTimestamp();

    const message = await channel.send({ embeds: [verificationEmbed] });
    await message.react('✅');
}

client.on('guildMemberAdd', handleWelcome);
client.on('messageReactionAdd', handleVerification);

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    try {
        const handlers = {
            'create_general_ticket': () => handleTicketCreate(interaction, 'GENERAL'),
            'create_management_ticket': () => handleTicketCreate(interaction, 'MANAGEMENT'),
            'close_ticket': () => handleTicketClose(interaction)
        };

        const handler = handlers[interaction.customId];
        if (handler) await handler();
    } catch (error) {
        console.error('❌ Error handling button interaction:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        }).catch(() => { });
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    try {
        await handleCommand(message, commands);
    } catch (error) {
        console.error('❌ Error handling command:', error);
    }
});

client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});