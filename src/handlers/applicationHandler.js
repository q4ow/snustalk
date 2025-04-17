import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  handleAutomodWhitelistRole,
  handleAutomodUnwhitelistRole,
  handleAutomodListWhitelists
} from './automodHandler.js';
import { db } from "../utils/database.js";

const applicationQuestions = [
  "How long have you been a member of our Discord server?",
  "Do you have any prior moderating experience? If yes, please elaborate.",
  "What can you bring to our Moderator Team?",
  "What is your age?",
  "What timezone are you in?",
  "How many hours per week can you dedicate to moderating?",
  "Why should we choose you as a Moderator?",
  "Have you read and do you agree to follow all server rules?",
];

const applications = new Map();

export async function startApplication(interaction) {
  try {
    try {
      const dmChannel = await interaction.user.createDM();
      await dmChannel
        .send({
          content: "Testing DM permissions - this message will be deleted.",
          flags: 64,
        })
        .then((msg) => msg.delete().catch(() => { }));
    } catch (error) {
      await interaction.reply({
        content:
          "❌ I couldn't send you a DM! Please enable DMs from server members to start the application process.",
        flags: 64,
      });
      return;
    }

    applications.set(interaction.user.id, {
      answers: [],
      startTime: Date.now(),
      guildJoinDate: interaction.member.joinedAt,
      guildId: interaction.guildId // Store the guild ID
    });

    try {
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("Moderator Application - First Question")
            .setDescription(applicationQuestions[0])
            .setColor("#2F3136")
            .setFooter({
              text: "Type 'cancel' at any time to cancel the application",
            }),
        ],
      });

      if (!interaction.replied) {
        await interaction.reply({
          content:
            "✅ I've sent you a DM to start the Moderator application process!",
          flags: 64,
        });
      }
    } catch (error) {
      applications.delete(interaction.user.id);
      if (!interaction.replied) {
        await interaction.reply({
          content:
            "❌ Failed to send application questions. Please make sure your DMs are open.",
          flags: 64,
        });
      }
    }
  } catch (error) {
    console.error("Error in startApplication:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content:
          "❌ There was an error starting the application process. Please try again later or contact an administrator.",
        flags: 64,
      });
    }
  }
}

