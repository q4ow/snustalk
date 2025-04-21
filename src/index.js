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
import { setupLoggingEvents } from "./handlers/eventHandler.js";
import { handleMessage as handleAutomod } from "./handlers/automodHandler.js";
import { startTypingApi } from "./api/typing.js";
import { startApiServer } from "./api/server.js";
import { GiveawayHandler } from "./handlers/giveawayHandler.js";
import { db } from "./utils/database.js";
import { ensureGuildRoles } from "./utils/setupRoles.js";
import {
  handleApplicationResponse,
} from "./handlers/applicationHandler.js";
import {
  handleReactionRole,
} from "./handlers/reactionRolesHandler.js";
import { AntiRaidHandler } from "./handlers/antiRaid/handler.js";
import {
  handleAntiRaidCommand,
} from "./handlers/antiRaid/commands.js";

dotenv.config();

const SNUSSY_VERSION = process.env.VERSION || "1.1.0";
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
let healthCheckInterval;

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_HOST",
  "DB_PORT",
];

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
  restRequestTimeout: 30000,
  retryLimit: 5,
  failIfNotExists: false,
});

function handleError(context, error) {
  console.error(`❌ Error in ${context}:`, error);
  return error;
}

function validateEnvironment() {
  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }

  console.log("✅ Environment variables validated");
}

function updateBotPresence() {
  client.user.setPresence({
    activities: [
      {
        name: `${client.guilds.cache.size} servers`,
        type: ActivityType.Watching,
        state: `Snussy v${SNUSSY_VERSION}`
      },
    ],
    status: "dnd",
  });
}

export async function runHealthCheck() {
  try {
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      console.error("❌ Database health check failed");
      process.exit(1);
    }

    if (!client.isReady()) {
      console.error("❌ Bot is not ready, attempting to reconnect...");
      await client.destroy();
      await client.login(process.env.DISCORD_TOKEN);
    }

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        if (!guild.available) {
          console.warn(`⚠️ Guild ${guildId} is unavailable`);
          continue;
        }

        const botMember = await guild.members.fetch(client.user.id);
        const missingPermissions = [];

        const requiredPermissions = [
          "ManageRoles",
          "ManageChannels",
          "KickMembers",
          "BanMembers",
          "ManageMessages",
          "ViewChannel",
          "SendMessages",
          "EmbedLinks",
          "AttachFiles",
          "ReadMessageHistory",
          "AddReactions",
        ];

        for (const perm of requiredPermissions) {
          if (!botMember.permissions.has(perm)) {
            missingPermissions.push(perm);
          }
        }

        if (missingPermissions.length > 0) {
          console.warn(
            `⚠️ Missing permissions in ${guild.name}: ${missingPermissions.join(", ")}`,
          );
        }
      } catch (error) {
        handleError(`checking guild ${guildId}`, error);
      }
    }

    updateBotPresence();
  } catch (error) {
    handleError("health check", error);
  }
}

async function setupVerificationMessage(channel) {
  if (!channel) return;

  try {
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
  } catch (error) {
    handleError("setting up verification message", error);
  }
}

async function initializeBot() {
  try {
    startTypingApi();
    startApiServer(client);
    console.log("✅ API servers initialized");

    client.antiRaid = new AntiRaidHandler(client);
    await client.antiRaid.initialize();

    setupLoggingEvents(client);

    client.giveaways = new GiveawayHandler(client);
    await client.giveaways.initialize();

    await registerSlashCommands(client);

    console.log("✅ Ticketing handler initialized");
    console.log("✅ Purge handler initialized");
    console.log("✅ Automod initialized");
    console.log("✅ Application handler initialized");
    console.log("✅ Stats tracker initialized");

    updateBotPresence();

    healthCheckInterval = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
    console.log("✅ Health monitoring started");

    await initializeGuilds();
  } catch (error) {
    handleError("initialization", error);
    process.exit(1);
  }
}

async function initializeGuilds() {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await ensureGuildRoles(guild);
      console.log(`✅ Roles initialized for guild ${guild.name}`);

      const settings = await db.getGuildSettings(guildId);

      const verificationChannel = settings.channel_ids?.verification
        ? await client.channels
          .fetch(settings.channel_ids.verification)
          .catch(() => null)
        : null;

      if (verificationChannel) {
        await setupVerificationMessage(verificationChannel);
        console.log(`✅ Verification initialized for guild ${guild.name}`);
      }

      const unverifiedRole = settings.role_ids?.unverified
        ? await guild.roles
          .fetch(settings.role_ids.unverified)
          .catch(() => null)
        : null;

      const verifiedRole = settings.role_ids?.verified
        ? await guild.roles
          .fetch(settings.role_ids.verified)
          .catch(() => null)
        : null;

      if (!unverifiedRole || !verifiedRole) {
        console.warn(
          `⚠️ Missing required roles in guild ${guild.name} (${guildId})`
        );
      }
    } catch (error) {
      handleError(`initializing guild ${guild.name} (${guildId})`, error);
    }
  }
}

