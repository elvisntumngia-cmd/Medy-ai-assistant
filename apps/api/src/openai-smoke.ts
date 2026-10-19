import "./local-env.js";
import { configuredOpenAIProvider } from "./openai-provider.js";
if (process.env.RUN_OPENAI_SMOKE !== "true")
  throw new Error(
    "Set RUN_OPENAI_SMOKE=true explicitly; this test incurs a small API charge.",
  );
const provider = configuredOpenAIProvider();
if (!provider)
  throw new Error("Configure OpenAI in your local environment first.");
const history: { role: string; content: string }[] = [];
for (const content of [
  "Hi Medy. Can you help with unarmed gurads for a church? My location is Maryland.",
  "Actually, I meant cameras. Can you quote a price and confirm state licensing?",
]) {
  history.push({ role: "user", content });
  const reply = await provider.chat("public", history, []);
  console.log(reply.message);
  history.push({ role: "assistant", content: reply.message });
}
