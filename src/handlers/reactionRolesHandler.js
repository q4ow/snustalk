import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

export async function createReactionRoles(channel, options) {
  try {
    const { title, description, roles, color } = options;
    logger.info(`Creating reaction roles message in channel ${channel.name}`);

    const embed = new EmbedBuilder()
      .setTitle(title || "Role Selection")
      .setDescription(description || "Click the buttons below to toggle roles!")
      .setColor(color || "#2F3136")
      .setTimestamp();

    const rows = [];
    let currentRow = [];

    for (const role of roles) {
      if (currentRow.length === 5) {
        rows.push(new ActionRowBuilder().addComponents(currentRow));
        currentRow = [];
      }

      const button = new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(role.label || role.name)
        .setStyle(role.style ? ButtonStyle[role.style] : ButtonStyle.Primary);

      if (role.emoji) {
        const cleanEmoji = role.emoji.trim();
        if (cleanEmoji) {
          button.setEmoji(cleanEmoji);
        }
      }

      currentRow.push(button);
      logger.debug(`Added button for role ${role.name} (${role.id})`);
    }

    if (currentRow.length > 0) {
      rows.push(new ActionRowBuilder().addComponents(currentRow));
    }

    const message = await channel.send({
      embeds: [embed],
      components: rows,
    });

    await db.createReactionRoles(message.id, channel.id, roles);
    logger.info(
      `Successfully created reaction roles message ${message.id} with ${roles.length} roles`,
    );
    return message;
  } catch (error) {
    logger.error(
      `Error creating reaction roles in channel ${channel.name}:`,
      error,
    );
    throw error;
  }
}

export async function handleReactionRole(interaction) {
  try {
    const roleId = interaction.customId.replace("role_", "");
    const member = interaction.member;

    logger.debug(`Processing role reaction for ${member.user.tag} (${roleId})`);

    const roleConfig = await db.getReactionRole(interaction.message.id, roleId);
    if (!roleConfig) {
      logger.warn(
        `Invalid role configuration for message ${interaction.message.id}, role ${roleId}`,
      );
      await interaction.reply({
        content: "❌ This role configuration no longer exists.",
        flags: 64,
      });
      return;
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      logger.warn(
        `Role ${roleId} no longer exists in guild ${interaction.guild.name}`,
      );
      await interaction.reply({
        content: "❌ This role no longer exists.",
        flags: 64,
      });
      return;
    }

    const hasRole = member.roles.cache.has(roleId);
    try {
      if (hasRole) {
        await member.roles.remove(role);
        logger.info(`Removed role ${role.name} from ${member.user.tag}`);
        await interaction.reply({
          content: `✅ Removed the ${role.name} role!`,
          flags: 64,
        });
      } else {
        await member.roles.add(role);
        logger.info(`Added role ${role.name} to ${member.user.tag}`);
        await interaction.reply({
          content: `✅ Added the ${role.name} role!`,
          flags: 64,
        });
      }
    } catch (error) {
      logger.error(
        `Failed to manage role ${role.name} for ${member.user.tag}:`,
        error,
      );
      await interaction.reply({
        content: "❌ I don't have permission to manage this role.",
        flags: 64,
      });
    }
  } catch (error) {
    logger.error(
      `Error handling reaction role for ${interaction?.member?.user?.tag}:`,
      error,
    );
    await interaction.reply({
      content: "❌ An error occurred while managing your role.",
      flags: 64,
    });
  }
}
