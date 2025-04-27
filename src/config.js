export const config = {
  logging: {
    development: {
      level: "DEBUG",
      logToFile: true,
      logDir: "logs/dev",
      maxFiles: 5,
      maxFileSize: 10 * 1024 * 1024,
    },
    production: {
      level: "INFO",
      logToFile: true,
      logDir: "logs/prod",
      maxFiles: 10,
      maxFileSize: 50 * 1024 * 1024,
    },
    test: {
      level: "TRACE",
      logToFile: false,
    },
  },

  bot: {
    defaultPrefix: "$",
    retryAttempts: 5,
    retryDelay: 5000,
    healthCheckInterval: 5 * 60 * 1000,
    cacheSettings: {
      messages: 100,
      presences: 10,
    },
    sweepers: {
      messages: {
        interval: 300,
        lifetime: 1800,
      },
      presences: {
        interval: 600,
      },
    },
  },

  database: {
    poolMin: 2,
    poolMax: 10,
    idleTimeoutMillis: 30000,
  },

  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
  },
};
