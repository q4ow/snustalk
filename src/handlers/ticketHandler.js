import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    MessageFlags
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const ticketTypes = {
    GENERAL: {
        name: 'general',
        label: 'General Support',
        roleId: process.env.STAFF_ROLE_ID,
        color: '#5865F2'
    },
    MANAGEMENT: {
        name: 'management',
        label: 'Management Support',
        roleId: process.env.MANAGEMENT_ROLE_ID,
        color: '#EB459E'
    }
};

export async function setupTicketSystem(channel) {
    const botMember = channel.guild.members.cache.get(channel.client.user.id);
    const requiredPermissions = [
        'SendMessages',
        'ManageChannels',
        'ManageRoles',
        'ViewChannel',
        'CreatePublicThreads',
        'SendMessagesInThreads'
    ];

    const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
    if (missingPermissions.length > 0) {
        throw new Error(`Bot is missing required permissions: ${missingPermissions.join(', ')}`);
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to create a ticket')
        .setColor('#5865F2');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_general_ticket')
                .setLabel('General Support')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📝'),
            new ButtonBuilder()
                .setCustomId('create_management_ticket')
                .setLabel('Management Support')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👑')
        );

    await channel.send({ embeds: [embed], components: [row] });
}

export async function handleTicketCreate(interaction, type) {
    try {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const ticketType = ticketTypes[type];
        const guild = interaction.guild;

        if (!ticketType.roleId) {
            throw new Error(`Role ID not configured for ticket type: ${type}`);
        }

        let supportRole = guild.roles.cache.get(ticketType.roleId);

        if (!supportRole) {
            try {
                supportRole = await guild.roles.fetch(ticketType.roleId, { force: true });
            } catch (error) {
                throw new Error(`Support role not found. Please check if the role ID ${ticketType.roleId} is correct.`);
            }
        }

        if (!supportRole) {
            throw new Error(`Support role with ID ${ticketType.roleId} does not exist in the server.`);
        }

        const [category, member] = await Promise.all([
            guild.channels.fetch(process.env.TICKET_CATEGORY_ID),
            guild.members.fetch(interaction.user.id)
        ]);

        if (!category) throw new Error('Ticket category not found');
        if (!member) throw new Error('Member not found');

        const channelName = `ticket-${member.user.username.toLowerCase()}`;

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                {
                    id: supportRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`${ticketType.label} Ticket`)
            .setDescription(`Support will be with you shortly.\nUser: ${interaction.user.toString()}`)
            .setColor(ticketType.color)
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await ticketChannel.send({
            content: `<@&${supportRole.id}> - New ticket from ${interaction.user.toString()}`,
            embeds: [embed],
            components: [row]
        });

        await interaction.editReply({
            content: `Your ticket has been created: ${ticketChannel}`
        });

    } catch (error) {
        console.error('Error creating ticket:', error);
        const errorMessage = 'There was an error creating your ticket.';

        if (interaction.deferred) {
            await interaction.editReply({
                content: errorMessage,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            await interaction.reply({
                content: errorMessage,
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
}

export async function handleTicketClose(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const logChannel = await interaction.guild.channels.fetch(process.env.TICKET_LOGS_CHANNEL_ID);

        if (!logChannel) {
            throw new Error('Log channel not found');
        }

        const messages = await channel.messages.fetch({ limit: 100 });

        const transcript = Array.from(messages.values())
            .reverse()
            .map(msg => {
                const time = msg.createdAt.toLocaleString();
                const author = msg.author.tag;
                const content = msg.content || '[No content - probably embed or attachment]';
                return `[${time}] ${author}: ${content}`;
            })
            .join('\n');

        const creationTime = channel.createdAt.toLocaleString();

        const response = await fetch('https://api.e-z.host/paste', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'key': process.env.EZ_HOST_KEY
            },
            body: JSON.stringify({
                text: transcript,
                title: channel.name,
                description: `Ticket opened at ${creationTime}`,
                language: 'plaintext'
            })
        });

        const data = await response.json();

        if (!data.rawUrl) {
            throw new Error('Failed to get transcript URL from API');
        }

        const embed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`Ticket ${channel.name} was closed by ${interaction.user.toString()}\n\n[View Transcript](${data.rawUrl})`)
            .setColor('#ED4245')
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        await interaction.editReply({ content: 'Ticket closed and transcript saved.' });
        await channel.delete();

    } catch (error) {
        console.error('Error closing ticket:', error);
        const errorMessage = 'There was an error closing the ticket.';

        if (interaction.deferred) {
            await interaction.editReply({ content: errorMessage });
        } else {
            await interaction.reply({
                content: errorMessage,
                ephemeral: true
            });
        }
    }
}