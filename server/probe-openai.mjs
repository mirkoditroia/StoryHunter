import { readFile } from "node:fs/promises";

const settings = JSON.parse(await readFile(new URL("../data/settings.json", import.meta.url), "utf8"));
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${settings.api_key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    max_completion_tokens: 80,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Rispondi solo con JSON." },
      { role: "user", content: 'Restituisci {"ok": true}.' },
    ],
  }),
});
const data = await response.json();
if (!response.ok) {
  console.log(JSON.stringify({ status: response.status, message: data?.error?.message || "" }));
  process.exit(1);
}
console.log(JSON.stringify({ status: response.status, content: data.choices?.[0]?.message?.content || "" }));
