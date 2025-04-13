import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export async function handleVerification(reaction, user) {
  try {
    if (user.bot) return;
    if (reaction.message.channelId !== process.env.VERIFICATION_CHANNEL_ID)
      return;
    if (reaction.emoji.name !== "✅") return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    const verifiedRole = await guild.roles
      .fetch(process.env.VERIFIED_ROLE_ID)
      .catch((error) => {
        console.error(`Failed to fetch verified role:`, error);
        return null;
      });

    const unverifiedRole = await guild.roles
      .fetch(process.env.UNVERIFIED_ROLE_ID)
      .catch((error) => {
        console.error(`Failed to fetch unverified role:`, error);
        return null;
      });

    if (!verifiedRole || !unverifiedRole) {
      console.error("Required roles not found:", {
        verifiedRole: verifiedRole ? "Found" : "Missing",
        unverifiedRole: unverifiedRole ? "Found" : "Missing",
        verifiedRoleId: process.env.VERIFIED_ROLE_ID,
        unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID,
      });
      return;
    }

    try {
      await member.roles.add(verifiedRole);

      if (process.env.ADDITIONAL_VERIFIED_ROLE_IDS) {
        const additionalRoleIds =
          process.env.ADDITIONAL_VERIFIED_ROLE_IDS.split(",").map((id) =>
            id.trim(),
          );
        for (const roleId of additionalRoleIds) {
          const role = await guild.roles.fetch(roleId).catch((error) => {
            console.error(`Failed to fetch additional role ${roleId}:`, error);
            return null;
          });

          if (role) {
            await member.roles.add(role).catch((error) => {
              console.error(
                `Failed to add role ${roleId} to member ${member.id}:`,
                error,
              );
            });
          }
        }
      }
      await member.roles.remove(unverifiedRole);
    } catch (error) {
      if (error.code === 50013) {
        console.log(
          `Skipping role modification for staff member: ${member.user.tag}`,
        );
        return;
      } else if (error.code === 10011) {
        console.error(`Role no longer exists in the guild: ${error.message}`);
        return;
      } else {
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

      if (process.env.RESTORECORD_LINK) {
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
          .setURL(process.env.RESTORECORD_LINK)
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
      } catch (error) {
        console.error("Could not send DM to user:", error);
        const sentMessage = await reaction.message.channel.send({
          content: `<@${user.id}>`,
          embeds: embeds,
          components: components,
        });

        setTimeout(() => {
          sentMessage
            .delete()
            .catch((error) =>
              console.error("Could not delete verification message:", error),
            );
        }, 30000);
      }
    } catch (error) {
      console.error("Could not send embeds:", error);
    }
  } catch (error) {
    console.error("Error in verification handler:", error);
  }
}
