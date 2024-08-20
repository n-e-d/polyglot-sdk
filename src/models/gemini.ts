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
import { Readable } from "stream";

const GEMINI_MODELS = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"];

export class GeminiModel implements LLMModel {
  private config: ModelConfig;
  private currentModel: string;

  constructor(config: ModelConfig) {
    this.config = config;
    this.currentModel = config.model || "gemini-1.5-pro";
    if (!GEMINI_MODELS.includes(this.currentModel)) {
      throw new Error(`Invalid Gemini model: ${this.currentModel}`);
    }
  }

  setModel(model: string) {
    if (!GEMINI_MODELS.includes(model)) {
      throw new Error(`Invalid Gemini model: ${model}`);
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
        contents: messages.map((msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.content }],
        })),
        ...this.config.parameters,
        ...options,
      };

      const response = await HttpClient.post(
        this.config.apiUrl ||
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            this.currentModel +
            ":generateContent",
        requestBody,
        {
          "x-goog-api-key": this.config.apiKey,
        }
      );

      return {
        content: response.candidates[0].content.parts[0].text,
        usage: {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("429")) {
          throw new RetryableError("Rate limit exceeded");
        }
        if (error.message.includes("500")) {
          throw new RetryableError("Server error");
        }
      }
      throw error;
    }
  }

  generateStreamingResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
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
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          this.currentModel +
          ":streamGenerateContent",
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
              console.error("Error parsing streaming data:", error);
            }
          }
        }
      })
      .on("end", () => {
        stream.push(null);
      })
      .on("error", (error) => {
        stream.emit("error", error);
      });

    return stream;
  }
}
