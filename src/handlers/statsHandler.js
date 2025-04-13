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
    const statsChannels = {
      members: await guild.channels.fetch(process.env.STATS_MEMBERS_CHANNEL_ID),
      bots: await guild.channels.fetch(process.env.STATS_BOTS_CHANNEL_ID),
      totalTickets: await guild.channels.fetch(
        process.env.STATS_TOTAL_TICKETS_CHANNEL_ID,
      ),
      openTickets: await guild.channels.fetch(
        process.env.STATS_OPEN_TICKETS_CHANNEL_ID,
      ),
    };

    const members = await guild.members.fetch();
    const ticketCategory = await guild.channels.fetch(
      process.env.TICKET_CATEGORY_ID,
    );
    const ticketCounter = await db.getTicketCounter(guild.id);

    const stats = {
      total: members.size,
      bots: members.filter((m) => m.user.bot).size,
      totalTickets: ticketCounter?.counter || 0,
      openTickets: ticketCategory ? ticketCategory.children.cache.size : 0,
    };

    await Promise.all([
      statsChannels.members?.setName(`👥 Members: ${stats.total}`),
      statsChannels.bots?.setName(`🤖 Bots: ${stats.bots}`),
      statsChannels.totalTickets?.setName(
        `📊 Total Tickets: ${stats.totalTickets}`,
      ),
      statsChannels.openTickets?.setName(
        `🎫 Open Tickets: ${stats.openTickets}`,
      ),
    ]);
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}
