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

const GEMINI_MODELS = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"];

export class GeminiModel implements LLMModel {
  private config: ModelConfig;
  private currentModel: string;

  constructor(config: ModelConfig) {
    this.config = config;
    this.currentModel = config.model || "gemini-1.5-pro";
    if (!GEMINI_MODELS.includes(this.currentModel)) {
      throw new ModelError(
        `Invalid Gemini model: ${this.currentModel}`,
        "INVALID_MODEL",
        this.currentModel
      );
    }
    logger.info(`GeminiModel initialized with model: ${this.currentModel}`);
  }

  setModel(model: string) {
    if (!GEMINI_MODELS.includes(model)) {
      throw new ModelError(
        `Invalid Gemini model: ${model}`,
        "INVALID_MODEL",
        model
      );
    }
    this.currentModel = model;
    logger.info(`GeminiModel switched to model: ${this.currentModel}`);
  }

  async generateResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    try {
      logger.info(`Generating response with Gemini model`, {
        model: this.currentModel,
      });
      const requestBody = {
        model: this.currentModel,
        contents: messages.map((msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.content }],
        })),
        ...this.config.parameters,
        ...options,
      };

      const response = await HttpClient.post(
        this.config.apiUrl ||
          `https://generativelanguage.googleapis.com/v1beta/models/${this.currentModel}:generateContent`,
        requestBody,
        {
          "x-goog-api-key": this.config.apiKey,
        }
      );

      logger.info(`Response received from Gemini API`);
      return {
        content: response.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        },
      };
    } catch (error: unknown) {
      if (error instanceof RateLimitError) {
        logger.warn(`Rate limit exceeded for Gemini API`, {
          retryAfter: error.retryAfter,
        });
        throw error;
      }
      if (error instanceof NetworkError) {
        logger.error(`Network error occurred with Gemini API`, {
          statusCode: error.statusCode,
        });
        throw error;
      }
      logger.error(`Error generating response with Gemini model`, { error });
      if (error instanceof Error) {
        throw new ModelError(
          `Gemini API error: ${error.message}`,
          "GEMINI_API_ERROR",
          this.currentModel
        );
      } else {
        throw new ModelError(
          `Gemini API error: Unknown error occurred`,
          "GEMINI_API_ERROR",
          this.currentModel
        );
      }
    }
  }

  generateStreamingResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
    logger.info(`Initiating streaming response with Gemini model`, {
      model: this.currentModel,
    });
    const stream = new Readable({
      read() {},
    });

    const requestBody = {
      model: this.currentModel,
      contents: messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      })),
      stream: true,
      ...this.config.parameters,
      ...options,
    };

    HttpClient.postStream(
      this.config.apiUrl ||
        `https://generativelanguage.googleapis.com/v1beta/models/${this.currentModel}:streamGenerateContent`,
      requestBody,
      {
        "x-goog-api-key": this.config.apiKey,
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
              if (data.candidates && data.candidates[0].content.parts[0].text) {
                stream.push(data.candidates[0].content.parts[0].text);
              }
            } catch (error) {
              logger.error("Error parsing streaming data:", { error });
            }
          }
        }
      })
      .on("end", () => {
        logger.info(`Streaming response completed for Gemini model`);
        stream.push(null);
      })
      .on("error", (error) => {
        logger.error(`Error in streaming response for Gemini model`, { error });
        stream.emit("error", error);
      });

    return stream;
  }
}
