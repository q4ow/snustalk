import { db } from "../utils/database.js";

const STATS_UPDATE_INTERVAL = 1 * 60 * 1000;
let statsInterval;

export async function startStatsTracker(guild) {
  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => updateStats(guild), STATS_UPDATE_INTERVAL);
  await updateStats(guild);
}

async function updateStats(guild) {
  try {
    const guildSettings = await db.getGuildSettings(guild.id);
    const channelIds = guildSettings.channel_ids || {};

    const statsChannels = {
      members: channelIds.stats_members ? await guild.channels.fetch(channelIds.stats_members) : null,
      bots: channelIds.stats_bots ? await guild.channels.fetch(channelIds.stats_bots) : null,
      totalTickets: channelIds.stats_total_tickets ? await guild.channels.fetch(channelIds.stats_total_tickets) : null,
      openTickets: channelIds.stats_open_tickets ? await guild.channels.fetch(channelIds.stats_open_tickets) : null,
    };

    const members = await guild.members.fetch();
    const ticketCategory = channelIds.ticket_category ? await guild.channels.fetch(channelIds.ticket_category) : null;
    const ticketCounter = await db.getTicketCounter(guild.id);

    const stats = {
      total: members.size,
      bots: members.filter((m) => m.user.bot).size,
      totalTickets: ticketCounter?.counter || 0,
      openTickets: ticketCategory ? ticketCategory.children.cache.size : 0,
    };

    if (statsChannels.members) {
      await statsChannels.members.setName(`👥 Members: ${stats.total}`);
    }
    if (statsChannels.bots) {
      await statsChannels.bots.setName(`🤖 Bots: ${stats.bots}`);
    }
    if (statsChannels.totalTickets) {
      await statsChannels.totalTickets.setName(`📊 Total Tickets: ${stats.totalTickets}`);
    }
    if (statsChannels.openTickets) {
      await statsChannels.openTickets.setName(`🎫 Open Tickets: ${stats.openTickets}`);
    }
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}
