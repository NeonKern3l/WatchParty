import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; // Ensure this is safe in prod
const ai = new GoogleGenAI({ apiKey });

export const generateAiChatResponse = async (
  history: { role: string; content: string }[],
  currentContext: string
): Promise<string> => {
  if (!apiKey) return "I can't chat right now, my API key is missing!";

  try {
    const model = ai.models;
    
    // Construct a prompt context
    const systemPrompt = `
      You are a friendly, witty movie watching companion in a virtual watch party.
      The users are currently watching: "${currentContext}".
      Keep your responses brief (under 50 words), conversational, and fun.
      React to what they say like a friend on the couch.
      Do not be formal. Use emojis occasionally.
    `;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents.map(c => ({ role: c.role, parts: c.parts })), 
      // Note: The SDK structure might slightly differ for chat history in raw generateContent vs Chat.
      // We will simplify to a single prompt for robustness in this stateless call or use chat session if needed.
      // For this implementation, let's use a fresh generation to ensure context is passed clearly.
    });

    return response.text || "Thinking...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Whoops, I got distracted. What was that?";
  }
};