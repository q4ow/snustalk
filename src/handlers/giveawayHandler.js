import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDuration } from '../utils/moderation.js';

export class GiveawayHandler {
    constructor(client) {
        this.client = client;
        this.checkInterval = null;
    }

    async initialize() {
        this.checkInterval = setInterval(() => this.checkEndedGiveaways(), 60000);
        await this.checkEndedGiveaways();
        console.log("✅ Giveaway handler initialized");
    }

    async createGiveaway(options) {
        const {
            guild_id,
            channel_id,
            host_id,
            prize,
            description = null,
            duration,
            winner_count = 1,
            requirements = {},
            button_label = 'Enter Giveaway 🎉',
            embed_color = '#FF69B4',
            image = null,
            end_message = null
        } = options;

        const channel = await this.client.channels.fetch(channel_id);
        if (!channel) throw new Error('Channel not found');

        const ends_at = new Date(Date.now() + duration);

        const embed = this.createGiveawayEmbed({
            prize,
            description,
            host_id,
            ends_at,
            winner_count,
            requirements,
            entries: 0,
            embed_color,
            image
        });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_enter')
                .setLabel(button_label)
                .setStyle(ButtonStyle.Primary),
        );

        const message = await channel.send({
            embeds: [embed],
            components: [buttons]
        });

        const id = await db.createGiveaway({
            guild_id,
            channel_id,
            message_id: message.id,
            host_id,
            prize,
            description,
            winner_count,
            ends_at,
            requirements,
            button_label,
            embed_color,
            image,
            end_message
        });

