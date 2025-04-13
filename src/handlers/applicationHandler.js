import {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';

const applicationQuestions = [
    "How long have you been a member of our Discord server?",
    "Do you have any prior moderating experience? If yes, please elaborate.",
    "What can you bring to our Staff Team?",
    "What is your age?",
    "What timezone are you in?",
    "How many hours per week can you dedicate to moderating?",
    "Why should we choose you as a staff member?",
    "Have you read and do you agree to follow all server rules?"
];

const applications = new Map();

export async function startApplication(interaction) {
    const dmChannel = await interaction.user.createDM();
    applications.set(interaction.user.id, {
        answers: [],
        startTime: Date.now(),
        guildJoinDate: interaction.member.joinedAt
    });

    await dmChannel.send({
        content: "Welcome to the staff application process! Please answer each question honestly. Type 'cancel' at any time to cancel the application.",
        embeds: [new EmbedBuilder()
            .setTitle("First Question")
            .setDescription(applicationQuestions[0])
            .setColor("#2F3136")]
    });

    await interaction.reply({ content: "I've sent you a DM to start the application process!", flags: 64 });
}

export async function handleApplicationResponse(message) {
    if (message.channel.type !== 1 || message.author.bot) return;

    if (!applications.has(message.author.id)) return;

    const application = applications.get(message.author.id);

    if (message.content.toLowerCase() === 'cancel') {
        applications.delete(message.author.id);
        return message.reply("Application cancelled.");
    }

    application.answers.push(message.content);
    applications.set(message.author.id, application);

    if (application.answers.length < applicationQuestions.length) {
        await message.channel.send({
            embeds: [new EmbedBuilder()
                .setTitle(`Question ${application.answers.length + 1}`)
                .setDescription(applicationQuestions[application.answers.length])
                .setColor("#2F3136")]
        });
    } else {
        await submitApplication(message, application);
        applications.delete(message.author.id);
    }
}

async function submitApplication(message, application) {
    const guild = message.client.guilds.cache.get(process.env.GUILD_ID);
    const logsChannel = guild.channels.cache.get(process.env.APPLICATIONS_LOGS_CHANNEL_ID);

    const duration = Math.floor((Date.now() - application.startTime) / 1000);
    const joinedAgo = Math.floor((Date.now() - application.guildJoinDate) / 1000);

    const applicationEmbed = new EmbedBuilder()
        .setTitle(`Staff Application - ${message.author.tag}`)
        .setColor("#2F3136")
        .setTimestamp()
        .addFields(
            applicationQuestions.map((question, index) => ({
                name: question,
                value: application.answers[index]
            }))
        )
        .addFields([
            {
                name: 'Application Stats', value:
                    `**User ID:** ${message.author.id}\n` +
                    `**Username:** ${message.author.tag}\n` +
                    `**Duration:** ${duration} seconds\n` +
                    `**Joined Server:** <t:${Math.floor(application.guildJoinDate.getTime() / 1000)}:R>`
            }
        ]);

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`accept_app_${message.author.id}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`deny_app_${message.author.id}`)
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
        );

    await logsChannel.send({ embeds: [applicationEmbed], components: [buttons] });
    await message.reply("Your application has been submitted! Staff will review it soon.");
}

export async function handleApplicationButton(interaction) {
    const [action, userId] = interaction.customId.split('_app_');

    const modal = new ModalBuilder()
        .setCustomId(`${action}_app_modal_${userId}`)
        .setTitle(`${action === 'accept' ? 'Accept' : 'Deny'} Application`)
        .addComponents([
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('Reason')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(1)
                    .setMaxLength(1000)
                    .setPlaceholder('Enter your reason here...')
                    .setRequired(true)
            )
        ]);

    await interaction.showModal(modal);

    try {
        const modalResponse = await interaction.awaitModalSubmit({
            time: 300000,
            filter: i => i.customId === `${action}_app_modal_${userId}`
        });

        const reason = modalResponse.fields.getTextInputValue('reason');
        const guild = interaction.guild;
        const user = await interaction.client.users.fetch(userId);
        const member = await guild.members.fetch(userId).catch(() => null);

        if (action === 'accept' && member) {
            const roleIds = process.env.STAFF_APPLICANT_ROLE_IDS.split(',');
            for (const roleId of roleIds) {
                const role = guild.roles.cache.get(roleId.trim());
                if (role) {
                    try {
                        await member.roles.add(role);
                    } catch (error) {
                        console.error(`Failed to add role ${roleId} to member ${member.id}:`, error);
                    }
                }
            }
        }

        const responseEmbed = new EmbedBuilder()
            .setTitle(`Application ${action === 'accept' ? 'Accepted' : 'Denied'}`)
            .setDescription(`**Reason:** ${reason}`)
            .setColor(action === 'accept' ? '#00FF00' : '#FF0000')
            .setTimestamp();

        await user.send({ embeds: [responseEmbed] }).catch(() => {
            console.log(`Failed to DM user ${user.tag}`);
        });

        await interaction.message.edit({ components: [] });

        const logEmbed = new EmbedBuilder()
            .setTitle(`Application ${action === 'accept' ? 'Accepted' : 'Denied'}`)
            .setDescription(`**Staff Member:** ${interaction.user.tag}\n**Reason:** ${reason}`)
            .setColor(action === 'accept' ? '#00FF00' : '#FF0000')
            .setTimestamp();

        await interaction.message.reply({ embeds: [logEmbed] });

        await modalResponse.reply({
            content: `Application ${action === 'accept' ? 'accepted' : 'denied'} successfully.`,
            flags: 64
        });

    } catch (error) {
        console.error('Error handling application button:', error);
        await interaction.followUp({
            content: 'There was an error processing the application response.',
            flags: 64
        }).catch(() => { });
    }
}