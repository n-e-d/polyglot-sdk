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
import { Readable } from "stream";

const MISTRAL_MODELS = [
  "open-mistral-nemo",
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "codestral-latest",
];

export class MistralModel implements LLMModel {
  private config: ModelConfig;
  private currentModel: string;

  constructor(config: ModelConfig) {
    this.config = config;
    this.currentModel = config.model || "open-mistral-nemo";
    if (!MISTRAL_MODELS.includes(this.currentModel)) {
      throw new ModelError(
        `Invalid Mistral model: ${this.currentModel}`,
        "INVALID_MODEL",
        this.currentModel
      );
    }
    logger.info(`MistralModel initialized with model: ${this.currentModel}`);
  }

  setModel(model: string) {
    if (!MISTRAL_MODELS.includes(model)) {
      throw new ModelError(
        `Invalid Mistral model: ${model}`,
        "INVALID_MODEL",
        model
      );
    }
    this.currentModel = model;
    logger.info(`MistralModel switched to model: ${this.currentModel}`);
  }

  async generateResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    try {
      logger.info(`Generating response with Mistral model`, {
        model: this.currentModel,
      });
      const requestBody = {
        model: this.currentModel,
        messages: messages,
        ...this.config.parameters,
        ...options,
      };

      const response = await HttpClient.post(
        this.config.apiUrl || "https://api.mistral.ai/v1/chat/completions",
        requestBody,
        {
          Authorization: `Bearer ${this.config.apiKey}`,
        }
      );

      logger.info(`Response received from Mistral API`);
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
        logger.warn(`Rate limit exceeded for Mistral API`, {
          retryAfter: error.retryAfter,
        });
        throw error;
      }
      if (error instanceof NetworkError) {
        logger.error(`Network error occurred with Mistral API`, {
          statusCode: error.statusCode,
        });
        throw error;
      }
      logger.error(`Error generating response with Mistral model`, { error });
      if (error instanceof Error) {
        throw new ModelError(
          `Mistral API error: ${error.message}`,
          "MISTRAL_API_ERROR",
          this.currentModel
        );
      } else {
        throw new ModelError(
          `Mistral API error: Unknown error occurred`,
          "MISTRAL_API_ERROR",
          this.currentModel
        );
      }
    }
  }

  generateStreamingResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
    logger.info(`Initiating streaming response with Mistral model`, {
      model: this.currentModel,
    });
    const stream = new Readable({
      read() {},
    });

    const requestBody = {
      model: this.currentModel,
      messages: messages,
      stream: true,
      ...this.config.parameters,
      ...options,
    };

    HttpClient.postStream(
      this.config.apiUrl || "https://api.mistral.ai/v1/chat/completions",
      requestBody,
      {
        Authorization: `Bearer ${this.config.apiKey}`,
      }
    )
      .on("data", (chunk: Buffer) => {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line) => line.trim() !== "");
        for (const line of lines) {
          if (line.includes("[DONE]")) {
            stream.push(null);
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (
                data.choices &&
                data.choices[0].delta &&
                data.choices[0].delta.content
              ) {
                stream.push(data.choices[0].delta.content);
              }
            } catch (error) {
              logger.error("Error parsing streaming data:", error);
            }
          }
        }
      })
      .on("end", () => {
        logger.info(`Streaming response completed for Mistral model`);
        stream.push(null);
      })
      .on("error", (error) => {
        logger.error(`Error in streaming response for Mistral model`, {
          error,
        });
        stream.emit("error", error);
      });

    return stream;
  }
}
