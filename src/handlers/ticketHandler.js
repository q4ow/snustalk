import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { db, dbPool } from "../utils/database.js";
import { fetchWithRetry } from "../utils/requests.js";
import { logger } from "../utils/logger.js";

const ticketTypes = {
  GENERAL: {
    name: "general",
    label: "General Support",
    roleType: "staff",
    color: "#5865F2",
  },
  MANAGEMENT: {
    name: "management",
    label: "Management Support",
    roleType: "management",
    color: "#EB459E",
  },
};

const TICKET_DEFAULTS = {
  title: "🎫 Support Tickets",
  description: "Click the buttons below to create a support ticket",
  color: "#5865F2",
  enableClaiming: true,
  thumbnail: null,
  footer: "Unity Support System",
  generalButtonLabel: "General Support",
  managementButtonLabel: "Management Support",
  generalButtonEmoji: "📝",
  managementButtonEmoji: "👑",
  maxTicketsPerUser: 1,
  closeConfirmation: true,
  autoCloseHours: 0,
  buttonStyle: {
    general: ButtonStyle.Primary,
    management: ButtonStyle.Secondary,
  },
};

async function canManageTicket(member, ticketType) {
  try {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    const roleType = ticketType === "MANAGEMENT" ? "management" : "staff";
    const moderatorRoleId = await db.getRoleId(member.guild.id, roleType);

    return member.roles.cache.has(moderatorRoleId);
  } catch (error) {
    logger.error("Error checking ticket permissions:", error);
    return false;
  }
}

async function getNextTicketNumber(guild) {
  try {
    const ticketData = await db.getTicketCounter(guild.id);
    const nextNumber = (ticketData?.counter || 0) + 1;
    await db.updateTicketCounter(guild.id, nextNumber);
    return nextNumber.toString().padStart(4, "0");
  } catch (error) {
    logger.error(
      `Error getting next ticket number for guild ${guild.name}:`,
      error,
    );
    throw error;
  }
}

