import express from "express";
import cors from "cors";
import { db } from "../utils/database.js";
import { logger } from '../utils/logger.js';
import { requestLogger, errorLogger } from '../utils/logMiddleware.js';
import { config } from '../config.js';

const app = express();

app.use(express.json());
app.use(cors(config.api.cors));

app.use(requestLogger({
  excludePaths: ['/health'],
  logBody: true,
  maskFields: ['password', 'token', 'apiKey', 'authorization', 'discord_token']
}));

async function authenticate(req, res, next) {
  const apiKey = req.headers.authorization?.replace("Bearer ", "");
  if (!apiKey) {
    return res.status(401).json({ error: "No API key provided" });
  }

  try {
    const user = await db.verifyApiKey(apiKey);
    if (!user) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

app.get("/api/user", authenticate, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    logger.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/guilds", authenticate, async (req, res) => {
  try {
    const guilds = Array.from(req.app.get("client").guilds.cache.values())
      .filter((guild) => guild.members.cache.has(req.user.discord_id))
      .map((guild) => {
        const member = guild.members.cache.get(req.user.discord_id);
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL(),
          memberCount: guild.memberCount,
          permissions: member.permissions.toArray(),
          roles: member.roles.cache.map((role) => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
          })),
        };
      });
    res.json({ guilds });
  } catch (error) {
    logger.error("Error fetching guilds:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/guilds/:guildId/settings", authenticate, async (req, res) => {
  try {
    const settings = await db.getGuildSettings(req.params.guildId);
    res.json({ settings });
  } catch (error) {
    logger.error("Error fetching guild settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/api/guilds/:guildId/settings", authenticate, async (req, res) => {
  try {
    const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
    if (
      !guild?.members.cache
        .get(req.user.discord_id)
        ?.permissions.has("Administrator")
    ) {
      return res.status(403).json({ error: "Missing required permissions" });
    }

    await db.updateGuildSettings(req.params.guildId, req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error updating guild settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/guilds/:guildId/tickets", authenticate, async (req, res) => {
  try {
    const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
    const member = guild?.members.cache.get(req.user.discord_id);
    if (!member) {
      return res.status(403).json({ error: "Not a member of this guild" });
    }

    let tickets;
    const isStaff =
      member.roles.cache.has(await db.getRoleId(guild.id, "staff")) ||
      member.roles.cache.has(await db.getRoleId(guild.id, "management"));

    if (isStaff) {
      tickets = await db.getGuildTickets(req.params.guildId);
    } else {
      tickets = await db
        .getGuildTickets(req.params.guildId)
        .then((tickets) =>
          tickets.filter((ticket) => ticket.creator_id === req.user.discord_id),
        );
    }

    res.json({ tickets });
  } catch (error) {
    logger.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get(
  "/api/guilds/:guildId/tickets/:ticketId/messages",
  authenticate,
  async (req, res) => {
    try {
      const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
      const member = guild?.members.cache.get(req.user.discord_id);
      if (!member) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      const ticket = await db.getTicketInfo(req.params.ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const isStaff =
        member.roles.cache.has(await db.getRoleId(guild.id, "staff")) ||
        member.roles.cache.has(await db.getRoleId(guild.id, "management"));

      if (!isStaff && ticket.creator_id !== req.user.discord_id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await db.getTicketMessages(req.params.ticketId);
      res.json({ messages });
    } catch (error) {
      logger.error("Error fetching ticket messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.post(
  "/api/guilds/:guildId/tickets/:ticketId/close",
  authenticate,
  async (req, res) => {
    try {
      const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
      const member = guild?.members.cache.get(req.user.discord_id);
      if (!member) {
        return res.status(403).json({ error: "Not a member of this guild" });
      }

      let ticket = await db.getTicketInfo(req.params.ticketId);
      if (!ticket) {
        const ticketByChannel = await db.getTicketInfoByChannel(
          req.params.ticketId,
        );
        if (!ticketByChannel) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        ticket = ticketByChannel;
      }

      const isStaff =
        member.roles.cache.has(await db.getRoleId(guild.id, "staff")) ||
        member.roles.cache.has(await db.getRoleId(guild.id, "management"));

      if (!isStaff && ticket.creator_id !== req.user.discord_id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.closeTicket(ticket.id, req.user.discord_id);

      const channel = await guild.channels
        .fetch(ticket.channel_id)
        .catch(() => null);
      if (channel) {
        await channel.delete().catch(logger.error);
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("Error closing ticket:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.get("/api/guilds/:guildId/automod", authenticate, async (req, res) => {
  try {
    const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
    if (
      !guild?.members.cache
        .get(req.user.discord_id)
        ?.permissions.has("ManageGuild")
    ) {
      return res.status(403).json({ error: "Missing required permissions" });
    }

    const settings = await db.getAutomodSettings(req.params.guildId);
    res.json({ settings });
  } catch (error) {
    logger.error("Error fetching automod settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/api/guilds/:guildId/automod", authenticate, async (req, res) => {
  try {
    const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
    if (
      !guild?.members.cache
        .get(req.user.discord_id)
        ?.permissions.has("ManageGuild")
    ) {
      return res.status(403).json({ error: "Missing required permissions" });
    }

    await db.saveAutomodSettings(req.params.guildId, req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error updating automod settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/guilds/:guildId/logs", authenticate, async (req, res) => {
  try {
    const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
    if (
      !guild?.members.cache
        .get(req.user.discord_id)
        ?.permissions.has("ViewAuditLog")
    ) {
      return res.status(403).json({ error: "Missing required permissions" });
    }

    const settings = await db.getLoggingSettings(req.params.guildId);
    res.json({ settings });
  } catch (error) {
    logger.error("Error fetching logging settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch(
  "/api/guilds/:guildId/logs/:logType",
  authenticate,
  async (req, res) => {
    try {
      const guild = req.app.get("client").guilds.cache.get(req.params.guildId);
      if (
        !guild?.members.cache
          .get(req.user.discord_id)
          ?.permissions.has("ManageGuild")
      ) {
        return res.status(403).json({ error: "Missing required permissions" });
      }

      await db.updateLoggingSettings(
        req.params.guildId,
        req.params.logType,
        req.body,
      );
      res.json({ success: true });
    } catch (error) {
      logger.error("Error updating logging settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.use(errorLogger);

export function startApiServer(client, port = process.env.API_PORT || 3090) {
  app.set("client", client);

  const server = app.listen(port, () => {
    logger.info(`API Server running on port ${port}`);
  });

  server.on('error', (error) => {
    logger.error('API Server error:', error);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down API server...');
    server.close(() => {
      logger.info('API Server closed');
    });
  });

  return server;
}
