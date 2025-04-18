import { setTimeout } from "timers/promises";

export class RequestError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "RequestError";
  }
}

export async function fetchWithRetry(
  url,
  options = {},
  maxRetries = 3,
  initialDelay = 1000,
) {
  let lastError;
  let delay = initialDelay;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "User-Agent": "Discord-Bot",
        },
      });

      if (!response.ok) {
        throw new RequestError(
          `HTTP error ${response.status}: ${response.statusText}`,
          "HTTP_ERROR",
          response.status,
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      if (error.status === 404 || error.status === 403) {
        throw error;
      }

      if (!error.status || error.status >= 500) {
        if (i < maxRetries - 1) {
          console.warn(`Request failed, retrying in ${delay}ms...`, error);
          await setTimeout(delay);
          delay *= 2;
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}
