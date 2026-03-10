import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

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
    const dish = req.body?.dish?.trim();
    if (!dish) {
      return res.status(400).json({ error: "Dish is required" });
    }

    const model = getGeminiModel();

    const result = await model.generateContent(
      `List ingredients for this dish:\n${dish} . if it is not a food dish, respond with "Not a food dish."`
    );

    res.json({ text: result.response.text() });
  } catch (err) {
    console.error("🔥 INGREDIENT ERROR:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to analyze ingredients." });
  }
});

export default router;
