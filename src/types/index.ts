import { Readable } from "stream";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamingLLMResponse extends Readable {
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: string, listener: Function): this;
}

export interface LLMModel {
  generateResponse(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<LLMResponse>;
  generateStreamingResponse?(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse;
  setModel(model: string): void;
}

export interface ModelConfig {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    [key: string]: any; // Allow for model-specific parameters
  };
}

export interface GenerateOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  [key: string]: any; // Allow for model-specific parameters
}

export type MiddlewareFunction = (
  messages: ChatMessage[],
  next: (messages: ChatMessage[]) => Promise<LLMResponse>
) => Promise<LLMResponse>;

export interface Plugin {
  name: string;
  init?: (polyglot: any) => void;
  preProcess?: (messages: ChatMessage[]) => Promise<ChatMessage[]>;
  postProcess?: (response: LLMResponse) => Promise<LLMResponse>;
}

export interface RateLimiter {
  consume(tokens: number): Promise<void>;
}
