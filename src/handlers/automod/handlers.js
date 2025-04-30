import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../../utils/database.js";
import { warnUser, timeoutUser } from "../moderationHandler.js";
import { logger } from "../../utils/logger.js";

const DEFAULT_SETTINGS = {
  enabled: false,
  filters: {
    spam: {
      enabled: true,
      maxMessages: 5,
      timeWindow: 5000,
      action: "timeout",
      duration: 300000,
      whitelistRoles: [],
    },
    invites: {
      enabled: true,
      action: "delete",
      whitelist: [],
      whitelistRoles: [],
    },
    mentions: {
      enabled: true,
      maxMentions: 3,
      action: "warn",
      whitelistRoles: [],
    },
    caps: {
      enabled: true,
      percentage: 70,
      minLength: 10,
      action: "delete",
      whitelistRoles: [],
    },
    links: {
      enabled: true,
      action: "delete",
      whitelist: [],
      whitelistRoles: [],
    },
    words: {
      enabled: true,
      action: "delete",
      blacklist: [],
      whitelistRoles: [],
    },
  },
  exemptRoles: ["1352272188262318212", "1351231148000411658"],
  exemptChannels: [],
  logChannel: null,
};

const spamCache = new Map();

export async function setupAutomod(guild, settings = {}) {
  try {
    const automodSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
    await db.saveAutomodSettings(guild.id, automodSettings);
    logger.info(`Automod settings initialized for guild ${guild.name}`);
    return automodSettings;
  } catch (error) {
    logger.error(`Error setting up automod for guild ${guild.name}:`, error);
    throw error;
  }
}

async function migrateWhitelistRoles(settings) {
  try {
    const filters = ["spam", "invites", "mentions", "caps", "links", "words"];

    filters.forEach((filter) => {
      if (!settings.filters[filter].whitelistRoles) {
        settings.filters[filter].whitelistRoles = [];
      }
    });

    return settings;
  } catch (error) {
    logger.error("Error migrating whitelist roles:", error);
    throw error;
  }
}

