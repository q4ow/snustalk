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
import { handleApplicationResponse } from "./handlers/applicationHandler.js";
import { handleReactionRole } from "./handlers/reactionRolesHandler.js";
import { AntiRaidHandler } from "./handlers/antiRaid/handler.js";
import { handleAntiRaidCommand } from "./handlers/antiRaid/commands.js";
import { startStatsTracker } from "./handlers/statsHandler.js";

dotenv.config();

const SNUSSY_VERSION = process.env.VERSION || "1.1.0";
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_HOST",
  "DB_PORT",
];

class SnusTalkBot {
  constructor() {
    this.client = new Client({
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
    this.healthCheckInterval = null;
    this.version = SNUSSY_VERSION || "1.2.3";
  }

  handleError(context, error) {
    console.error(`❌ Error in ${context}:`, error);
    return error;
  }

  validateEnvironment() {
    const missingVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`,
      );
    }

    console.log("✅ Environment variables validated");
  }

  updateBotPresence() {
    this.client.user.setPresence({
      activities: [
        {
          name: `${this.client.guilds.cache.size} servers`,
          type: ActivityType.Watching,
          state: `Snussy v${this.version}`,
        },
      ],
      status: "dnd",
    });
  }

  async runHealthCheck() {
    try {
      const dbHealthy = await db.healthCheck();
      if (!dbHealthy) {
        console.error("❌ Database health check failed");
        process.exit(1);
      }

      if (!this.client.isReady()) {
        console.error("❌ Bot is not ready, attempting to reconnect...");
        await this.client.destroy();
        await this.client.login(process.env.DISCORD_TOKEN);
      }

      for (const [guildId, guild] of this.client.guilds.cache) {
        try {
          if (!guild.available) {
            console.warn(`⚠️ Guild ${guildId} is unavailable`);
            continue;
          }

          const botMember = await guild.members.fetch(this.client.user.id);
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
          this.handleError(`checking guild ${guildId}`, error);
        }
      }

      this.updateBotPresence();
    } catch (error) {
      this.handleError("health check", error);
    }
  }

  async setupVerificationMessage(channel) {
    if (!channel) return;

    try {
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingVerification = messages.find(
        (msg) =>
          msg.author.id === this.client.user.id &&
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
      this.handleError("setting up verification message", error);
    }
  }

  async initializeBot() {
    try {
      startTypingApi();
      startApiServer(this.client);
      console.log("✅ API servers initialized");

      this.client.antiRaid = new AntiRaidHandler(this.client);
      await this.client.antiRaid.initialize();

      setupLoggingEvents(this.client);

      this.client.giveaways = new GiveawayHandler(this.client);
      await this.client.giveaways.initialize();

      await registerSlashCommands(this.client);

      console.log("✅ Ticketing handler initialized");
      console.log("✅ Purge handler initialized");
      console.log("✅ Automod initialized");
      console.log("✅ Application handler initialized");
      console.log("✅ Stats tracker initialized");

      for (const guild of this.client.guilds.cache.values()) {
        await startStatsTracker(guild);
      }

      this.updateBotPresence();

      this.healthCheckInterval = setInterval(
        () => this.runHealthCheck(),
        HEALTH_CHECK_INTERVAL,
      );
      console.log("✅ Health monitoring started");

      await this.initializeGuilds();
    } catch (error) {
      this.handleError("initialization", error);
      process.exit(1);
    }
  }

  async initializeGuilds() {
    for (const [guildId, guild] of this.client.guilds.cache) {
      try {
        await ensureGuildRoles(guild);
        console.log(`✅ Roles initialized for guild ${guild.name}`);

        const settings = await db.getGuildSettings(guildId);

        const verificationChannel = settings.channel_ids?.verification
          ? await this.client.channels
              .fetch(settings.channel_ids.verification)
              .catch(() => null)
          : null;

        if (verificationChannel) {
          await this.setupVerificationMessage(verificationChannel);
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
        this.handleError(
          `initializing guild ${guild.name} (${guildId})`,
          error,
        );
      }
    }
  }

  async handleButtonInteraction(interaction) {
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

          await this.client.giveaways.enterGiveaway(
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

    if (
      interaction.customId.startsWith("accept_app_") ||
      interaction.customId.startsWith("deny_app_")
    ) {
      const { handleApplicationButton } = await import(
        "./handlers/application/handler.js"
      );
      await handleApplicationButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("role_")) {
      await handleReactionRole(interaction);
      return;
    }

    const handler = handlers[interaction.customId];
    if (handler) await handler();
  }

  async handleInteraction(interaction) {
    try {
      if (interaction.isCommand()) {
        if (interaction.commandName === "antiraid") {
          await handleAntiRaidCommand(interaction);
          return;
        }
        await handleSlashCommand(interaction, this.client);
        return;
      }

      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.includes("_app_modal_")) {
          const [actionPart, userIdPart] =
            interaction.customId.split("_modal_");
          const action = actionPart.split("_")[0];
          const userId = userIdPart;
          const reason = interaction.fields.getTextInputValue("reason");

          try {
            const guild = interaction.guild;
            const user = await guild.client.users
              .fetch(userId)
              .catch((error) => {
                console.error(`Failed to fetch user ${userId}:`, error);
                return null;
              });

            if (!user) {
              await interaction.reply({
                content: "Could not find the user. They may have left Discord.",
                flags: 64,
              });
              return;
            }

            const member = await guild.members.fetch(userId).catch((error) => {
              console.error(`Failed to fetch member ${userId}:`, error);
              return null;
            });

            if (action === "accept" && member) {
              try {
                const moderatorRoleId = await db.getRoleId(
                  guild.id,
                  "moderator",
                );
                if (moderatorRoleId) {
                  const moderatorRole =
                    await guild.roles.fetch(moderatorRoleId);
                  if (moderatorRole) {
                    await member.roles.add(moderatorRole);
                    console.log(`Added moderator role to ${member.user.tag}`);
                  }
                }
              } catch (error) {
                console.error(
                  `Failed to add moderator role to member ${userId}:`,
                  error,
                );
              }
            }

            const responseEmbed = new EmbedBuilder()
              .setTitle(
                `Application ${action === "accept" ? "Accepted ✅" : "Denied ❌"}`,
              )
              .setDescription(
                `Your application has been ${action === "accept" ? "accepted" : "denied"} by ${interaction.user.tag}`,
              )
              .addFields(
                { name: "Reason", value: reason, inline: false },
                {
                  name: "Decision Time",
                  value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                  inline: true,
                },
                {
                  name: "Staff Member",
                  value: interaction.user.tag,
                  inline: true,
                },
              )
              .setColor(action === "accept" ? "#00FF00" : "#FF0000")
              .setFooter({
                text: interaction.guild.name,
                iconURL: interaction.guild.iconURL(),
              })
              .setTimestamp();

            if (action === "accept") {
              responseEmbed.addFields({
                name: "Next Steps",
                value:
                  "You will be given the Moderator role shortly. Please make sure to familiarize yourself with the staff guidelines and channels.",
                inline: false,
              });
            }

            await user.send({ embeds: [responseEmbed] }).catch(() => {
              console.log(`Failed to DM user ${user.tag}`);
            });

            await interaction.message
              .edit({ components: [] })
              .catch((error) => {
                console.error("Failed to edit original message:", error);
              });

            const logEmbed = new EmbedBuilder()
              .setTitle(
                `Application ${action === "accept" ? "Accepted" : "Denied"}`,
              )
              .setDescription(
                `**Staff Member:** ${interaction.user.tag}\n**Reason:** ${reason}`,
              )
              .setColor(action === "accept" ? "#00FF00" : "#FF0000")
              .setTimestamp();

            await interaction.message
              .reply({ embeds: [logEmbed] })
              .catch((error) => {
                console.error("Failed to reply to original message:", error);
              });

            await interaction.reply({
              content: `Application ${action === "accept" ? "accepted" : "denied"} successfully.`,
              flags: 64,
            });
          } catch (error) {
            console.error("Error processing application modal:", error);
            await interaction
              .reply({
                content:
                  "There was an error processing the application. Please try again.",
                flags: 64,
              })
              .catch(console.error);
          }

          return;
        }
      }
    } catch (error) {
      this.handleError("handling interaction", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "An error occurred while processing your request.",
            flags: 64,
          })
          .catch(() => {});
      }

      this.client.emit("interactionError", interaction, error);
    }
  }

  setupEventHandlers() {
    this.client.on("guildMemberAdd", async (member) => {
      await this.client.antiRaid.handleMemberJoin(member);
      handleWelcome(member);

      if (member.guild.available) {
        await startStatsTracker(member.guild);
      }
    });

    this.client.on("guildMemberRemove", async (member) => {
      handleGoodbye(member);

      if (member.guild.available) {
        await startStatsTracker(member.guild);
      }
    });

    this.client.on("presenceUpdate", async (newPresence) => {
      if (newPresence && newPresence.guild && newPresence.guild.available) {
        try {
          const guildSettings = await db.getGuildSettings(newPresence.guild.id);
          if (guildSettings.channel_ids?.stats_online_members) {
            await startStatsTracker(newPresence.guild);
          }
        } catch (error) {
          this.handleError("updating online stats on presence change", error);
        }
      }
    });

    this.client.on("messageReactionAdd", handleVerification);

    this.client.on("interactionCreate", (interaction) =>
      this.handleInteraction(interaction),
    );

    this.client.on("messageCreate", async (message) => {
      if (message.author.bot) return;

      await this.client.antiRaid.handleMessage(message);
      await handleAutomod(message);

      if (message.channel.type === 1) {
        await handleApplicationResponse(message);
        return;
      }

      try {
        await handleCommand(message, commands);
      } catch (error) {
        this.handleError("handling command", error);
      }
    });

    this.client.on("error", (error) => {
      this.handleError("Discord client", error);
      if (!this.client.isReady()) {
        console.log("🔄 Attempting to reconnect...");
        this.client.destroy();
        this.client.login(process.env.DISCORD_TOKEN);
      }
    });

    this.client.on("shardError", (error) => {
      this.handleError("WebSocket", error);
    });

    this.client.on("warn", (info) => {
      console.warn("⚠️ Warning:", info);
    });

    process.on("unhandledRejection", (error) => {
      this.handleError("unhandled promise rejection", error);
    });

    process.on("uncaughtException", (error) => {
      this.handleError("uncaught exception", error);
      clearInterval(this.healthCheckInterval);
      this.client.destroy();
      process.exit(1);
    });

    process.on("SIGTERM", async () => {
      console.log("🛑 Received SIGTERM signal, shutting down gracefully...");
      clearInterval(this.healthCheckInterval);
      await this.client.destroy();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("🛑 Received SIGINT signal, shutting down gracefully...");
      clearInterval(this.healthCheckInterval);
      await this.client.destroy();
      process.exit(0);
    });
  }

  async start(retries = 5, delay = 5000) {
    this.validateEnvironment();
    this.setupEventHandlers();

    this.client.once("ready", async () => {
      console.log();
      console.log(`🚀 Bot is online as ${this.client.user.tag}`);
      console.log(`👥 Connected to ${this.client.guilds.cache.size} guild(s)`);
      console.log(`🔗 Bot ID: ${this.client.user.id}`);
      console.log(`📅 Current time: ${new Date().toLocaleString()}`);
      console.log(`🔧 Initializing Snussy v${this.version}...`);
      console.log();

      await this.initializeBot();
    });

    for (let i = 0; i < retries; i++) {
      try {
        await this.client.login(process.env.DISCORD_TOKEN);
        console.log("✅ Successfully logged in to Discord");
        return;
      } catch (error) {
        this.handleError(`login attempt ${i + 1}/${retries}`, error);
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
}

const snusTalk = new SnusTalkBot();
snusTalk.start();
