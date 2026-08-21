import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });

const models = [
  'gemini-2.5-flash',
  'gemini-pro-latest',
  'gemini-flash-latest'
];

async function run() {
  for (const model of models) {
    try {
      console.log(`Testing ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: 'Find a recent news article about NASA',
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      console.log(`SUCCESS: ${model}`);
    } catch (e) {
      console.log(`FAILED: ${model} -> ${e.message}`);
    }
  }
}
run();
