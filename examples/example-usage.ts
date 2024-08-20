import {
  Polyglot,
  Models,
  ModelConfig,
  ChatMessage,
  TokenBucketRateLimiter,
  LoggerPlugin,
} from "../src";

const polyglot = new Polyglot();

const claudeConfig: ModelConfig = {
  apiKey: "your-claude-api-key",
  apiUrl: "https://api.anthropic.com/v1/chat/completions",
};
const claudeRateLimiter = new TokenBucketRateLimiter(10000, 10); // 10000 tokens per second
polyglot.addModel(
  "claude",
  new Models.ClaudeModel(claudeConfig),
  claudeRateLimiter
);

// Add logger plugin
polyglot.addPlugin(LoggerPlugin);

async function demoFeatures() {
  const messages: ChatMessage[] = [
    { role: "user", content: "Explain quantum computing briefly." },
  ];

  // Regular response with rate limiting and logging
  const response = await polyglot.generateResponse("claude", messages);
  console.log("Regular response:", response.content);

  // Cached response
  const cachedResponse = await polyglot.generateResponse("claude", messages);
  console.log("Cached response:", cachedResponse.content);

  // Streaming response
  const stream = polyglot.generateStreamingResponse("claude", messages);
  stream.on("data", (chunk) =>
    console.log("Received chunk:", chunk.toString())
  );
  stream.on("end", () => console.log("Stream ended"));
}

demoFeatures().catch(console.error);
