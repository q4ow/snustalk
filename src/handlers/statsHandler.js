import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";

const CONFIG = {
  UPDATE_INTERVAL: 1 * 60 * 1000,
  CHANNEL_PREFIXES: {
    members: "👥 Members: ",
    bots: "🤖 Bots: ",
    totalTickets: "📊 Total Tickets: ",
    openTickets: "🎫 Open Tickets: ",
    onlineMembers: "🟢 Online: ",
    roles: "✨ Roles: ",
  },
  MAX_RENAME_PER_CYCLE: 2,
  STAGGER_DELAY: 2000,
};

const activeIntervals = new Map();

export async function startStatsTracker(guild) {
  try {
    if (activeIntervals.has(guild.id)) {
      clearInterval(activeIntervals.get(guild.id));
      logger.debug(`Cleared existing stats tracker for guild ${guild.name}`);
    }

    const interval = setInterval(
      () => updateGuildStats(guild),
      CONFIG.UPDATE_INTERVAL,
    );
    activeIntervals.set(guild.id, interval);
    logger.info(`Started stats tracker for guild ${guild.name}`);

    await updateGuildStats(guild);
  } catch (error) {
    logger.error(
      `Failed to start stats tracker for guild ${guild.name}:`,
      error,
    );
    throw error;
  }
}

export function stopStatsTracker(guildId) {
  try {
    if (activeIntervals.has(guildId)) {
      clearInterval(activeIntervals.get(guildId));
      activeIntervals.delete(guildId);
      logger.info(`Stopped stats tracker for guild ${guildId}`);
    }
  } catch (error) {
    logger.error(`Failed to stop stats tracker for guild ${guildId}:`, error);
  }
}

async function fetchStatsChannels(guild, channelIds) {
  try {
    const statsChannels = {};

    const channelMappings = {
      stats_members: "members",
      stats_bots: "bots",
      stats_total_tickets: "totalTickets",
      stats_open_tickets: "openTickets",
      stats_online_members: "onlineMembers",
      stats_roles: "roles",
    };

    await Promise.all(
      Object.entries(channelMappings).map(async ([settingKey, propName]) => {
        if (channelIds[settingKey]) {
          try {
            statsChannels[propName] = await guild.channels.fetch(
              channelIds[settingKey],
            );
            logger.debug(`Fetched ${propName} stats channel for ${guild.name}`);
          } catch (error) {
            logger.warn(
              `Could not fetch ${propName} stats channel (${channelIds[settingKey]}) in ${guild.name}:`,
              error,
            );
            statsChannels[propName] = null;
          }
        } else {
          statsChannels[propName] = null;
        }
      }),
    );

    return statsChannels;
  } catch (error) {
    logger.error(
      `Failed to fetch stats channels for guild ${guild.name}:`,
      error,
    );
    throw error;
  }
}

async function calculateGuildStats(guild) {
  try {
    const guildSettings = await db.getGuildSettings(guild.id);
    const channelIds = guildSettings.channel_ids || {};

    const members = await guild.members.fetch();
    const ticketCategory = channelIds.ticket_category
      ? await guild.channels
          .fetch(channelIds.ticket_category)
          .catch((error) => {
            logger.warn(
              `Could not fetch ticket category in ${guild.name}:`,
              error,
            );
            return null;
          })
      : null;
    const ticketCounter = await db.getTicketCounter(guild.id);

    const humanMembers = members.filter((m) => !m.user.bot);
    const botMembers = members.filter((m) => m.user.bot);
    const onlineMembers = humanMembers.filter(
      (m) =>
        m.presence?.status === "online" ||
        m.presence?.status === "idle" ||
        m.presence?.status === "dnd",
    );

    logger.debug(`Calculated stats for guild ${guild.name}:`, {
      members: humanMembers.size,
      bots: botMembers.size,
      tickets: ticketCounter?.counter || 0,
      openTickets: ticketCategory?.children.cache.size || 0,
      online: onlineMembers.size,
      roles: guild.roles.cache.size - 1,
    });

    return {
      total: humanMembers.size,
      bots: botMembers.size,
      totalTickets: ticketCounter?.counter || 0,
      openTickets: ticketCategory ? ticketCategory.children.cache.size : 0,
      onlineMembers: onlineMembers.size,
      roles: guild.roles.cache.size - 1,
    };
  } catch (error) {
    logger.error(`Failed to calculate guild stats for ${guild.name}:`, error);
    throw error;
  }
}

