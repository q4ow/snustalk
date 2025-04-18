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
  handleApplicationButton,
} from "./handlers/applicationHandler.js";
import {
  createReactionRoles,
  handleReactionRole,
} from "./handlers/reactionRolesHandler.js";
import { AntiRaidHandler } from "./handlers/antiRaid/handler.js";
import {
  antiRaidCommands,
  handleAntiRaidCommand,
} from "./handlers/antiRaid/commands.js";

dotenv.config();

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_HOST",
  "DB_PORT",
];

const SNUSSY_VERSION = process.env.VERSION || "1.1.0";

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

let healthCheckInterval;
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

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
        console.error(`❌ Error checking guild ${guildId}:`, error);
      }
    }

    client.user.setPresence({
      activities: [
        {
          name: `${client.guilds.cache.size} servers`,
          type: ActivityType.Watching,
          state: `Snussy v${SNUSSY_VERSION}`,
          url: "https://github.com/q4ow/snustalk",
        },
      ],
      status: "dnd",
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }
}

client.once("ready", async () => {
  console.log(`🚀 Bot is online as ${client.user.tag}`);
  console.log(`👥 Connected to ${client.guilds.cache.size} guild(s)`);
  console.log(`🔗 Bot ID: ${client.user.id}`);
  console.log("");
  console.log(`🔧 Initializing Snussy v${process.env.VERSION}...`);

  try {
    startTypingApi();
    startApiServer(client);

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

    client.user.setPresence({
      activities: [
        {
          name: `${client.guilds.cache.size} servers`,
          type: ActivityType.Watching,
          state: "Snussy v1.0.0",
          url: "https://github.com/q4ow/snustalk",
        },
      ],
      status: "online",
    });

    healthCheckInterval = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
    console.log("✅ Health monitoring started");

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        await ensureGuildRoles(guild);

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
            `⚠️ Missing required roles in guild ${guild.name} (${guildId})`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Error initializing guild ${guild.name} (${guildId}):`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error during initialization:", error);
    process.exit(1);
  }
});

async function setupVerificationMessage(channel) {
  if (!channel) return;

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

client.on("guildMemberAdd", async (member) => {
  await client.antiRaid.handleMemberJoin(member);
  handleWelcome(member);
});

client.on("guildMemberRemove", handleGoodbye);
client.on("messageReactionAdd", handleVerification);

client.on("interactionCreate", async (interaction) => {
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
                flags: 64,
              });
              return;
            }

            await client.giveaways.enterGiveaway(
              giveaway.id,
              interaction.user.id,
            );
            await interaction.reply({
              content: "✅ You have entered the giveaway!",
              flags: 64,
            });
          } catch (error) {
            await interaction.reply({
              content: `❌ ${error.message}`,
              flags: 64,
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
        .catch(() => {});
    }

    client.emit("interactionError", interaction, error);
  }
});

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
    console.error("❌ Error handling command:", error);
  }
});

client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
  if (!client.isReady()) {
    console.log("🔄 Attempting to reconnect...");
    client.destroy();
    client.login(process.env.DISCORD_TOKEN);
  }
});

client.on("shardError", (error) => {
  console.error("❌ WebSocket error:", error);
});

client.on("warn", (info) => {
  console.warn("⚠️ Warning:", info);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
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

async function startBot(retries = 5, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.login(process.env.DISCORD_TOKEN);
      return;
    } catch (error) {
      console.error(`❌ Failed to login (attempt ${i + 1}/${retries}):`, error);
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
