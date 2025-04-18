import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../utils/database.js";
import { warnUser, timeoutUser } from "./moderationHandler.js";

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

const messageCache = new Map();
const spamCache = new Map();

export async function setupAutomod(guild, settings = {}) {
  const automodSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };
  await db.saveAutomodSettings(guild.id, automodSettings);
  return automodSettings;
}

async function migrateWhitelistRoles(settings) {
  const filters = ["spam", "invites", "mentions", "caps", "links", "words"];

  filters.forEach((filter) => {
    if (!settings.filters[filter].whitelistRoles) {
      settings.filters[filter].whitelistRoles = [];
    }
  });

  return settings;
}

export async function getAutomodSettings(guildId) {
  const settings = (await db.getAutomodSettings(guildId)) || DEFAULT_SETTINGS;
  return await migrateWhitelistRoles(settings);
}

export async function updateAutomodSettings(guildId, settings) {
  const currentSettings = await getAutomodSettings(guildId);
  const updatedSettings = {
    ...currentSettings,
    ...settings,
  };
  await db.saveAutomodSettings(guildId, updatedSettings);
  return updatedSettings;
}

export async function handleAutomodWhitelistRole(interaction) {
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

  return interaction.reply({
    content: `Added ${role.name} to the ${filter} filter whitelist.`,
    flags: 64,
  });
}

export async function handleAutomodUnwhitelistRole(interaction) {
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

  return interaction.reply({
    content: `Removed ${role.name} from the ${filter} filter whitelist.`,
    flags: 64,
  });
}

export async function handleAutomodListWhitelists(interaction) {
  const filter = interaction.options.getString("filter");
  const settings = await getAutomodSettings(interaction.guild.id);

  if (filter) {
    if (!settings.filters[filter]) {
      return interaction.reply({ content: "Invalid filter type.", flags: 64 });
    }

    const whitelistedRoles = settings.filters[filter].whitelistRoles || [];
    const roleNames = whitelistedRoles.map((roleId) => {
      const role = interaction.guild.roles.cache.get(roleId);
      return role ? role.name : "Unknown Role";
    });

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

  return interaction.reply({
    content: `Current whitelist settings:\n${allWhitelists}`,
    flags: 64,
  });
}

export * from "./automod/handlers.js";
