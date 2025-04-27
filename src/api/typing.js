import express from "express";
import dotenv from "dotenv";
import { db } from "../utils/database.js";

dotenv.config();

const app = express();
app.use(express.json());

const AUTH_KEY = process.env.TYPING_GAME_AUTH_KEY || "changeme";
const MAX_WPM = 200;
const MIN_TEST_DURATION = 30;
const COOLDOWN = 60 * 1000;
const lastSubmissions = new Map();

app.post("/typing-score", async (req, res) => {
  const { userId, wpm, authKey, testDuration, accuracy, rawText, typedText } =
    req.body;
  if (
    !userId ||
    !wpm ||
    !authKey ||
    !testDuration ||
    !accuracy ||
    !rawText ||
    !typedText
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (authKey !== AUTH_KEY) {
    return res.status(403).json({ error: "Invalid authentication key." });
  }

  const lastSubmission = lastSubmissions.get(userId);
  if (lastSubmission && Date.now() - lastSubmission < COOLDOWN) {
    return res.status(429).json({
      error: "Please wait before submitting another score.",
      remainingTime: Math.ceil(
        (COOLDOWN - (Date.now() - lastSubmission)) / 1000,
      ),
    });
  }

  if (typeof wpm !== "number" || wpm <= 0 || wpm > MAX_WPM) {
    return res.status(400).json({ error: "Invalid WPM." });
  }

  if (testDuration < MIN_TEST_DURATION) {
    return res.status(400).json({ error: "Test duration too short." });
  }

  if (accuracy < 0 || accuracy > 100) {
    return res.status(400).json({ error: "Invalid accuracy value." });
  }

  const calculatedWPM = calculateWPM(rawText, typedText, testDuration);
  if (Math.abs(calculatedWPM - wpm) > 5) {
    return res.status(400).json({ error: "Score verification failed." });
  }

  try {
    await db.saveTypingScore(userId, wpm, accuracy, testDuration);
    lastSubmissions.set(userId, Date.now());
    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to save typing score:", error);
    return res.status(500).json({ error: "Failed to save score." });
  }
});

function calculateWPM(rawText, typedText, duration) {
  const words = typedText.length / 5;
  const minutes = duration / 60;
  return Math.round(words / minutes);
}

export function startTypingApi() {
  const port = process.env.TYPING_API_PORT || 3001;
  app.listen(port, () => {});
}
