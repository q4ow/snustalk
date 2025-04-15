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
import { handleGoodbye } from "./handlers/goodbyeHandler.js";
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
// import { startStatsTracker } from "./handlers/statsHandler.js";
import {
  handleApplicationResponse,
  handleApplicationButton,
} from "./handlers/applicationHandler.js";
import { setupLoggingEvents } from "./handlers/eventHandler.js";
import { handleMessage as handleAutomod } from "./handlers/automodHandler.js";

dotenv.config();

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "GUILD_ID",
  "VERIFICATION_CHANNEL_ID",
  "WELCOME_CHANNEL_ID",
  "GOODBYE_CHANNEL_ID",
  "VERIFIED_ROLE_ID",
  "UNVERIFIED_ROLE_ID",
  "TICKET_CATEGORY_ID",
  "MANAGEMENT_ROLE_ID",
  "MODERATOR_ROLE_ID",
  "STAFF_ROLE_ID",
  "TICKET_LOGS_CHANNEL_ID",
  "EZ_HOST_KEY",
  // "STATS_MEMBERS_CHANNEL_ID",
  // "STATS_BOTS_CHANNEL_ID",
  // "STATS_TOTAL_TICKETS_CHANNEL_ID",
  // "STATS_OPEN_TICKETS_CHANNEL_ID",
  "APPLICATIONS_CHANNEL_ID",
  "APPLICATIONS_LOGS_CHANNEL_ID",
  "MEMBER_LOGS_CHANNEL_ID",
  "MESSAGE_LOGS_CHANNEL_ID",
  "MOD_LOGS_CHANNEL_ID",
  "VOICE_LOGS_CHANNEL_ID",
  "CHANNEL_LOGS_CHANNEL_ID",
  "ROLE_LOGS_CHANNEL_ID",
  "SERVER_LOGS_CHANNEL_ID",
  "USER_LOGS_CHANNEL_ID",
  "INVITE_LOGS_CHANNEL_ID",
  "THREAD_LOGS_CHANNEL_ID",
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
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
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
  console.log("\n");
  console.log("🔧 Initializing systems...");

  await registerSlashCommands(client);
  console.log("✅ Slash commands registered");
  setupLoggingEvents(client);
  console.log("✅ Logging system initialized");
  console.log("✅ Ticketing handler initialized");
  console.log("✅ Purge handler initialized");
  console.log("✅ Automod initialized");
  console.log("✅ Application handler initialized");

  // const guild = client.guilds.cache.first();
  // await startStatsTracker(guild);
  console.log("✅ Stats tracker initialized");

  client.user.setPresence({
    activities: [
      {
        name: "SnusTalk Central",
        type: ActivityType.Watching,
        state: "Snussy v1.0.0",
        url: "https://github.com/q4ow/snustalk"
      },
    ],
    status: "dnd",
  });

  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error("No guild available");
    }

    const unverifiedRole = await guild.roles
      .fetch(process.env.UNVERIFIED_ROLE_ID)
      .catch((error) => {
        console.error(
          `Failed to fetch unverified role (${process.env.UNVERIFIED_ROLE_ID}):`,
          error,
        );
        return null;
      });

    if (!unverifiedRole) {
      console.error(
        `Unverified role (${process.env.UNVERIFIED_ROLE_ID}) not found in guild ${guild.name}`,
      );
      // console.log(
      //   "Available roles:",
      //   guild.roles.cache.map((r) => `${r.name}: ${r.id}`).join(", "),
      // );
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `✅ Unverified role (${unverifiedRole.name}) (${unverifiedRole.id}) found in guild ${guild.name}`,
        );
      }
    }

    const verifiedRole = await guild.roles
      .fetch(process.env.VERIFIED_ROLE_ID)
      .catch((error) => {
        console.error(
          `Failed to fetch verified role (${process.env.VERIFIED_ROLE_ID}):`,
          error,
        );
        return null;
      });

    if (!verifiedRole) {
      console.error(
        `Verified role (${process.env.VERIFIED_ROLE_ID}) not found in guild ${guild.name}`,
      );
      // console.log(
      //   "Available roles:",
      //   guild.roles.cache.map((r) => `${r.name}: ${r.id}`).join(", "),
      // );
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `✅ Verified role (${verifiedRole.name}) (${verifiedRole.id}) found in guild ${guild.name}`,
        );
      }
    }

    await setupVerificationMessage();
    console.log("✅ Verification handler initialized");

    const welcomeChannel = await client.channels.fetch(
      process.env.WELCOME_CHANNEL_ID,
    );
    if (!welcomeChannel) {
      throw new Error("Welcome channel not found");
    }
    console.log("✅ Welcome handler initialized");
  } catch (error) {
    console.error("❌ Failed to initialize systems:", error);
    console.error("Full error details:", error);
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
client.on("guildMemberRemove", handleGoodbye);
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
        create_management_ticket: () =>
          handleTicketCreate(interaction, "MANAGEMENT"),
        claim_ticket: () => handleTicketClaim(interaction),
        unclaim_ticket: () => handleTicketUnclaim(interaction),
        close_ticket: () => handleTicketClose(interaction),
      };

      if (
        interaction.customId.startsWith("accept_app_") ||
        interaction.customId.startsWith("deny_app_")
      ) {
        await handleApplicationButton(interaction);
        return;
      }

      const handler = handlers[interaction.customId];
      if (handler) await handler();
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.includes("_app_modal_")) {
        return;
      }
    }
  } catch (error) {
    console.error("❌ Error handling interaction:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "An error occurred while processing your request.",
          flags: 64,
        })
        .catch(() => { });
    }

    client.emit("interactionError", interaction, error);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle automod first
  await handleAutomod(message);

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

client.on("interactionError", async (interaction, error) => {
  console.error("Interaction error:", error);

  try {
    const errorMessage =
      error.code === "UND_ERR_CONNECT_TIMEOUT"
        ? "Connection timeout. Please try again."
        : "An error occurred while processing your request.";

    if (interaction.deferred) {
      await interaction
        .editReply({
          content: `❌ ${errorMessage}`,
          flags: 64,
        })
        .catch(console.error);
    } else if (!interaction.replied) {
      await interaction
        .reply({
          content: `❌ ${errorMessage}`,
          flags: 64,
        })
        .catch(console.error);
    }
  } catch (e) {
    console.error("Error handling interaction error:", e);
  }
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
