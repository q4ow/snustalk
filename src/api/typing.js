import express from "express";
import dotenv from "dotenv";
import { db } from "../utils/database.js";

dotenv.config();

const app = express();
app.use(express.json());

const AUTH_KEY = process.env.TYPING_GAME_AUTH_KEY || "changeme";

app.post("/typing-score", async (req, res) => {
    const { userId, wpm, authKey } = req.body;
    if (!userId || !wpm || !authKey) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    if (authKey !== AUTH_KEY) {
        return res.status(403).json({ error: "Invalid authentication key." });
    }
    if (typeof wpm !== "number" || wpm <= 0) {
        return res.status(400).json({ error: "Invalid WPM." });
    }

    try {
        await db.saveTypingScore(userId, wpm);
        return res.json({ success: true });
    } catch (error) {
        console.error("Failed to save typing score:", error);
        return res.status(500).json({ error: "Failed to save score." });
    }
});

export function startTypingApi() {
    const port = process.env.TYPING_API_PORT || 3001;
    app.listen(port, () => {
        console.log(`✅ Typing API running on port ${port}`);
    });
}