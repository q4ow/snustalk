import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActivityType,
} from "discord.js";
import dotenv from "dotenv";
import { handleVerification } from "./handlers/verificationHandler.js";
import { handleWelcome } from "./handlers/welcomeHandler.js";
import {
  handleTicketCreate,
  handleTicketClose,
  handleTicketClaim,
  handleTicketUnclaim,
} from "./handlers/ticketHandler.js";
import {
  handleCommand,
  commands,
  registerSlashCommands,
  handleSlashCommand,
} from "./utils/commands.js";
import { startStatsTracker } from "./handlers/statsHandler.js";
import { handleApplicationResponse, handleApplicationButton } from "./handlers/applicationHandler.js";

dotenv.config();

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "GUILD_ID",
  "VERIFICATION_CHANNEL_ID",
  "WELCOME_CHANNEL_ID",
  "VERIFIED_ROLE_ID",
  "UNVERIFIED_ROLE_ID",
  "TICKET_CATEGORY_ID",
  "MANAGEMENT_ROLE_ID",
  "STAFF_ROLE_ID",
  "TICKET_LOGS_CHANNEL_ID",
  "EZ_HOST_KEY",
  "STATS_MEMBERS_CHANNEL_ID",
  "STATS_BOTS_CHANNEL_ID",
  "STATS_TOTAL_TICKETS_CHANNEL_ID",
  "STATS_OPEN_TICKETS_CHANNEL_ID",
  "APPLICATIONS_CATEGORY_ID",
  "APPLICATIONS_CHANNEL_ID",
  "APPLICATIONS_LOGS_CHANNEL_ID",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

client.once("ready", async () => {
  console.log(`🚀 Bot is online as ${client.user.tag}`);
  console.log(`👥 Connected to ${client.guilds.cache.size} guild(s)`);
  console.log(`🔗 Bot ID: ${client.user.id}`);
  console.log();

  console.log("Initializing...");
  await registerSlashCommands(client);
  console.log("✅ Slash commands registered");
  console.log("✅ Ticketing handler initialized");
  console.log("✅ Purge handler initialized");
  console.log("✅ Notes handler initialized");

  const guild = client.guilds.cache.first();
  await startStatsTracker(guild);
  console.log("✅ Stats tracker initialized");

  client.user.setPresence({
    activities: [
      {
        name: "SnusTalk Central",
        type: ActivityType.Watching,
      },
    ],
    status: "dnd",
  });

  try {
    await setupVerificationMessage();
    console.log("✅ Verification handler initialized");

    const welcomeChannel = await client.channels.fetch(
      process.env.WELCOME_CHANNEL_ID,
    );
    if (!welcomeChannel) throw new Error("Welcome channel not found");

    const unverifiedRole = await client.guilds.cache
      .first()
      .roles.fetch(process.env.UNVERIFIED_ROLE_ID);
    if (!unverifiedRole) throw new Error("Unverified role not found");

    console.log("✅ Welcome handler initialized");
  } catch (error) {
    console.error("❌ Failed to initialize systems:", error);
  }
});

async function setupVerificationMessage() {
  const channel = await client.channels.fetch(
    process.env.VERIFICATION_CHANNEL_ID,
  );
  if (!channel) throw new Error("Verification channel not found");

  const messages = await channel.messages.fetch({ limit: 10 });
  const existingVerification = messages.find(
    (msg) =>
      msg.author.id === client.user.id &&
      msg.embeds.length > 0 &&
      msg.embeds[0].title === "Member Verification",
  );

  if (existingVerification) {
    const checkReaction = existingVerification.reactions.cache.get("✅");
    if (!checkReaction) await existingVerification.react("✅");
    return;
  }

  const verificationEmbed = new EmbedBuilder()
    .setTitle("Member Verification")
    .setDescription(
      "React with ✅ to verify yourself and gain access to the server.",
    )
    .setColor("#00ff00")
    .setTimestamp();

  const message = await channel.send({ embeds: [verificationEmbed] });
  await message.react("✅");
}

client.on("guildMemberAdd", handleWelcome);
client.on("messageReactionAdd", handleVerification);

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      const handlers = {
        create_general_ticket: () => handleTicketCreate(interaction, "GENERAL"),
        create_management_ticket: () => handleTicketCreate(interaction, "MANAGEMENT"),
        claim_ticket: () => handleTicketClaim(interaction),
        unclaim_ticket: () => handleTicketUnclaim(interaction),
        close_ticket: () => handleTicketClose(interaction),
      };

      if (interaction.customId.startsWith('accept_app_') || interaction.customId.startsWith('deny_app_')) {
        await handleApplicationButton(interaction);
        return;
      }

      const handler = handlers[interaction.customId];
      if (handler) await handler();
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.includes('_app_modal_')) {
        return;
      }
    }

  } catch (error) {
    console.error("❌ Error handling interaction:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred while processing your request.",
        flags: 64,
      }).catch(() => { });
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.type === 1) {
    await handleApplicationResponse(message);
    return;
  }

  try {
    await handleCommand(message, commands);
  } catch (error) {
    console.error("❌ Error handling command:", error);
  }
});

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
  process.exit(1);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Failed to login:", error);
  process.exit(1);
});
