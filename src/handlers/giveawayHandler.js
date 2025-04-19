import { db } from "../utils/database.js";

// This file is kept for backward compatibility and imports
// All giveaway functionality has been moved to:
// - src/handlers/giveaway/handler.js (GiveawayHandler class)
// - src/handlers/giveaway/commands.js (slash command handlers)

// Re-export the GiveawayHandler class from the new location
export { GiveawayHandler } from "./giveaway/handler.js";
