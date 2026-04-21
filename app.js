import express from "express";
import multer from "multer";
import fs from "fs";
import fsPromises from "fs/promises";
import cors from "cors";
import dotenv from "dotenv";

import ingredientRouter from "./ingredient.js";
import imageCreatorRouter from "./imageCreator.js";
import chatAssistantRouter from "./chatAssistant.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://ai-assistant-sigma-swart.vercel.app",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin is not allowed."));
  },
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

const uploadsDir = "./uploads";
const generatedDir = "./generated_images";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image uploads are supported."));
      return;
    }

    cb(null, true);
  },
});

app.use("/generated_images", express.static(generatedDir));

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

async function safeRemoveFile(filePath) {
  if (!filePath) return;

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to remove temp upload:", error);
    }
  }
}

app.post("/analyze", upload.single("image"), async (req, res, next) => {
  const uploadedFilePath = req.file?.path;

  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const imageBase64 = await fsPromises.readFile(uploadedFilePath, "base64");
    const model = getGeminiModel();

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mimeType: req.file.mimetype, data: imageBase64 } },
            {
              text: "This is a food image. List all ingredients in bullet points. if it is not a food image, respond with 'Not a food image.'",
            },
          ],
        },
      ],
    });

    res.json({ success: true, text: result.response.text() });
  } catch (error) {
    next(error);
  } finally {
    await safeRemoveFile(uploadedFilePath);
  }
});

app.use("/ingredient", ingredientRouter);
app.use("/generate-image", imageCreatorRouter);
app.use("/chat", chatAssistantRouter);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image must be 8MB or smaller." });
    }

    return res.status(400).json({ error: error.message });
  }

  console.error("SERVER ERROR:", error);
  return res
    .status(500)
    .json({ error: error.message || "Something went wrong." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
