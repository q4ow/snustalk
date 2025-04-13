import fs from "fs/promises";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data");
const TICKETS_FILE = path.join(DB_PATH, "tickets.json");
const TICKET_ACTIONS_FILE = path.join(DB_PATH, "ticket_actions.json");

async function ensureDirectory() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(DB_PATH, { recursive: true });
  }
}

async function readData() {
  try {
    await ensureDirectory();
    const data = await fs.readFile(TICKETS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeData(data) {
  await ensureDirectory();
  await fs.writeFile(TICKETS_FILE, JSON.stringify(data, null, 2));
}

async function readTicketActions() {
  try {
    await ensureDirectory();
    const data = await fs.readFile(TICKET_ACTIONS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeTicketActions(data) {
  await ensureDirectory();
  await fs.writeFile(TICKET_ACTIONS_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  async saveTicketSettings(guildId, settings) {
    const data = await readData();
    data[guildId] = {
      ...data[guildId],
      ticketSettings: settings,
    };
    await writeData(data);
  },

  async getTicketSettings(guildId) {
    const data = await readData();
    return data[guildId]?.ticketSettings;
  },

  async saveTicketClaim(channelId, moderatorId) {
    const data = await readData();
    data.claims = data.claims || {};
    data.claims[channelId] = moderatorId;
    await writeData(data);
  },

  async removeTicketClaim(channelId) {
    const data = await readData();
    if (data.claims) {
      delete data.claims[channelId];
      await writeData(data);
    }
  },

  async getTicketClaim(channelId) {
    const data = await readData();
    return data.claims?.[channelId];
  },

  async addTicketAction(channelId, action) {
    const data = await readTicketActions();
    if (!data[channelId]) {
      data[channelId] = [];
    }

    data[channelId].push({
      action,
      timestamp: new Date().toLocaleString(),
    });

    await writeTicketActions(data);
  },

  async getTicketActions(channelId) {
    const data = await readTicketActions();
    return data[channelId] || [];
  },

  async clearTicketActions(channelId) {
    const data = await readTicketActions();
    if (data[channelId]) {
      delete data[channelId];
      await writeTicketActions(data);
    }
  },

  async getTicketCounter(guildId) {
    const data = await readData();
    return data[guildId]?.ticketCounter || { counter: 0 };
  },

  async updateTicketCounter(guildId, counter) {
    const data = await readData();
    data[guildId] = {
      ...data[guildId],
      ticketCounter: { counter },
    };
    await writeData(data);
  },
};