async function updateChannelNames(statsChannels, stats) {
  try {
    const updateQueue = [];

    if (statsChannels.members && stats.total !== undefined) {
      updateQueue.push({
        channel: statsChannels.members,
        newName: `${CONFIG.CHANNEL_PREFIXES.members}${stats.total}`,
        currentName: statsChannels.members.name,
      });
    }

    if (statsChannels.bots && stats.bots !== undefined) {
      updateQueue.push({
        channel: statsChannels.bots,
        newName: `${CONFIG.CHANNEL_PREFIXES.bots}${stats.bots}`,
        currentName: statsChannels.bots.name,
      });
    }

    if (statsChannels.totalTickets && stats.totalTickets !== undefined) {
      updateQueue.push({
        channel: statsChannels.totalTickets,
        newName: `${CONFIG.CHANNEL_PREFIXES.totalTickets}${stats.totalTickets}`,
        currentName: statsChannels.totalTickets.name,
      });
    }

    if (statsChannels.openTickets && stats.openTickets !== undefined) {
      updateQueue.push({
        channel: statsChannels.openTickets,
        newName: `${CONFIG.CHANNEL_PREFIXES.openTickets}${stats.openTickets}`,
        currentName: statsChannels.openTickets.name,
      });
    }

    if (statsChannels.onlineMembers && stats.onlineMembers !== undefined) {
      updateQueue.push({
        channel: statsChannels.onlineMembers,
        newName: `${CONFIG.CHANNEL_PREFIXES.onlineMembers}${stats.onlineMembers}`,
        currentName: statsChannels.onlineMembers.name,
      });
    }

    if (statsChannels.roles && stats.roles !== undefined) {
      updateQueue.push({
        channel: statsChannels.roles,
        newName: `${CONFIG.CHANNEL_PREFIXES.roles}${stats.roles}`,
        currentName: statsChannels.roles.name,
      });
    }

    for (let i = 0; i < updateQueue.length; i++) {
      const { channel, newName, currentName } = updateQueue[i];

      if (currentName === newName) {
        logger.debug(`Skipping update for ${channel.name}, name unchanged`);
        continue;
      }

      try {
        await channel.setName(newName);
        logger.debug(`Updated channel name: ${currentName} -> ${newName}`);

        if (i < updateQueue.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.STAGGER_DELAY),
          );
        }
      } catch (error) {
        logger.error(
          `Failed to update channel name ${currentName} -> ${newName}:`,
          error,
        );
      }
    }
  } catch (error) {
    logger.error("Failed to update channel names:", error);
    throw error;
  }
}

async function updateGuildStats(guild) {
  try {
    if (!guild.available) {
      logger.warn(`Guild ${guild.id} is unavailable, skipping stats update`);
      return;
    }

    const guildSettings = await db.getGuildSettings(guild.id);
    const channelIds = guildSettings.channel_ids || {};

    const hasStatsChannels = Object.keys(channelIds).some(
      (key) => key.startsWith("stats_") && channelIds[key],
    );

    if (!hasStatsChannels) {
      logger.debug(`No stats channels configured for guild ${guild.name}`);
      return;
    }

    const statsChannels = await fetchStatsChannels(guild, channelIds);
    const stats = await calculateGuildStats(guild);

    stats.guildName = guild.name;
    logger.debug(`Updating stats channels for guild ${guild.name}`);

    await updateChannelNames(statsChannels, stats);
    logger.info(`Successfully updated stats for guild ${guild.name}`);
  } catch (error) {
    logger.error(`Failed to update stats for guild ${guild.name}:`, error);
  }
}
