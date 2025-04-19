import { db } from "../utils/database.js";
import { MOD_ACTIONS } from "../utils/moderation.js";

// This file is kept for backward compatibility and imports
// All moderation functionality has been moved to:
// - src/handlers/moderation/handler.js (backend functions)
// - src/handlers/moderation/commands.js (slash command handlers)

// Re-export the moderation functions from the new location
export {
  warnUser,
  removeWarning,
  kickUser,
  banUser,
  timeoutUser,
  removeTimeout,
  getUserWarnings,
  getUserModActions,
  createModActionEmbed,
} from "./moderation/handler.js";
