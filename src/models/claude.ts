import {
  LLMModel,
  ChatMessage,
  LLMResponse,
  ModelConfig,
  StreamingLLMResponse,
  GenerateOptions,
} from "../types";
import { HttpClient } from "../utils/http-client";
import { RetryableError } from "../utils/error-handler";

const CLAUDE_MODELS = [
  "claude-3-5-sonnet-20240620",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

export class ClaudeModel implements LLMModel {
  private config: ModelConfig;
  private currentModel: string;

  constructor(config: ModelConfig) {
    this.config = config;
    this.currentModel = config.model || "claude-3-5-sonnet-20240620";
    if (!CLAUDE_MODELS.includes(this.currentModel)) {
      throw new Error(`Invalid Claude model: ${this.currentModel}`);
    }
  }

  setModel(model: string) {
    if (!CLAUDE_MODELS.includes(model)) {
      throw new Error(`Invalid Claude model: ${model}`);
    }
    this.currentModel = model;
  }

  async generateResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    try {
      const requestBody = {
        model: this.currentModel,
        messages: messages,
        ...this.config.parameters,
        ...options,
      };

      const response = await HttpClient.post(
        this.config.apiUrl || "https://api.anthropic.com/v1/chat/completions",
        requestBody,
        {
          "x-api-key": this.config.apiKey,
        }
      );

      return {
        content: response.choices[0].message.content,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("429")) {
        throw new RetryableError("Rate limit exceeded");
      }
      throw error;
    }
  }

  generateStreamingResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
    const requestBody = {
      model: this.currentModel,
      messages: messages,
      stream: true,
      ...this.config.parameters,
      ...options,
    };

    return HttpClient.postStream(
      this.config.apiUrl || "https://api.anthropic.com/v1/chat/completions",
      requestBody,
      {
        "x-api-key": this.config.apiKey,
      }
    );
  }
}
