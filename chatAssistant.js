import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const router = express.Router();

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

router.post("/", async (req, res) => {
  try {
    const message = req.body?.message?.trim();
    if (!message) return res.status(400).json({ error: "Message is required" });

    const model = getGeminiModel();
    const result = await model.generateContent(message);

    res.json({ reply: result.response.text() });
  } catch (e) {
    console.error("🔥 CHAT ASSISTANT ERROR:", e);
    res.status(500).json({ error: e.message || "Failed to generate a reply." });
  }
});

export default router;
