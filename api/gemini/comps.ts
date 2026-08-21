import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { address, sqft, beds, baths } = req.body;
    if (!address) {
      return res.status(400).json({ status: 'error', message: 'Address is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY_2;
    if (!apiKey) {
      return res.status(500).json({ status: 'error', message: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Address: ${address}\nSquare Footage: ${sqft || 'Unknown'}\nBedrooms: ${beds || 'Unknown'}\nBathrooms: ${baths || 'Unknown'}\n\nFind 3 closed, on-market retail MLS sales, After Repaired Comparable sales within 2026 that match this property’s Square footage within 300 sqft larger or smaller, bedrooms and bathroom that is no more then 1 mile away from the subject property. Give me the comps that are in the highest price ranges. Can this be acheaved?`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              address: { type: Type.STRING },
              sqft: { type: Type.INTEGER },
              saleDate: { type: Type.STRING, description: "Format as MM/DD/YYYY" },
              salePrice: { type: Type.NUMBER }
            },
            required: ["address", "sqft", "saleDate", "salePrice"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text generated");
    const comps = JSON.parse(text);

    res.json({ status: 'success', data: comps });
  } catch (err: any) {
    console.error("Error from Gemini API:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