export async function handleApplicationResponse(message) {
  if (message.channel.type !== 1 || message.author.bot) return;

  if (!applications.has(message.author.id)) return;

  const application = applications.get(message.author.id);

  if (message.content.toLowerCase() === "cancel") {
    applications.delete(message.author.id);
    return message.reply("Application cancelled.");
  }

  application.answers.push(message.content);
  applications.set(message.author.id, application);

  if (application.answers.length < applicationQuestions.length) {
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Question ${application.answers.length + 1}`)
          .setDescription(applicationQuestions[application.answers.length])
          .setColor("#2F3136"),
      ],
    });
  } else {
    await submitApplication(message, application);
    applications.delete(message.author.id);
  }
}

async function submitApplication(message, application) {
  try {
    const guild = message.client.guilds.cache.get(application.guildId);
    if (!guild) {
      await message.reply(
        "Error: Could not find the server. Please contact an administrator.",
      );
      return;
    }

    const logsChannelId = await db.getChannelId(guild.id, "applications_logs");
    if (!logsChannelId) {
      await message.reply(
        "Error: Applications log channel not found. Please contact an administrator.",
      );
      return;
    }

    const logsChannel = await guild.channels.fetch(logsChannelId);
    if (!logsChannel) {
      await message.reply(
        "Error: Could not find the applications log channel. Please contact an administrator.",
      );
      return;
    }

    const permissions = logsChannel.permissionsFor(guild.members.me);
    if (!permissions?.has(["ViewChannel", "SendMessages", "EmbedLinks"])) {
      await message.reply(
        "Error: I don't have the required permissions in the applications channel. Please contact an administrator.",
      );
      return;
    }

    const duration = Math.floor((Date.now() - application.startTime) / 1000);

    const applicationEmbed = new EmbedBuilder()
      .setTitle(`Moderator Application - ${message.author.tag}`)
      .setDescription("Application for Moderator Position")
      .setColor("#2F3136")
      .setTimestamp()
      .addFields(
        applicationQuestions.map((question, index) => ({
          name: question,
          value: application.answers[index],
        })),
      )
      .addFields([
        {
          name: "Application Stats",
          value:
            `**User ID:** ${message.author.id}\n` +
            `**Username:** ${message.author.tag}\n` +
            `**Duration:** ${duration} seconds\n` +
            `**Joined Server:** <t:${Math.floor(application.guildJoinDate.getTime() / 1000)}:R>`,
        },
      ]);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_app_${message.author.id}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_app_${message.author.id}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger),
    );

    await logsChannel.send({
      embeds: [applicationEmbed],
      components: [buttons],
    });
    await message.reply(
      "Your application has been submitted! Staff will review it soon.",
    );
  } catch (error) {
    console.error("Error in submitApplication:", error);
    await message
      .reply(
        "There was an error submitting your application. Please try again later or contact an administrator.",
      )
      .catch(() => { });
  }
}

export async function handleApplicationButton(interaction) {
  const [action, userId] = interaction.customId.split("_app_");

  const modal = new ModalBuilder()
    .setCustomId(`${action}_app_modal_${userId}`)
    .setTitle(`${action === "accept" ? "Accept" : "Deny"} Application`)
    .addComponents([
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(1000)
          .setPlaceholder("Enter your reason here...")
          .setRequired(true),
      ),
    ]);

  await interaction.showModal(modal);

  try {
    const modalResponse = await interaction.awaitModalSubmit({
      time: 300000,
      filter: (i) => i.customId === `${action}_app_modal_${userId}`,
    });

    const reason = modalResponse.fields.getTextInputValue("reason");
    const guild = interaction.guild;
    const user = await interaction.client.users.fetch(userId);
    const member = await guild.members.fetch(userId);

    if (!member) {
      await modalResponse.reply({
        content: "Could not find the user in the server.",
        flags: 64,
      });
      return;
    }

    if (action === "accept") {
      try {
        const moderatorRoleId = await db.getRoleId(guild.id, "moderator");
        if (!moderatorRoleId) {
          console.error("Moderator role not found");
          await modalResponse.reply({
            content:
              "Failed to assign moderator role, but the application was accepted.",
            flags: 64,
          });
          return;
        }

        const moderatorRole = await guild.roles.fetch(moderatorRoleId);
        if (!moderatorRole) {
          console.error("Moderator role not found in guild");
          await modalResponse.reply({
            content:
              "Failed to assign moderator role, but the application was accepted.",
            flags: 64,
          });
          return;
        }

        await member.roles.add(moderatorRole);
        console.log(`Added moderator role to ${member.user.tag}`);
      } catch (error) {
        console.error(
          `Failed to add moderator role to member ${member.id}:`,
          error,
        );
        await modalResponse.reply({
          content:
            "Failed to assign moderator role, but the application was accepted.",
          flags: 64,
        });
        return;
      }
    }

    const responseEmbed = new EmbedBuilder()
      .setTitle(`Application ${action === "accept" ? "Accepted" : "Denied"}`)
      .setDescription(`**Reason:** ${reason}`)
      .setColor(action === "accept" ? "#00FF00" : "#FF0000")
      .setTimestamp();

    await user.send({ embeds: [responseEmbed] }).catch(() => {
      console.log(`Failed to DM user ${user.tag}`);
    });

    await interaction.message.edit({ components: [] });

    const logEmbed = new EmbedBuilder()
      .setTitle(`Application ${action === "accept" ? "Accepted" : "Denied"}`)
      .setDescription(
        `**Staff Member:** ${interaction.user.tag}\n**Reason:** ${reason}`,
      )
      .setColor(action === "accept" ? "#00FF00" : "#FF0000")
      .setTimestamp();

    await interaction.message.reply({ embeds: [logEmbed] });

    await modalResponse.reply({
      content: `Application ${action === "accept" ? "accepted" : "denied"} successfully.`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error handling application button:", error);
    await interaction
      .followUp({
        content: "There was an error processing the application response.",
        flags: 64,
      })
      .catch(() => { });
  }
}

export async function handleCommand(interaction) {
  switch (interaction.commandName) {
    case 'automod-whitelist-role':
      await handleAutomodWhitelistRole(interaction);
      break;
    case 'automod-unwhitelist-role':
      await handleAutomodUnwhitelistRole(interaction);
      break;
    case 'automod-list-whitelists':
      await handleAutomodListWhitelists(interaction);
      break;
  }
}