export async function getAutomodSettings(guildId) {
  try {
    const settings = await db.getAutomodSettings(guildId);
    if (!settings || !settings.filters) {
      logger.debug(`Using default automod settings for guild ${guildId}`);
      return DEFAULT_SETTINGS;
    }

    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      filters: {
        ...DEFAULT_SETTINGS.filters,
        ...settings.filters,
      },
    };

    Object.keys(DEFAULT_SETTINGS.filters).forEach((filterName) => {
      mergedSettings.filters[filterName] = {
        ...DEFAULT_SETTINGS.filters[filterName],
        ...mergedSettings.filters[filterName],
      };
    });

    return await migrateWhitelistRoles(mergedSettings);
  } catch (error) {
    logger.error(`Error getting automod settings for guild ${guildId}:`, error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateAutomodSettings(guildId, settings) {
  try {
    const currentSettings = await getAutomodSettings(guildId);
    const updatedSettings = {
      ...currentSettings,
      ...settings,
    };
    await db.saveAutomodSettings(guildId, updatedSettings);
    logger.info(`Updated automod settings for guild ${guildId}`);
    return updatedSettings;
  } catch (error) {
    logger.error(
      `Error updating automod settings for guild ${guildId}:`,
      error,
    );
    throw error;
  }
}

async function isExempt(message, filterType = null) {
  try {
    const settings = await getAutomodSettings(message.guild.id);

    if (
      settings.exemptRoles.some((roleId) =>
        message.member.roles.cache.has(roleId),
      )
    ) {
      return true;
    }

    if (settings.exemptChannels.includes(message.channel.id)) {
      return true;
    }

    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return true;
    }

    if (filterType && settings.filters[filterType]) {
      const filterSettings = settings.filters[filterType];
      if (
        filterSettings.whitelistRoles &&
        filterSettings.whitelistRoles.some((roleId) =>
          message.member.roles.cache.has(roleId),
        )
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(`Error checking exemption for message ${message.id}:`, error);
    return false;
  }
}

async function handleViolation(message, type, action, duration = null) {
  try {
    const settings = await getAutomodSettings(message.guild.id);

    const logEmbed = new EmbedBuilder()
      .setTitle("🛡️ AutoMod Action")
      .setColor("#FF0000")
      .setDescription(`Auto-moderation action taken in ${message.channel}`)
      .addFields(
        {
          name: "User",
          value: `${message.author} (${message.author.id})`,
          inline: true,
        },
        { name: "Violation", value: type, inline: true },
        { name: "Action", value: action, inline: true },
        { name: "Content", value: message.content || "[No content]" },
      )
      .setTimestamp();

    switch (action) {
      case "delete":
        try {
          await message.delete();
          logger.info(`Deleted message ${message.id} for ${type} violation`);
        } catch (error) {
          logger.error(`Failed to delete message ${message.id}:`, error);
        }
        break;
      case "warn":
        await warnUser(
          message.guild,
          message.client.user,
          message.member,
          `[AutoMod] ${type} violation`,
        );
        logger.info(`Warned user ${message.author.tag} for ${type} violation`);
        break;
      case "timeout":
        await timeoutUser(
          message.guild,
          message.client.user,
          message.member,
          duration || 300000,
          `[AutoMod] ${type} violation`,
        );
        logger.info(
          `Timed out user ${message.author.tag} for ${type} violation`,
        );
        break;
    }

    if (settings.logChannel) {
      try {
        const logChannel = await message.guild.channels.fetch(
          settings.logChannel,
        );
        if (logChannel) {
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (error) {
        logger.error(`Failed to log violation to channel:`, error);
      }
    }
  } catch (error) {
    logger.error(`Error handling violation for message ${message.id}:`, error);
  }
}

async function checkSpam(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (!settings.filters.spam.enabled) return false;
  if (await isExempt(message, "spam")) return false;

  const { maxMessages, timeWindow } = settings.filters.spam;
  const key = `${message.author.id}-${message.channel.id}`;
  const now = Date.now();

  if (!spamCache.has(key)) {
    spamCache.set(key, []);
  }

  const userMessages = spamCache.get(key);
  const recentMessages = userMessages.filter(
    (timestamp) => now - timestamp < timeWindow,
  );
  recentMessages.push(now);
  spamCache.set(key, recentMessages);

  if (recentMessages.length >= maxMessages) {
    await handleViolation(
      message,
      "Spam",
      settings.filters.spam.action,
      settings.filters.spam.duration,
    );
    spamCache.delete(key);
    return true;
  }

  return false;
}

async function checkMentions(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (!settings.filters.mentions.enabled) return false;
  if (await isExempt(message, "mentions")) return false;

  const mentions = message.mentions.users.size + message.mentions.roles.size;
  if (mentions > settings.filters.mentions.maxMentions) {
    await handleViolation(
      message,
      "Mass Mentions",
      settings.filters.mentions.action,
    );
    return true;
  }

  return false;
}

async function checkCaps(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (
    !settings.filters.caps.enabled ||
    message.content.length < settings.filters.caps.minLength
  )
    return false;
  if (await isExempt(message, "caps")) return false;

  const upperCount = message.content.replace(/[^A-Z]/g, "").length;
  const totalCount = message.content.replace(/[^A-Za-z]/g, "").length;
  const percentage = (upperCount / totalCount) * 100;

  if (percentage >= settings.filters.caps.percentage) {
    await handleViolation(
      message,
      "Excessive Caps",
      settings.filters.caps.action,
    );
    return true;
  }

  return false;
}

async function checkLinks(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (!settings.filters.links.enabled) return false;
  if (await isExempt(message, "links")) return false;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = message.content.match(urlRegex);

  if (links) {
    const containsBlockedLink = links.some((link) => {
      return !settings.filters.links.whitelist.some((allowed) =>
        link.includes(allowed),
      );
    });

    if (containsBlockedLink) {
      await handleViolation(
        message,
        "Unauthorized Links",
        settings.filters.links.action,
      );
      return true;
    }
  }

  return false;
}

async function checkInvites(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (!settings.filters.invites.enabled) return false;
  if (await isExempt(message, "invites")) return false;

  const inviteRegex =
    /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[^\s]+/g;
  const invites = message.content.match(inviteRegex);

  if (invites) {
    await handleViolation(
      message,
      "Discord Invites",
      settings.filters.invites.action,
    );
    return true;
  }

  return false;
}

async function checkWords(message) {
  const settings = await getAutomodSettings(message.guild.id);
  if (!settings.filters.words.enabled) return false;
  if (await isExempt(message, "words")) return false;

  const containsBlacklisted = settings.filters.words.blacklist.some((word) =>
    message.content.toLowerCase().includes(word.toLowerCase()),
  );

  if (containsBlacklisted) {
    await handleViolation(
      message,
      "Prohibited Words",
      settings.filters.words.action,
    );
    return true;
  }

  return false;
}

export async function handleMessage(message) {
  try {
    if (!message.guild || message.author.bot) return;

    const settings = await getAutomodSettings(message.guild.id);
    if (!settings.enabled) return;

    if (await isExempt(message)) return;

    const checks = [
      checkSpam,
      checkMentions,
      checkCaps,
      checkLinks,
      checkInvites,
      checkWords,
    ];

    for (const check of checks) {
      if (await check(message)) break;
    }
  } catch (error) {
    logger.error(`Error handling message ${message.id}:`, error);
  }
}

export async function handleAutomodWhitelistRole(interaction) {
  try {
    const filter = interaction.options.getString("filter");
    const role = interaction.options.getRole("role");
    const settings = await getAutomodSettings(interaction.guild.id);

    if (!settings.filters[filter]) {
      return interaction.reply({ content: "Invalid filter type.", flags: 64 });
    }

    if (!settings.filters[filter].whitelistRoles) {
      settings.filters[filter].whitelistRoles = [];
    }

    if (settings.filters[filter].whitelistRoles.includes(role.id)) {
      return interaction.reply({
        content: `Role ${role.name} is already whitelisted for the ${filter} filter.`,
        flags: 64,
      });
    }

    settings.filters[filter].whitelistRoles.push(role.id);
    await updateAutomodSettings(interaction.guild.id, settings);
    logger.info(
      `Added role ${role.name} to ${filter} filter whitelist in ${interaction.guild.name}`,
    );

    return interaction.reply({
      content: `Added ${role.name} to the ${filter} filter whitelist.`,
      flags: 64,
    });
  } catch (error) {
    logger.error(`Error handling whitelist role command:`, error);
    return interaction.reply({
      content: "An error occurred while processing the command.",
      flags: 64,
    });
  }
}

export async function handleAutomodUnwhitelistRole(interaction) {
  try {
    const filter = interaction.options.getString("filter");
    const role = interaction.options.getRole("role");
    const settings = await getAutomodSettings(interaction.guild.id);

    if (!settings.filters[filter]) {
      return interaction.reply({ content: "Invalid filter type.", flags: 64 });
    }

    if (!settings.filters[filter].whitelistRoles) {
      return interaction.reply({
        content: `No whitelisted roles found for the ${filter} filter.`,
        flags: 64,
      });
    }

    const index = settings.filters[filter].whitelistRoles.indexOf(role.id);
    if (index === -1) {
      return interaction.reply({
        content: `Role ${role.name} is not whitelisted for the ${filter} filter.`,
        flags: 64,
      });
    }

    settings.filters[filter].whitelistRoles.splice(index, 1);
    await updateAutomodSettings(interaction.guild.id, settings);
    logger.info(
      `Removed role ${role.name} from ${filter} filter whitelist in ${interaction.guild.name}`,
    );

    return interaction.reply({
      content: `Removed ${role.name} from the ${filter} filter whitelist.`,
      flags: 64,
    });
  } catch (error) {
    logger.error(`Error handling unwhitelist role command:`, error);
    return interaction.reply({
      content: "An error occurred while processing the command.",
      flags: 64,
    });
  }
}

export async function handleAutomodListWhitelists(interaction) {
  try {
    const filter = interaction.options.getString("filter");
    const settings = await getAutomodSettings(interaction.guild.id);

    if (filter) {
      if (!settings.filters[filter]) {
        return interaction.reply({
          content: "Invalid filter type.",
          flags: 64,
        });
      }

      const whitelistedRoles = settings.filters[filter].whitelistRoles || [];
      const roleNames = whitelistedRoles.map((roleId) => {
        const role = interaction.guild.roles.cache.get(roleId);
        return role ? role.name : "Unknown Role";
      });

      logger.info(
        `Listed whitelist for ${filter} filter in ${interaction.guild.name}`,
      );
      return interaction.reply({
        content: `Whitelisted roles for ${filter} filter:\n${roleNames.length ? roleNames.join("\n") : "No roles whitelisted"}`,
        flags: 64,
      });
    }

    const allWhitelists = Object.entries(settings.filters)
      .map(([filterName, filterSettings]) => {
        const whitelistedRoles = filterSettings.whitelistRoles || [];
        const roleNames = whitelistedRoles.map((roleId) => {
          const role = interaction.guild.roles.cache.get(roleId);
          return role ? role.name : "Unknown Role";
        });
        return `${filterName}: ${roleNames.length ? roleNames.join(", ") : "None"}`;
      })
      .join("\n");

    logger.info(`Listed all whitelists in ${interaction.guild.name}`);
    return interaction.reply({
      content: `Current whitelist settings:\n${allWhitelists}`,
      flags: 64,
    });
  } catch (error) {
    logger.error(`Error handling list whitelists command:`, error);
    return interaction.reply({
      content: "An error occurred while processing the command.",
      flags: 64,
    });
  }
}
