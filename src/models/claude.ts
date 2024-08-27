import {
  LLMModel,
  ChatMessage,
  LLMResponse,
  ModelConfig,
  StreamingLLMResponse,
  GenerateOptions,
} from "../types";
import { HttpClient } from "../utils/http-client";
import {
  ModelError,
  RateLimitError,
  NetworkError,
  logger,
} from "../utils/error-handler";

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
      throw new ModelError(
        `Invalid Claude model: ${this.currentModel}`,
        "INVALID_MODEL",
        this.currentModel
      );
    }
    logger.info(`ClaudeModel initialized with model: ${this.currentModel}`);
  }

  setModel(model: string) {
    if (!CLAUDE_MODELS.includes(model)) {
      throw new ModelError(
        `Invalid Claude model: ${model}`,
        "INVALID_MODEL",
        model
      );
    }
    this.currentModel = model;
    logger.info(`ClaudeModel switched to model: ${this.currentModel}`);
  }

  async generateResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    try {
      logger.info(`Generating response with Claude model`, {
        model: this.currentModel,
      });
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

      logger.info(`Response received from Claude API`);
      return {
        content: response.choices[0].message.content,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        },
      };
    } catch (error: unknown) {
      if (error instanceof RateLimitError) {
        logger.warn(`Rate limit exceeded for Claude API`, {
          retryAfter: error.retryAfter,
        });
        throw error;
      }
      if (error instanceof NetworkError) {
        logger.error(`Network error occurred with Claude API`, {
          statusCode: error.statusCode,
        });
        throw error;
      }
      logger.error(`Error generating response with Claude model`, { error });
      if (error instanceof Error) {
        throw new ModelError(
          `Claude API error: ${error.message}`,
          "CLAUDE_API_ERROR",
          this.currentModel
        );
      } else {
        throw new ModelError(
          `Claude API error: Unknown error occurred`,
          "CLAUDE_API_ERROR",
          this.currentModel
        );
      }
    }
  }

  generateStreamingResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
    logger.info(`Initiating streaming response with Claude model`, {
      model: this.currentModel,
    });
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
