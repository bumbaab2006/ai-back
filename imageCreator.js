import express from "express";
import dotenv from "dotenv";
import { InferenceClient } from "@huggingface/inference";
import fs from "fs";

dotenv.config();
const router = express.Router();

// ✅ Hugging Face client
const client = new InferenceClient(process.env.HF_token);

router.post("/", async (req, res) => {
  try {
    const { description } = req.body;
    if (!description)
      return res.status(400).json({ error: "Description is required" });

    const prompt = `A realistic food photo, studio lighting, no people. ${description}`;

    // ✅ Generate image
    const imageBlob = await client.textToImage({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      inputs: prompt,
      parameters: { num_inference_steps: 15, guidance_scale: 7.5 },
    });

    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `generated_${Date.now()}.png`;
    const folder = "./generated_images";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    fs.writeFileSync(`${folder}/${fileName}`, buffer);

    // ✅ Full backend URL-г frontend-д буцаах
    res.json({
      prompt,
      imageUrl: `https://ai-back-h30s.onrender.com/generated_images/${fileName}`,
    });
  } catch (e) {
    console.error("🔥 IMAGE CREATOR ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
