import express from "express";
import dotenv from "dotenv";
import { InferenceClient } from "@huggingface/inference";
import fs from "fs";

dotenv.config();
const router = express.Router();

function getImageClient() {
  const token = process.env.HF_TOKEN || process.env.HF_token;

  if (!token) {
    throw new Error("HF_TOKEN is not configured.");
  }

  return new InferenceClient(token);
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

router.post("/", async (req, res) => {
  try {
    const description = req.body?.description?.trim();
    if (!description)
      return res.status(400).json({ error: "Description is required" });

    const client = getImageClient();
    const prompt = `A realistic food photo, studio lighting, no people. ${description}`;
    const imageBlob = await client.textToImage({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      inputs: prompt,
      parameters: { num_inference_steps: 15, guidance_scale: 7.5 },
    });

    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `generated_${Date.now()}.png`;
    const folder = "./generated_images";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    fs.writeFileSync(`${folder}/${fileName}`, buffer);

    res.json({
      prompt,
      imageUrl: `${resolvePublicBaseUrl(req)}/generated_images/${fileName}`,
    });
  } catch (e) {
    console.error("🔥 IMAGE CREATOR ERROR:", e);
    res
      .status(500)
      .json({ error: e.message || "Failed to generate image." });
  }
});

export default router;
