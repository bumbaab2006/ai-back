import express from "express";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const router = express.Router();

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return apiKey;
}

function getPreferredImageModel() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";
}

function getImageModelCandidates() {
  return [...new Set([getPreferredImageModel(), "gemini-2.5-flash-image"])];
}

function resolvePublicBaseUrl(req) {
  const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const forwardedProtocol = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const protocol = forwardedProtocol || req.protocol;
  const host = forwardedHost || req.get("host");

  return `${protocol}://${host}`;
}

function buildPrompt(description) {
  return `Create a realistic food photo with clean studio lighting and no people. ${description}`;
}

function readGeminiParts(payload) {
  return payload?.candidates?.[0]?.content?.parts || [];
}

function extractImagePart(parts) {
  return parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
}

function extractText(parts) {
  return parts
    .map((part) => part?.text?.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function requestGeminiImage(prompt) {
  const apiKey = getGeminiApiKey();
  let lastError = new Error("Gemini did not return an image.");

  for (const model of getImageModelCandidates()) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: {
              aspectRatio: "4:3",
            },
          },
        }),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage =
        payload?.error?.message ||
        `Gemini image generation failed on model ${model}.`;

      lastError = new Error(providerMessage);
      lastError.status = response.status;
      continue;
    }

    const parts = readGeminiParts(payload);
    const imagePart = extractImagePart(parts);

    if (imagePart) {
      return {
        model,
        imageBase64: imagePart.inlineData?.data || imagePart.inline_data?.data,
        text: extractText(parts),
      };
    }

    const providerText = extractText(parts);
    lastError = new Error(
      providerText || `Gemini returned no image output for model ${model}.`
    );
  }

  throw lastError;
}

router.post("/", async (req, res) => {
  try {
    const description = req.body?.description?.trim();
    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    const prompt = buildPrompt(description);
    const { model, imageBase64 } = await requestGeminiImage(prompt);
    const buffer = Buffer.from(imageBase64, "base64");

    const fileName = `generated_${Date.now()}.png`;
    const folder = "./generated_images";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    fs.writeFileSync(`${folder}/${fileName}`, buffer);

    res.json({
      model,
      prompt,
      imageUrl: `${resolvePublicBaseUrl(req)}/generated_images/${fileName}`,
    });
  } catch (error) {
    console.error("🔥 IMAGE CREATOR ERROR:", error);
    const status =
      typeof error?.status === "number" &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;

    res
      .status(status)
      .json({ error: error.message || "Failed to generate image." });
  }
});

export default router;
