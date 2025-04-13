import { EmbedBuilder } from 'discord.js';
import { SPAM_INTERVAL, SPAM_THRESHOLD, badWords, spamPatterns, userMessageCounts } from '../utils/filter';

export async function handleMessageFilter(message) {
    if (message.author.bot) return;
    if (message.member.permissions.has('ManageMessages')) return;

    try {
        const isSpam = await checkSpam(message);
        const containsBadWords = checkBadWords(message.content);
        const matchesSpamPattern = checkSpamPatterns(message.content);

        if (isSpam || containsBadWords || matchesSpamPattern) {
            await message.delete();

            const logEmbed = new EmbedBuilder()
                .setTitle('Message Filtered')
                .setColor('#FF0000')
                .setDescription([
                    `**Author:** ${message.author.tag}`,
                    `**Channel:** ${message.channel.name}`,
                    `**Reason:** ${isSpam ? 'Spam' : containsBadWords ? 'Inappropriate Language' : 'Spam Pattern'}`,
                    `**Content:** ${message.content.slice(0, 1000)}`
                ].join('\n'))
                .setTimestamp();

            const logChannel = await message.guild.channels.fetch(process.env.LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({ embeds: [logEmbed] });
            }

            await message.author.send({
                content: `Your message was removed for ${isSpam ? 'spamming' : containsBadWords ? 'inappropriate language' : 'spam patterns'}.`
            }).catch(() => { });
        }
    } catch (error) {
        console.error('Error in message filter:', error);
    }
}

async function checkSpam(message) {
    const userId = message.author.id;
    const now = Date.now();

    if (!userMessageCounts.has(userId)) {
        userMessageCounts.set(userId, []);
    }

    const userMessages = userMessageCounts.get(userId);
    userMessages.push(now);

    const recentMessages = userMessages.filter(time => now - time < SPAM_INTERVAL);
    userMessageCounts.set(userId, recentMessages);

    return recentMessages.length > SPAM_THRESHOLD;
}

function checkBadWords(content) {
    const normalized = content.toLowerCase();
    return badWords.some(word => {
        let pattern = word.toLowerCase()
            .replace(/\*/g, '.*')
            .replace(/\+/g, '\\+')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\./g, '\\.');

        if (pattern.startsWith('.*') && pattern.endsWith('.*')) {
            pattern = pattern.slice(2, -2);
        }

        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        return regex.test(normalized);
    });
}

function checkSpamPatterns(content) {
    return spamPatterns.some(pattern => pattern.test(content));
}