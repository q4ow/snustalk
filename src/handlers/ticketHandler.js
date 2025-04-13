import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import dotenv from "dotenv";
import { db } from "../utils/database.js";

dotenv.config();

const ticketTypes = {
  GENERAL: {
    name: "general",
    label: "General Support",
    roleId: process.env.STAFF_ROLE_ID,
    color: "#5865F2",
  },
  MANAGEMENT: {
    name: "management",
    label: "Management Support",
    roleId: process.env.MANAGEMENT_ROLE_ID,
    color: "#EB459E",
  },
};

const TICKET_DEFAULTS = {
  title: "🎫 Support Tickets",
  description: "Click the buttons below to create a support ticket",
  color: "#5865F2",
  enableClaiming: true,
  thumbnail: null,
  footer: "SnusTalk Support System",
  generalButtonLabel: "General Support",
  managementButtonLabel: "Management Support",
  generalButtonEmoji: "📝",
  managementButtonEmoji: "👑",
  maxTicketsPerUser: 1,
  closeConfirmation: true,
  autoCloseHours: 0, // disabled
  buttonStyle: {
    general: ButtonStyle.Primary,
    management: ButtonStyle.Secondary,
  },
};

async function canManageTicket(member, ticketType) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const settings = await db.getTicketSettings(member.guild.id);
  const moderatorRoleId =
    settings?.moderatorRoleId || process.env[`${ticketType}_ROLE_ID`];

  return member.roles.cache.has(moderatorRoleId);
}

async function getNextTicketNumber(guild) {
  const ticketData = await db.getTicketCounter(guild.id);
  const nextNumber = (ticketData?.counter || 0) + 1;
  await db.updateTicketCounter(guild.id, nextNumber);
  return nextNumber.toString().padStart(4, "0");
}

async function logTicketAction(guild, channelId, action) {
  try {
    await db.addTicketAction(channelId, action);

    const logChannel = await guild.channels.fetch(
      process.env.TICKET_LOGS_CHANNEL_ID,
    );
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle("Ticket Action")
      .setDescription(action)
      .setColor("#2F3136")
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Error logging ticket action:", error);
  }
}

