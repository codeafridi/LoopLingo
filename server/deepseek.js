// server/deepseek.js
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

async function generateWithDeepSeek(prompt) {
  const completion = await client.chat.completions.create({
    model: "deepseek/deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 3000,
  });

  return completion.choices[0].message.content;
}

module.exports = { generateWithDeepSeek };
