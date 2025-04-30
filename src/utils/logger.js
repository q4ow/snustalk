import fs from "fs";
import path from "path";
import { format } from "util";
import { config } from "../config.js";
import { LogFormatter } from "./logFormatter.js";

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const LOG_LEVELS = {
  ERROR: { value: 0, color: COLORS.red, label: "ERROR" },
  WARN: { value: 1, color: COLORS.yellow, label: "WARN" },
  INFO: { value: 2, color: COLORS.green, label: "INFO" },
  DEBUG: { value: 3, color: COLORS.cyan, label: "DEBUG" },
  TRACE: { value: 4, color: COLORS.magenta, label: "TRACE" },
};

class Logger {
  constructor(options = {}) {
    const env = process.env.NODE_ENV || "development";
    if (!config.logging[env]) {
      console.warn(`No logging configuration found for environment ${env}, falling back to development config`);
    }
    const defaultConfig = config.logging[env] || config.logging.development;

    this.options = {
      ...defaultConfig,
      ...options
    };

    this.currentLogFile = null;
    this.currentFileSize = 0;
    this.formatter = new LogFormatter({
      format: process.env.LOG_FORMAT || "text",
      includeTimestamp: true,
      includePid: true,
    });

    this.errorCache = new Set();
    this.errorCacheMaxSize = 1000;
    this.errorCacheTTL = 3600000;

    if (this.options.logToFile) {
      this.setupLogDirectory();
    }

    this.setupErrorHandlers();
  }

  setupErrorHandlers() {
    process.on("uncaughtException", (error) => {
      this.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.error("Unhandled Rejection at:", promise, "reason:", reason);
    });

    process.on("warning", (warning) => {
      this.warn(warning.name, warning.message);
      this.debug("Warning Stack:", warning.stack);
    });
  }

  setupLogDirectory() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
    this.rotateLogFiles();
  }

  rotateLogFiles() {
    const now = new Date();
    const logFile = path.join(
      this.options.logDir,
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`,
    );

    if (this.currentLogFile !== logFile) {
      this.currentLogFile = logFile;
      this.currentFileSize = fs.existsSync(logFile)
        ? fs.statSync(logFile).size
        : 0;
    }

    if (this.currentFileSize >= this.options.maxFileSize) {
      const oldFiles = fs
        .readdirSync(this.options.logDir)
        .filter((file) => file.endsWith(".log"))
        .sort()
        .reverse();

      while (oldFiles.length >= this.options.maxFiles) {
        const fileToDelete = oldFiles.pop();
        if (fileToDelete) {
          fs.unlinkSync(path.join(this.options.logDir, fileToDelete));
        }
      }

      const timestamp = now.getTime();
      const newFile = path.join(this.options.logDir, `${timestamp}.log`);
      fs.renameSync(this.currentLogFile, newFile);
      this.currentFileSize = 0;
    }
  }

  shouldLogError(error) {
    if (!error) return true;

    const errorKey = `${error.name}:${error.message}:${error.stack?.split("\n")[1] || ""}`;
    if (this.errorCache.has(errorKey)) {
      return false;
    }

    this.errorCache.add(errorKey);

    if (this.errorCache.size > this.errorCacheMaxSize) {
      this.errorCache.clear();
    }

    setTimeout(() => {
      this.errorCache.delete(errorKey);
    }, this.errorCacheTTL);

    return true;
  }

  formatError(error) {
    if (!error) return "";
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      code: error.code,
      ...(error.response
        ? {
          status: error.response.status,
          statusText: error.response.statusText,
        }
        : {}),
    };
  }

  log(level, message, ...args) {
    if (LOG_LEVELS[level].value > LOG_LEVELS[this.options.level].value) {
      return;
    }

    let data = {};
    let formattedMessage = message;

    if (args.length === 1 && args[0] instanceof Error) {
      const error = args[0];
      if (!this.shouldLogError(error)) {
        return;
      }
      data = this.formatError(error);
    } else if (args.length === 1 && typeof args[0] === "object") {
      data = args[0];
    } else if (args.length > 0) {
      formattedMessage = format(message, ...args);
    }

    const formattedLog = this.formatter.format(
      LOG_LEVELS[level].label,
      formattedMessage,
      data,
    );

    if (process.env.NODE_ENV !== "test") {
      console.log(`${LOG_LEVELS[level].color}${formattedLog}${COLORS.reset}`);
    }

    if (this.options.logToFile) {
      this.writeToFile(formattedLog);
    }
  }

  writeToFile(message) {
    if (!this.options.logToFile) return;

    this.rotateLogFiles();
    fs.appendFileSync(this.currentLogFile, message + "\n");
    this.currentFileSize += message.length + 1;
  }

  error(message, ...args) {
    this.log("ERROR", message, ...args);
  }

  warn(message, ...args) {
    this.log("WARN", message, ...args);
  }

  info(message, ...args) {
    this.log("INFO", message, ...args);
  }

  debug(message, ...args) {
    this.log("DEBUG", message, ...args);
  }

  trace(message, ...args) {
    this.log("TRACE", message, ...args);
  }

  time(label) {
    const timeKey = `timer_${label}`;
    this[timeKey] = Date.now();
  }

  timeEnd(label) {
    const timeKey = `timer_${label}`;
    const startTime = this[timeKey];
    if (startTime) {
      const duration = Date.now() - startTime;
      this.debug(`${label}: ${duration}ms`);
      delete this[timeKey];
      return duration;
    }
  }

  child(context) {
    const childLogger = new Logger(this.options);
    const parentFormatter = this.formatter;

    childLogger.formatter = {
      format(level, message, data = {}) {
        return parentFormatter.format(level, message, { ...context, ...data });
      },
    };

    return childLogger;
  }
}

const logger = new Logger();

export { Logger, logger };
