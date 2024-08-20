![Polyglot-SDK Banner](https://github.com/n-e-d/polyglot-sdk/raw/main/repo/banner.png)

# Polyglot <sup>SDK</sup>

Polyglot is a powerful and flexible TypeScript SDK for interacting with multiple Language Model APIs. It provides a unified interface for various LLMs, along with advanced features like streaming responses, caching, middleware support, and error handling.

## Features

- **Multi-model Support**: Easily integrate and switch between different LLM providers (supports Claude, ChatGPT, Mistral, and Gemini).
- **Streaming Responses**: Get real-time responses from supported models.
- **Caching Layer**: Improve performance with built-in caching for repeated queries.
- **Middleware System**: Customize request/response processing with a flexible middleware system.
- **Robust Error Handling**: Automatically retry on transient errors and provide clear error messages.
- **TypeScript Support**: Full TypeScript support for improved developer experience.
- **Extensible Architecture**: Easily add new models or extend functionality.
- **Rate Limiting**: Built-in rate limiting to prevent API quota exhaustion.

## Installation

```bash
npm install polyglot-sdk
```

## Quick Start

```typescript
import { Polyglot, Models, ModelConfig } from "polyglot-sdk";

const polyglot = new Polyglot();

const claudeConfig: ModelConfig = {
  apiKey: "your-claude-api-key",
  model: "claude-3-5-sonnet-20240620",
};
polyglot.addModel("claude", new Models.ClaudeModel(claudeConfig));

async function getResponse() {
  const messages = [{ role: "user", content: "Hello, how are you?" }];
  const response = await polyglot.generateResponse("claude", messages);
  console.log(response.content);
}

getResponse();
```

## Supported Platforms and Models

| Platform           | Supported Models                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Claude (Anthropic) | claude-3-5-sonnet-20240620, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307  |
| ChatGPT (OpenAI)   | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo                                                        |
| Mistral AI         | open-mistral-nemo, mistral-small-latest, mistral-medium-latest, mistral-large-latest, codestral-latest |
| Google Gemini      | gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro                                                       |

## Advanced Usage

### Streaming Responses

```typescript
const stream = polyglot.generateStreamingResponse("claude", messages);
stream.on("data", (chunk) => console.log("Received chunk:", chunk.toString()));
stream.on("end", () => console.log("Stream ended"));
```

### Using Middleware

```typescript
polyglot.use(async (messages, next) => {
  console.log("Sending messages:", messages);
  const response = await next(messages);
  console.log("Received response:", response);
  return response;
});
```

### Caching

Caching is enabled by default. To disable:

```typescript
const response = await polyglot.generateResponse("claude", messages, {
  useCache: false,
});
```

### Switching Models

You can easily switch between different models of the same platform:

```typescript
const chatgptModel = polyglot.getModel("chatgpt");
chatgptModel.setModel("gpt-4-turbo");
```

## API Reference

For detailed API reference, please refer to the TypeScript definitions in the `types.ts` file.

## License

This project is licensed under the MIT License.
