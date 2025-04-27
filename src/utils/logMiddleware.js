import { logger } from "./logger.js";

export function requestLogger(options = {}) {
  const {
    excludePaths = [],
    logBody = false,
    logQuery = true,
    maskFields = ["password", "token", "apiKey", "authorization"],
  } = options;

  return (req, res, next) => {
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    const maskValue = (obj, fields) => {
      const masked = { ...obj };
      fields.forEach((field) => {
        if (masked[field]) {
          masked[field] = "********";
        }
      });
      return masked;
    };

    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };

    if (logQuery && Object.keys(req.query).length > 0) {
      logData.query = maskValue(req.query, maskFields);
    }

    if (logBody && req.body && Object.keys(req.body).length > 0) {
      logData.body = maskValue(req.body, maskFields);
    }

    logger.info(`API Request ${requestId}`, logData);

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);

      const responseTime = Date.now() - startTime;
      const responseData = {
        requestId,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      };

      if (res.statusCode >= 500) {
        logger.error(`API Response ${requestId}`, responseData);
      } else if (res.statusCode >= 400) {
        logger.warn(`API Response ${requestId}`, responseData);
      } else {
        logger.debug(`API Response ${requestId}`, responseData);
      }
    };

    next();
  };
}

export function errorLogger(err, req, res, next) {
  const errorData = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: err.status || 500,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  };

  logger.error("API Error", errorData);
  next(err);
}