        return id;
    }

    createGiveawayEmbed({ prize, description, host_id, ends_at, winner_count, requirements, entries, winners = null, embed_color = '#FF69B4', image = null }) {
        const embed = new EmbedBuilder()
            .setTitle('🎉 Giveaway: ' + prize)
            .setColor(embed_color)
            .setTimestamp();

        if (image) embed.setImage(image);

        const fields = [
            { name: 'Host', value: `<@${host_id}>`, inline: true },
            { name: 'Winners', value: winner_count.toString(), inline: true },
            { name: 'Entries', value: entries.toString(), inline: true }
        ];

        if (description) {
            embed.setDescription(description);
        }

        if (winners) {
            fields.push({ name: '🎊 Winners', value: winners.map(id => `<@${id}>`).join('\n') });
            embed.setColor('#00FF00');
        } else {
            fields.push({ name: '⏰ Ends', value: `<t:${Math.floor(ends_at.getTime() / 1000)}:R>` });

            if (Object.keys(requirements).length > 0) {
                const reqText = [];
                if (requirements.roles?.length) {
                    reqText.push('Required Roles: ' + requirements.roles.map(r => `<@&${r}>`).join(', '));
                }
                if (requirements.min_account_age) {
                    reqText.push(`Minimum Account Age: ${formatDuration(requirements.min_account_age)}`);
                }
                if (requirements.min_server_age) {
                    reqText.push(`Minimum Server Age: ${formatDuration(requirements.min_server_age)}`);
                }
                fields.push({ name: '📋 Requirements', value: reqText.join('\n') });
            }
        }

        embed.addFields(fields);
        return embed;
    }

    async enterGiveaway(giveawayId, userId) {
        const giveaway = await db.getGiveaway(giveawayId);
        if (!giveaway || giveaway.ended) {
            throw new Error('Giveaway not found or already ended');
        }

        if (giveaway.blacklisted_users.includes(userId)) {
            throw new Error('You are blacklisted from this giveaway');
        }

        const member = await this.getMember(giveaway.guild_id, userId);
        if (!member) throw new Error('Member not found');

        const requirements = giveaway.requirements;
        if (requirements.roles?.length) {
            const hasRoles = requirements.roles.every(roleId => member.roles.cache.has(roleId));
            if (!hasRoles) throw new Error('You do not meet the role requirements');
        }

        if (requirements.min_account_age) {
            const accountAge = Date.now() - member.user.createdTimestamp;
            if (accountAge < requirements.min_account_age) {
                throw new Error('Your account is too new to enter');
            }
        }

        if (requirements.min_server_age) {
            const serverAge = Date.now() - member.joinedTimestamp;
            if (serverAge < requirements.min_server_age) {
                throw new Error('You haven\'t been in the server long enough');
            }
        }

        await db.enterGiveaway(giveawayId, userId);
        await this.updateGiveawayMessage(giveawayId);
    }

    async blacklistUser(giveawayId, userId) {
        await db.blacklistUser(giveawayId, userId);
        await this.updateGiveawayMessage(giveawayId);
    }

    async endGiveaway(giveawayId, forced = false) {
        const giveaway = await db.getGiveaway(giveawayId);
        if (!giveaway || giveaway.ended) return;

        const entries = await db.getGiveawayEntries(giveawayId);
        const validEntries = entries.filter(entry =>
            !giveaway.blacklisted_users.includes(entry.user_id)
        );

        let winners = [];
        if (validEntries.length > 0) {
            winners = this.selectWinners(validEntries, giveaway.winner_count);
        }

        await db.endGiveaway(giveawayId);
        await this.updateGiveawayMessage(giveawayId, winners);

        const channel = await this.client.channels.fetch(giveaway.channel_id);
        if (channel) {
            let content, winnerMentions;
            if (winners.length > 0) {
                winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                content = giveaway.end_message || `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!${forced ? '\n(Giveaway ended early by host)' : ''}`;
            } else {
                winnerMentions = 'No winners';
                content = `😢 No one entered the giveaway for **${giveaway.prize}**. No winners this time!`;
            }
            const summaryEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Ended!')
                .setColor('#00FF00')
                .setDescription(`Prize: **${giveaway.prize}**\nEntries: **${validEntries.length}**\nWinner(s): ${winnerMentions}`)
                .setTimestamp();
            if (giveaway.image) summaryEmbed.setImage(giveaway.image);
            await channel.send({
                content,
                embeds: [summaryEmbed],
                allowedMentions: { users: winners }
            });
        }

        return winners;
    }

    async rerollGiveaway(giveawayId, winnerCount = null) {
        const giveaway = await db.getGiveaway(giveawayId);
        if (!giveaway) throw new Error('Giveaway not found');
        if (!giveaway.ended) throw new Error('Giveaway has not ended yet');

        const entries = await db.getGiveawayEntries(giveawayId);
        const validEntries = entries.filter(entry =>
            !giveaway.blacklisted_users.includes(entry.user_id)
        );

        let winners = [];
        if (validEntries.length > 0) {
            winners = this.selectWinners(validEntries, winnerCount || giveaway.winner_count);
        }
        await this.updateGiveawayMessage(giveawayId, winners);

        const channel = await this.client.channels.fetch(giveaway.channel_id);
        if (channel) {
            let content, winnerMentions;
            if (winners.length > 0) {
                winnerMentions = winners.map(id => `<@${id}>`).join(', ');
                content = `🎲 Rerolled Winners: Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`;
            } else {
                winnerMentions = 'No winners';
                content = `😢 No one entered the giveaway for **${giveaway.prize}**. No winners this time!`;
            }
            await channel.send({
                content,
                allowedMentions: { users: winners }
            });
        }

        return winners;
    }

    async checkEndedGiveaways() {
        const endedGiveaways = await db.getEndedGiveaways();
        for (const giveaway of endedGiveaways) {
            await this.endGiveaway(giveaway.id);
        }
    }

    async updateGiveawayMessage(giveawayId, winners = null) {
        const giveaway = await db.getGiveaway(giveawayId);
        if (!giveaway) return;

        const entries = await db.getGiveawayEntries(giveawayId);
        const embed = this.createGiveawayEmbed({
            ...giveaway,
            entries: entries.length,
            winners
        });

        const channel = await this.client.channels.fetch(giveaway.channel_id);
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(giveaway.message_id);
            if (!message) return;

            const components = giveaway.ended ? [] : [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('giveaway_enter')
                        .setLabel(giveaway.button_label || 'Enter Giveaway 🎉')
                        .setStyle(ButtonStyle.Primary)
                )
            ];

            await message.edit({ embeds: [embed], components });
        } catch (error) {
            console.error('Failed to update giveaway message:', error);
        }
    }

    selectWinners(entries, count) {
        const winners = new Set();
        const entriesArray = entries.map(e => e.user_id);

        while (winners.size < count && winners.size < entriesArray.length) {
            const winner = entriesArray[Math.floor(Math.random() * entriesArray.length)];
            winners.add(winner);
        }

        return Array.from(winners);
    }

    async getMember(guildId, userId) {
        const guild = await this.client.guilds.fetch(guildId);
        if (!guild) return null;
        try {
            return await guild.members.fetch(userId);
        } catch {
            return null;
        }
    }
}