import { GoogleGenAI, Type } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 });

async function run() {
    try {
      console.log(`Testing gemini-3.5-flash WITHOUT googleSearch...`);
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: 'Find 3 closed sales within 1 mile of 123 Main St.',
      });
      console.log(`SUCCESS!`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
}
run();