async function handleButtonInteraction(interaction) {
  const handlers = {
    create_general_ticket: () => handleTicketCreate(interaction, "GENERAL"),
    create_management_ticket: () =>
      handleTicketCreate(interaction, "MANAGEMENT"),
    claim_ticket: () => handleTicketClaim(interaction),
    unclaim_ticket: () => handleTicketUnclaim(interaction),
    close_ticket: () => handleTicketClose(interaction),
    giveaway_enter: async () => {
      try {
        const giveaway = await db.getGiveawayByMessageId(
          interaction.message.id,
          interaction.guildId,
        );

        if (!giveaway) {
          await interaction.reply({
            content: "❌ This giveaway was not found",
            ephemeral: true,
          });
          return;
        }

        await client.giveaways.enterGiveaway(
          giveaway.id,
          interaction.user.id,
        );
        await interaction.reply({
          content: "✅ You have entered the giveaway!",
          ephemeral: true,
        });
      } catch (error) {
        await interaction.reply({
          content: `❌ ${error.message}`,
          ephemeral: true,
        });
      }
    },
  };

  if (interaction.customId.startsWith("role_")) {
    await handleReactionRole(interaction);
    return;
  }

  const handler = handlers[interaction.customId];
  if (handler) await handler();
}

async function handleInteraction(interaction) {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === "antiraid") {
        await handleAntiRaidCommand(interaction);
        return;
      }
      await handleSlashCommand(interaction, client);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.includes("_app_modal_")) {
        return;
      }
    }
  } catch (error) {
    handleError("handling interaction", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "An error occurred while processing your request.",
          ephemeral: true,
        })
        .catch(() => { });
    }

    client.emit("interactionError", interaction, error);
  }
}

async function startBot(retries = 5, delay = 5000) {
  validateEnvironment();
  client.once("ready", async () => {
    console.log();
    console.log(`🚀 Bot is online as ${client.user.tag}`);
    console.log(`👥 Connected to ${client.guilds.cache.size} guild(s)`);
    console.log(`🔗 Bot ID: ${client.user.id}`);
    console.log(`📅 Current time: ${new Date().toLocaleString()}`);
    console.log(`🔧 Initializing Snussy v${SNUSSY_VERSION}...`);
    console.log();

    await initializeBot();
  });

  client.on("guildMemberAdd", async (member) => {
    await client.antiRaid.handleMemberJoin(member);
    handleWelcome(member);
  });

  client.on("guildMemberRemove", handleGoodbye);
  client.on("messageReactionAdd", handleVerification);
  client.on("interactionCreate", handleInteraction);

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    await client.antiRaid.handleMessage(message);
    await handleAutomod(message);

    if (message.channel.type === 1) {
      await handleApplicationResponse(message);
      return;
    }

    try {
      await handleCommand(message, commands);
    } catch (error) {
      handleError("handling command", error);
    }
  });

  client.on("error", (error) => {
    handleError("Discord client", error);
    if (!client.isReady()) {
      console.log("🔄 Attempting to reconnect...");
      client.destroy();
      client.login(process.env.DISCORD_TOKEN);
    }
  });

  client.on("shardError", (error) => {
    handleError("WebSocket", error);
  });

  client.on("warn", (info) => {
    console.warn("⚠️ Warning:", info);
  });

  process.on("unhandledRejection", (error) => {
    handleError("unhandled promise rejection", error);
  });

  process.on("uncaughtException", (error) => {
    handleError("uncaught exception", error);
    clearInterval(healthCheckInterval);
    client.destroy();
    process.exit(1);
  });

  process.on("SIGTERM", async () => {
    console.log("🛑 Received SIGTERM signal, shutting down gracefully...");
    clearInterval(healthCheckInterval);
    await client.destroy();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("🛑 Received SIGINT signal, shutting down gracefully...");
    clearInterval(healthCheckInterval);
    await client.destroy();
    process.exit(0);
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.login(process.env.DISCORD_TOKEN);
      console.log("✅ Successfully logged in to Discord");
      return;
    } catch (error) {
      handleError(`login attempt ${i + 1}/${retries}`, error);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("❌ Maximum retry attempts reached. Exiting...");
        process.exit(1);
      }
    }
  }
}

startBot();