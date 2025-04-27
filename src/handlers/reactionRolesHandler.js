import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { db } from "../utils/database.js";

export async function createReactionRoles(channel, options) {
  const { title, description, roles, color } = options;

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
  }

  if (currentRow.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(currentRow));
  }

  const message = await channel.send({
    embeds: [embed],
    components: rows,
  });

  await db.createReactionRoles(message.id, channel.id, roles);
  return message;
}

export async function handleReactionRole(interaction) {
  try {
    const roleId = interaction.customId.replace("role_", "");
    const member = interaction.member;

    const roleConfig = await db.getReactionRole(interaction.message.id, roleId);
    if (!roleConfig) {
      await interaction.reply({
        content: "❌ This role configuration no longer exists.",
        flags: 64,
      });
      return;
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
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
        await interaction.reply({
          content: `✅ Removed the ${role.name} role!`,
          flags: 64,
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: `✅ Added the ${role.name} role!`,
          flags: 64,
        });
      }
    } catch (error) {
      await interaction.reply({
        content: "❌ I don't have permission to manage this role.",
        flags: 64,
      });
      console.error("Failed to manage role:", error);
    }
  } catch (error) {
    console.error("Error handling reaction role:", error);
    await interaction.reply({
      content: "❌ An error occurred while managing your role.",
      flags: 64,
    });
  }
}
