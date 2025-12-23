import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";

import ingredientRouter from "./ingredient.js";
import imageCreatorRouter from "./imageCreator.js";
import chatAssistantRouter from "./chatAssistant.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// ✅ EXPRESS APP
const app = express();
app.use(cors());
app.use(express.json());

// ✅ MULTER
const upload = multer({ dest: "uploads/" });

// ✅ GENERATED IMAGES STATIC FOLDER
const generatedDir = "./generated_images";
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir);
app.use("/generated_images", express.static(generatedDir));

// ✅ GEMINI CLIENT (одоо байгаа)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// IMAGE ANALYZER
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const imageBase64 = fs.readFileSync(req.file.path, "base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mimeType: req.file.mimetype, data: imageBase64 } },
            {
              text: "This is a food image. List all ingredients in bullet points.",
            },
          ],
        },
      ],
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true, text: result.response.text() });
  } catch (error) {
    console.error("🔥 ANALYZE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// OTHER ROUTES
app.use("/ingredient", ingredientRouter);
app.use("/generate-image", imageCreatorRouter);
app.use("/chat", chatAssistantRouter);

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
