import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

export async function handleVerification(reaction, user) {
  try {
    if (user.bot) return;

    const verificationChannelId = await db.getChannelId(
      reaction.message.guild.id,
      "verification",
    );
    if (reaction.message.channelId !== verificationChannelId) return;
    if (reaction.emoji.name !== "✅") return;

    logger.info(
      `Processing verification for ${user.tag} in ${reaction.message.guild.name}`,
    );

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    const verifiedRoleId = await db.getRoleId(guild.id, "verified");
    const unverifiedRoleId = await db.getRoleId(guild.id, "unverified");
    const additionalRoleIds =
      (await db.getGuildSettings(guild.id))?.role_ids?.additional_verified ||
      [];

    if (!verifiedRoleId || !unverifiedRoleId) {
      logger.error(`Required roles not found in guild ${guild.name}:`, {
        verifiedRole: verifiedRoleId ? "Found" : "Missing",
        unverifiedRole: unverifiedRoleId ? "Found" : "Missing",
      });
      return;
    }

    const verifiedRole = await guild.roles.fetch(verifiedRoleId);
    const unverifiedRole = await guild.roles.fetch(unverifiedRoleId);

    if (!verifiedRole || !unverifiedRole) {
      logger.error(`Required roles do not exist in guild ${guild.name}`);
      return;
    }

    try {
      await member.roles.add(verifiedRole);
      logger.debug(`Added verified role to ${user.tag}`);

      if (additionalRoleIds.length > 0) {
        logger.debug(
          `Adding ${additionalRoleIds.length} additional roles to ${user.tag}`,
        );
        for (const roleId of additionalRoleIds) {
          const role = await guild.roles.fetch(roleId).catch((error) => {
            logger.error(`Failed to fetch additional role ${roleId}:`, error);
            return null;
          });

          if (role) {
            await member.roles.add(role).catch((error) => {
              logger.error(
                `Failed to add role ${roleId} to member ${member.id}:`,
                error,
              );
            });
          }
        }
      }

      await member.roles.remove(unverifiedRole);
      logger.debug(`Removed unverified role from ${user.tag}`);
    } catch (error) {
      if (error.code === 50013) {
        logger.debug(
          `Skipping role modification for staff member: ${member.user.tag}`,
        );
        return;
      } else if (error.code === 10011) {
        logger.error(
          `Role no longer exists in guild ${guild.name}: ${error.message}`,
        );
        return;
      } else {
        logger.error(`Error modifying roles for ${user.tag}:`, error);
        throw error;
      }
    }

    try {
      const verificationEmbed = new EmbedBuilder()
        .setTitle("🎉 Welcome to " + guild.name + "!")
        .setDescription("You have been successfully verified!")
        .setColor("#2ECC71")
        .addFields(
          {
            name: "✨ Access Granted",
            value: "You now have access to all public channels.",
          },
          {
            name: "❓ Need Help?",
            value: "Feel free to ask in our help channels!",
          },
        )
        .setFooter({ text: "Thanks for joining us!" })
        .setTimestamp();

      let embeds = [verificationEmbed];
      let components = [];

      const restoreRecordLink = await db.getExternalLink(
        guild.id,
        "restorecord",
      );
      if (restoreRecordLink) {
        logger.debug(`Adding RestoreCore backup option for ${user.tag}`);
        const backupEmbed = new EmbedBuilder()
          .setTitle("🛡️ Optional Security Measure")
          .setDescription(
            "While completely optional, we recommend backing up your access with RestoreCore.",
          )
          .setColor("#3498DB")
          .addFields(
            {
              name: "Why RestoreCore?",
              value:
                "In the unlikely event of a server grief, this helps us quickly restore your roles and access.",
            },
            {
              name: "⚠️ Important Note",
              value:
                "This is **100% optional** and not required to maintain your access in the server.",
            },
          );

        const restoreButton = new ButtonBuilder()
          .setLabel("Backup Access (Optional)")
          .setURL(restoreRecordLink)
          .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder().addComponents(restoreButton);

        embeds.push(backupEmbed);
        components.push(row);
      }

      try {
        await user.send({
          embeds: embeds,
          components: components,
        });
        logger.debug(`Sent verification DM to ${user.tag}`);
      } catch (error) {
        logger.warn(`Could not send DM to ${user.tag}:`, error);
        const sentMessage = await reaction.message.channel.send({
          content: `<@${user.id}>`,
          embeds: embeds,
          components: components,
        });

        setTimeout(() => {
          sentMessage
            .delete()
            .catch((error) =>
              logger.error(
                `Could not delete verification message for ${user.tag}:`,
                error,
              ),
            );
        }, 30000);
      }
    } catch (error) {
      logger.error(`Could not send verification embeds to ${user.tag}:`, error);
    }

    logger.info(`Successfully verified ${user.tag} in ${guild.name}`);
  } catch (error) {
    logger.error(`Error in verification handler for ${user?.tag}:`, error);
  }
}