async function logTicketAction(guild, channelId, action) {
  try {
    await db.addTicketAction(channelId, action);
    logger.debug(`Ticket action logged: ${action}`);

    const logChannelId = await db.getChannelId(guild.id, "ticket_logs");
    if (!logChannelId) {
      logger.warn(`No ticket log channel configured for guild ${guild.name}`);
      return;
    }

    const logChannel = await guild.channels.fetch(logChannelId);
    if (!logChannel) {
      logger.warn(
        `Could not find ticket log channel ${logChannelId} in guild ${guild.name}`,
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Ticket Action")
      .setDescription(action)
      .setColor("#2F3136")
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    logger.error("Error logging ticket action:", error);
  }
}

export async function setupTicketSystem(channel, options = {}) {
  try {
    const settings = {
      ...TICKET_DEFAULTS,
      ...options,
    };

    await db.saveTicketSettings(channel.guild.id, settings);
    logger.info(`Ticket system configured for guild ${channel.guild.name}`);

    let description = settings.description || TICKET_DEFAULTS.description;

    description = description.replace(/\\n/g, "\n");

    const descriptionLines = [
      description,
      settings.description_line2,
      settings.description_line3,
    ].filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle(settings.title)
      .setDescription(
        [
          ...descriptionLines,
          "",
          "Please select the appropriate category below:",
          "• General Support - For general questions and issues",
          "• Management Support - For business inquiries and management issues",
        ].join("\n"),
      )
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
  } catch (error) {
    logger.error(
      `Error setting up ticket system in ${channel.guild.name}:`,
      error,
    );
    throw error;
  }
}

export async function handleTicketCreate(interaction, type) {
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    logger.info(
      `Creating ${type} ticket for ${member.user.tag} in ${guild.name}`,
    );

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

    const supportRoleId = await db.getRoleId(guild.id, ticketType.roleType);
    if (!supportRoleId) {
      throw new Error(`Role ID not configured for ticket type: ${type}`);
    }

    const supportRole = await guild.roles.fetch(supportRoleId);
    if (!supportRole) {
      throw new Error(
        `Support role with ID ${supportRoleId} does not exist in the server.`,
      );
    }

    const category = await guild.channels.fetch(
      await db.getChannelId(guild.id, "ticket_category"),
    );
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
            const lastMessageTimestamp = lastMessage
              ? lastMessage.createdTimestamp
              : channel.createdTimestamp;
            const hoursSinceLastMessage =
              (Date.now() - lastMessageTimestamp) / (1000 * 60 * 60);

            if (hoursSinceLastMessage >= settings.autoCloseHours) {
              await logTicketAction(
                guild,
                channel.id,
                `Ticket automatically closed due to inactivity (${settings.autoCloseHours} hours).`,
              );
              await channel
                .delete("Auto-closed due to inactivity")
                .catch((err) => {
                  logger.error(
                    `Error auto-deleting channel ${channel.id}:`,
                    err,
                  );
                });
              await db.closeTicket(channel.id, "SYSTEM_AUTO_CLOSE");
              await db.clearTicketActions(channel.id);
              await db.removeTicketClaim(channel.id);
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

    logger.info(`Created ticket #${ticketNumber} for ${member.user.tag}`);
  } catch (error) {
    logger.error(`Error creating ticket for ${interaction.user.tag}:`, error);

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

    logger.info(`${user.tag} attempting to claim ticket ${channel.name}`);

    if (!(await canManageTicket(moderator, "STAFF"))) {
      logger.warn(`${user.tag} attempted to claim ticket without permission`);
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

    logger.info(`Ticket ${channel.name} claimed by ${user.tag}`);
  } catch (error) {
    logger.error(`Error claiming ticket for ${interaction.user.tag}:`, error);
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

    logger.info(`${user.tag} attempting to unclaim ticket ${channel.name}`);

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

    logger.info(`Ticket ${channel.name} unclaimed by ${user.tag}`);
  } catch (error) {
    logger.error(`Error unclaiming ticket for ${interaction.user.tag}:`, error);
    await interaction.reply({
      content: "There was an error unclaiming the ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleTicketClose(interaction) {
  try {
    if (!interaction?.channel || !interaction?.guild || !interaction?.user) {
      logger.error("Invalid interaction object passed to handleTicketClose");
      if (interaction?.reply) {
        await interaction.reply({
          content: "An internal error occurred.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    logger.info(
      `${interaction.user.tag} attempting to close ticket ${interaction.channel.name}`,
    );

    if (interaction.deferred) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    const logChannelId = await db.getChannelId(
      interaction.guild.id,
      "ticket_logs",
    );

    if (!logChannelId) {
      logger.error(
        `Log channel ID not found for guild ${interaction.guild.id}`,
      );
      await interaction.editReply({
        content:
          "Ticket log channel not configured. Cannot close ticket properly.",
      });
      return;
    }

    let logChannel;
    try {
      logChannel = await interaction.guild.channels.fetch(logChannelId);
      if (!logChannel) throw new Error("Fetched channel is null or undefined.");
    } catch (error) {
      logger.error(
        `Failed to fetch log channel with ID ${logChannelId}:`,
        error,
      );
      await interaction.editReply({
        content:
          "Could not find the ticket log channel. Cannot close ticket properly.",
      });
      return;
    }

    const messages = await fetchWithRetry(
      `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        },
      },
    ).then((res) => res.json());

    const ticketHistory = [];
    const creationTime = channel.createdAt.toLocaleString();
    ticketHistory.push(`[${creationTime}] SYSTEM: Ticket created`);

    const ticketActions = await db.getTicketActions(channel.id);
    if (ticketActions) {
      ticketActions.forEach((action) => {
        ticketHistory.push(`[${action.timestamp}] SYSTEM: ${action.action}`);
      });
    }

    for (const msg of messages) {
      try {
        const time = new Date(msg.timestamp).toLocaleString();
        const author = msg.author.tag;
        let content = msg.content || "";

        content = content
          .replace(/@(everyone|here)/g, "@\u200b$1")
          .replace(/<@[!&]?(\d+)>/g, "@user")
          .replace(/[^\x20-\x7E\n]/g, "")
          .trim();

        if (msg.embeds?.length > 0) {
          content += msg.embeds
            .map((embed) => {
              const title = embed.title
                ? embed.title.replace(/[^\x20-\x7E\n]/g, "")
                : "Untitled";
              const desc = embed.description
                ? embed.description
                    .replace(/[^\x20-\x7E\n]/g, "")
                    .replace(/<@[!&]?(\d+)>/g, "@user")
                    .trim()
                : "";
              return `\n[Embed: ${title}]${desc ? " - " + desc : ""}`;
            })
            .join("\n");
        }

        if (content) {
          ticketHistory.push(`[${time}] ${author}: ${content}`);
        }
      } catch (error) {
        logger.error("Error processing message:", error);
        continue;
      }
    }

    const cleanTranscript = ticketHistory
      .reverse()
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 50000);

    const ezHostKey = await db.getApiKey(interaction.guild.id, "ez_host");
    if (!ezHostKey) {
      logger.error(
        `EZ Host API key not configured for guild ${interaction.guild.name}`,
      );
      throw new Error("EZ Host API key not configured");
    }

    try {
      const response = await fetchWithRetry("https://api.e-z.host/paste", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          key: ezHostKey,
          Accept: "application/json",
        },
        body: JSON.stringify({
          text: cleanTranscript,
          title: channel.name.replace(/[^\w-]/g, "-"),
          description: `Ticket transcript for ${channel.name}`,
          language: "plaintext",
        }),
      });

      const data = await response.json();
      if (!data.rawUrl) {
        throw new Error("API response missing rawUrl");
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

      const result = await dbPool.query(
        "SELECT id FROM tickets WHERE channel_id = $1",
        [channel.id],
      );

      const ticketId = result.rows[0]?.id;

      if (ticketId) {
        await db.closeTicket(ticketId, interaction.user.id);

        await db.addTicketMessage(ticketId, {
          authorId: "SYSTEM",
          content: `Ticket closed by ${interaction.user.tag}\nTranscript: ${data.rawUrl}`,
        });
      } else {
        logger.warn(`No ticket found with channel ID ${channel.id}`);
      }

      await db.clearTicketActions(channel.id);
      await channel.delete().catch((error) => {
        logger.error("Error deleting channel:", error);
        throw new Error("Failed to delete ticket channel");
      });

      logger.info(`Ticket ${channel.name} closed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error("Error saving ticket transcript:", error);
      throw error;
    }
  } catch (error) {
    logger.error(`Error closing ticket ${interaction.channel?.name}:`, error);
    logger.debug("Full error details:", {
      message: error.message,
      stack: error.stack,
    });

    const errorMessage =
      error.code === "UND_ERR_CONNECT_TIMEOUT"
        ? "Connection timeout while closing ticket. Please try again."
        : "There was an error closing the ticket. Please contact an administrator.";

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