export async function setupTicketSystem(channel, options = {}) {
  const settings = {
    ...TICKET_DEFAULTS,
    ...options,
  };

  await db.saveTicketSettings(channel.guild.id, settings);

  const embed = new EmbedBuilder()
    .setTitle(settings.title)
    .setDescription(settings.description)
    .setColor(settings.color)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("create_general_ticket")
      .setLabel("General Support")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📝"),
    new ButtonBuilder()
      .setCustomId("create_management_ticket")
      .setLabel("Management Support")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("👑"),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

export async function handleTicketCreate(interaction, type) {
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const settings = (await db.getTicketSettings(guild.id)) || TICKET_DEFAULTS;

    const userTickets = guild.channels.cache.filter(
      (channel) =>
        channel.name.startsWith("ticket-") &&
        channel.name.includes(member.user.username.toLowerCase()),
    );

    if (userTickets.size >= settings.maxTicketsPerUser) {
      return await interaction.reply({
        content: `You can only have ${settings.maxTicketsPerUser} open ticket(s) at a time.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const ticketType = ticketTypes[type];
    const ticketNumber = await getNextTicketNumber(guild);
    const channelName = `ticket-${ticketNumber}-${member.user.username.toLowerCase()}`;

    if (!ticketType.roleId) {
      throw new Error(`Role ID not configured for ticket type: ${type}`);
    }

    const supportRole = await guild.roles.fetch(ticketType.roleId);
    if (!supportRole) {
      throw new Error(
        `Support role with ID ${ticketType.roleId} does not exist in the server.`,
      );
    }

    const category = await guild.channels.fetch(process.env.TICKET_CATEGORY_ID);
    if (!category) throw new Error("Ticket category not found");

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: supportRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle(`${ticketType.label} Ticket #${ticketNumber}`)
      .setDescription(
        [
          `Support will be with you shortly.`,
          ``,
          `**User:** ${interaction.user.toString()}`,
          `**Type:** ${ticketType.label}`,
          `**Created:** ${new Date().toLocaleString()}`,
          ``,
          `Please describe your issue in detail and wait for a staff member to assist you.`,
        ].join("\n"),
      )
      .setColor(ticketType.color)
      .setTimestamp();

    if (settings.thumbnail) {
      embed.setThumbnail(settings.thumbnail);
    }

    if (settings.footer) {
      embed.setFooter({ text: settings.footer });
    }

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✖️"),
    );

    const message = await ticketChannel.send({
      content: `<@&${supportRole.id}> - New ticket from ${interaction.user.toString()}`,
      embeds: [embed],
      components: [actionRow],
    });

    await message.pin();

    if (settings.autoCloseHours > 0) {
      setTimeout(
        async () => {
          const channel = await guild.channels
            .fetch(ticketChannel.id)
            .catch(() => null);
          if (channel) {
            const lastMessage = (
              await channel.messages.fetch({ limit: 1 })
            ).first();
            const hoursSinceLastMessage =
              (Date.now() - lastMessage.createdTimestamp) / (1000 * 60 * 60);

            if (hoursSinceLastMessage >= settings.autoCloseHours) {
              await handleTicketClose(
                {
                  channel,
                  guild,
                  user: client.user,
                  reply: () => {},
                  deferred: false,
                },
                true,
              );
            }
          }
        },
        settings.autoCloseHours * 60 * 60 * 1000,
      );
    }

    await logTicketAction(
      guild,
      ticketChannel.id,
      `Ticket created by ${interaction.user.tag} (Type: ${ticketType.label})`,
    );

    await interaction.editReply({
      content: `Your ticket has been created: ${ticketChannel}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);

    const errorMessage = "There was an error creating your ticket.";

    if (interaction.deferred) {
      await interaction.editReply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else if (!interaction.replied) {
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export async function handleTicketClaim(interaction) {
  try {
    const channel = interaction.channel;
    const moderator = interaction.member;
    const user = interaction.user;

    if (!(await canManageTicket(moderator, "STAFF"))) {
      await interaction.reply({
        content: "You do not have permission to claim tickets.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const currentClaimId = await db.getTicketClaim(channel.id);
    if (currentClaimId) {
      await interaction.reply({
        content: "This ticket is already claimed by someone.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await db.saveTicketClaim(channel.id, moderator.id);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setDescription(
        `Ticket claimed by ${moderator.toString()}\n\nOriginal ticket information:\n${interaction.message.embeds[0].description}`,
      )
      .setColor("#00FF00");

    const claimedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("unclaim_ticket")
        .setLabel("Unclaim Ticket")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔓"),
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✖️"),
    );

    await interaction.message.edit({
      embeds: [embed],
      components: [claimedRow],
    });

    await logTicketAction(
      interaction.guild,
      channel.id,
      `Ticket claimed by ${user.tag}`,
    );

    await interaction.reply({
      content: `Ticket claimed by ${moderator.toString()}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error claiming ticket:", error);
    await interaction.reply({
      content: "There was an error claiming the ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleTicketUnclaim(interaction) {
  try {
    const channel = interaction.channel;
    const moderator = interaction.member;
    const user = interaction.user;

    const currentClaimId = await db.getTicketClaim(channel.id);
    if (!currentClaimId) {
      await interaction.reply({
        content: "This ticket is not currently claimed by anyone.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      currentClaimId !== moderator.id &&
      !moderator.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content:
          "You can only unclaim tickets that you have claimed, unless you are an administrator.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await db.removeTicketClaim(channel.id);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setDescription(
        interaction.message.embeds[0].description.split(
          "\n\nOriginal ticket information:",
        )[1],
      )
      .setColor("#5865F2");

    const unclaimedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_ticket")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("✖️"),
    );

    await interaction.message.edit({
      embeds: [embed],
      components: [unclaimedRow],
    });

    await logTicketAction(
      interaction.guild,
      channel.id,
      `Ticket unclaimed by ${user.tag}`,
    );

    await interaction.reply({
      content: `Ticket unclaimed by ${moderator.toString()}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error unclaiming ticket:", error);
    await interaction.reply({
      content: "There was an error unclaiming the ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleTicketClose(interaction) {
  try {
    if (interaction.deferred) return;
    await interaction.deferReply({ flags: 64 });

    const channel = interaction.channel;
    const logChannel = await interaction.guild.channels.fetch(
      process.env.TICKET_LOGS_CHANNEL_ID,
    );

    if (!logChannel) {
      throw new Error("Log channel not found");
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const ticketHistory = [];

    const creationTime = channel.createdAt.toLocaleString();
    ticketHistory.push(`[${creationTime}] SYSTEM: Ticket created`);

    const ticketActions = await db.getTicketActions(channel.id);
    if (ticketActions) {
      ticketActions.forEach((action) => {
        ticketHistory.push(`[${action.timestamp}] SYSTEM: ${action.action}`);
      });
    }

    const messageHistory = Array.from(messages.values())
      .reverse()
      .map((msg) => {
        const time = msg.createdAt.toLocaleString();
        const author = msg.author.tag;
        let content = msg.content || "";

        if (msg.embeds.length > 0) {
          content += msg.embeds
            .map(
              (embed) =>
                `\n[Embed: ${embed.title || "Untitled"}]${embed.description ? " - " + embed.description : ""}`,
            )
            .join("\n");
        }

        if (msg.attachments.size > 0) {
          content +=
            "\n[Attachments: " +
            Array.from(msg.attachments.values())
              .map((att) => att.url)
              .join(", ") +
            "]";
        }

        return `[${time}] ${author}: ${content}`;
      });

    const transcript = [
      `=== TICKET TRANSCRIPT: ${channel.name} ===`,
      `Created at: ${creationTime}`,
      `Closed by: ${interaction.user.tag}`,
      `Closed at: ${new Date().toLocaleString()}`,
      "\n=== TICKET HISTORY ===",
      ...ticketHistory,
      "\n=== MESSAGE HISTORY ===",
      ...messageHistory,
    ].join("\n");

    const cleanTranscript = transcript.replace(/\r\n/g, "\n").slice(0, 100000);

    console.log("Sending transcript to API...");
    const response = await fetch("https://api.e-z.host/paste", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        key: process.env.EZ_HOST_KEY,
        Accept: "application/json",
      },
      body: JSON.stringify({
        text: cleanTranscript,
        title: `${channel.name}-transcript`,
        description: `Ticket transcript for ${channel.name}`,
        language: "text",
      }),
    });

    console.log("API Response Status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `API returned status ${response.status}: ${JSON.stringify(data)}`,
      );
    }

    if (!data.rawUrl) {
      throw new Error(`API response missing rawUrl: ${JSON.stringify(data)}`);
    }

    const embed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setDescription(
        `Ticket ${channel.name} was closed by ${interaction.user.toString()}\n\n[View Transcript](${data.rawUrl})`,
      )
      .setColor("#ED4245")
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
    await interaction.editReply({
      content: "Ticket closed and transcript saved.",
    });
    await db.clearTicketActions(channel.id);
    await channel.delete();
  } catch (error) {
    console.error("Error closing ticket:", error);
    console.error("Full error details:", {
      message: error.message,
      stack: error.stack,
      apiKey: process.env.EZ_HOST_KEY ? "Present" : "Missing",
    });

    const errorMessage =
      "There was an error closing the ticket. Please contact an administrator.";

    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
