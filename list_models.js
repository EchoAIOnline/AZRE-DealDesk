import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY_2}`);
    const data = await response.json();
    console.log(data.models.map(m => m.name).join('\n'));
  } catch (e) {
    console.log(e);
  }
}
run();
