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
      throw new Error(`Invalid Mistral model: ${this.currentModel}`);
    }
  }

  setModel(model: string) {
    if (!MISTRAL_MODELS.includes(model)) {
      throw new Error(`Invalid Mistral model: ${model}`);
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
        this.config.apiUrl || "https://api.mistral.ai/v1/chat/completions",
        requestBody,
        {
          Authorization: `Bearer ${this.config.apiKey}`,
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
