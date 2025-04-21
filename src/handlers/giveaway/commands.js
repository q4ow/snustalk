import { db } from "../../utils/database.js";

function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([smhdw])$/);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2];

  let milliseconds;

  switch (unit) {
    case "s":
      milliseconds = amount * 1000;
      break;
    case "m":
      milliseconds = amount * 60 * 1000;
      break;
    case "h":
      milliseconds = amount * 60 * 60 * 1000;
      break;
    case "d":
      milliseconds = amount * 24 * 60 * 60 * 1000;
      break;
    case "w":
      milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }

  return milliseconds;
}

export async function handleCreateGiveawayCommand(interaction, client) {
  const prize = interaction.options.getString("prize");
  const durationStr = interaction.options.getString("duration");
  const winnerCount = interaction.options.getInteger("winners") || 1;
  const description = interaction.options.getString("description");
  const channel =
    interaction.options.getChannel("channel") || interaction.channel;
  const requiredRole = interaction.options.getRole("required_role");
  const minAccountAge = interaction.options.getString("min_account_age");
  const minServerAge = interaction.options.getString("min_server_age");
  const buttonLabel =
    interaction.options.getString("button_label") || "Enter Giveaway 🎉";
  const embedColor = interaction.options.getString("embed_color") || "#FF69B4";
  const image = interaction.options.getString("image");
  const endMessage = interaction.options.getString("end_message");

  const requirements = {};
  if (requiredRole) requirements.roles = [requiredRole.id];
  if (minAccountAge) {
    const duration = parseDuration(minAccountAge);
    if (!duration) {
      await interaction.reply({
        content: "❌ Invalid account age format. Use format like: 1d, 1w",
        flags: 64,
      });
      return;
    }
    requirements.min_account_age = duration;
  }
  if (minServerAge) {
    const duration = parseDuration(minServerAge);
    if (!duration) {
      await interaction.reply({
        content: "❌ Invalid server age format. Use format like: 1d, 1w",
        flags: 64,
      });
      return;
    }
    requirements.min_server_age = duration;
  }

  const duration = parseDuration(durationStr);
  if (!duration) {
    await interaction.reply({
      content: "❌ Invalid duration format. Use format like: 1h, 1d, 1w",
      flags: 64,
    });
    return;
  }

  try {
    await client.giveaways.createGiveaway({
      guild_id: interaction.guildId,
      channel_id: channel.id,
      host_id: interaction.user.id,
      prize,
      description,
      duration,
      winner_count: winnerCount,
      requirements,
      button_label: buttonLabel,
      embed_color: embedColor,
      image,
      end_message: endMessage,
    });
    await interaction.reply({
      content: `✅ Created giveaway for **${prize}** in ${channel}`,
      flags: 64,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Failed to create giveaway: ${error.message}`,
      flags: 64,
    });
  }
}

export async function handleEndGiveawayCommand(interaction, client) {
  const messageId = interaction.options.getString("message_id");
  try {
    const giveaway = await db.getGiveawayByMessageId(
      messageId,
      interaction.guildId,
    );
    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found",
        flags: 64,
      });
      return;
    }

    const winners = await client.giveaways.endGiveaway(giveaway.id, true);
    await interaction.reply({
      content:
        winners.length > 0
          ? `✅ Giveaway ended! Winners: ${winners.map((id) => `<@${id}>`).join(", ")}`
          : "✅ Giveaway ended! No valid winners.",
      flags: 64,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Failed to end giveaway: ${error.message}`,
      flags: 64,
    });
  }
}

export async function handleRerollGiveawayCommand(interaction, client) {
  const messageId = interaction.options.getString("message_id");
  const winnerCount = interaction.options.getInteger("winners");

  try {
    const giveaway = await db.getGiveawayByMessageId(
      messageId,
      interaction.guildId,
    );
    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found",
        flags: 64,
      });
      return;
    }
    if (!giveaway.ended) {
      await interaction.reply({
        content: "❌ This giveaway hasn't ended yet",
        flags: 64,
      });
      return;
    }

    const winners = await client.giveaways.rerollGiveaway(
      giveaway.id,
      winnerCount,
    );
    await interaction.reply({
      content:
        winners.length > 0
          ? `🎉 New winner${winners.length > 1 ? "s" : ""}: ${winners.map((id) => `<@${id}>`).join(", ")}!`
          : "❌ Could not determine new winner(s). No valid entries found.",
      flags: 64,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Failed to reroll giveaway: ${error.message}`,
      flags: 64,
    });
  }
}

export async function handleBlacklistUserCommand(interaction, client) {
  const messageId = interaction.options.getString("message_id");
  const user = interaction.options.getUser("user");

  try {
    const giveaway = await db.getGiveawayByMessageId(
      messageId,
      interaction.guildId,
    );
    if (!giveaway) {
      await interaction.reply({
        content: "❌ Giveaway not found",
        flags: 64,
      });
      return;
    }

    await client.giveaways.blacklistUser(giveaway.id, user.id);
    await interaction.reply({
      content: `✅ ${user.tag} has been blacklisted from the giveaway.`,
      flags: 64,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Failed to blacklist user: ${error.message}`,
      flags: 64,
    });
  }
}

export async function handleGiveawayEntriesCommand(interaction) {
  const messageId = interaction.options.getString("message_id");
  const giveaway = await db.getGiveawayByMessageId(
    messageId,
    interaction.guildId,
  );
  if (!giveaway) {
    await interaction.reply({
      content: "❌ Giveaway not found",
      flags: 64,
    });
    return;
  }
  const entries = await db.getGiveawayEntries(giveaway.id);
  if (!entries.length) {
    await interaction.reply({ content: "No entries yet!", flags: 64 });
    return;
  }
  const entryMentions = entries.map((e) => `<@${e.user_id}>`).join(", ");
  await interaction.reply({
    content: `Entries (${entries.length}):\n${entryMentions}`,
    flags: 64,
  });
}

export async function handleGiveawayCommand(interaction, client) {
  const subCommand = interaction.options.getSubcommand();

  switch (subCommand) {
    case "create":
      await handleCreateGiveawayCommand(interaction, client);
      break;
    case "end":
      await handleEndGiveawayCommand(interaction, client);
      break;
    case "reroll":
      await handleRerollGiveawayCommand(interaction, client);
      break;
    case "blacklist":
      await handleBlacklistUserCommand(interaction, client);
      break;
    case "entries":
      await handleGiveawayEntriesCommand(interaction, client);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown giveaway sub-command",
        flags: 64,
      });
  }
}
