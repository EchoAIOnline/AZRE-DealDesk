import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Find 3 closed sales within 1 mile of 123 Main St.',
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    console.log(`SUCCESS: ${response.text}`);
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}
run();
