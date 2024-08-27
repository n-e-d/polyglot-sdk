import {
  LLMModel,
  ChatMessage,
  LLMResponse,
  ModelConfig,
  MiddlewareFunction,
  StreamingLLMResponse,
  Plugin,
  RateLimiter,
  GenerateOptions,
} from "./types";
import * as Models from "./models";
import { PolyglotError, handleError, logger } from "./utils/error-handler";
import {
  TokenUsageTracker,
  estimateMessagesTokenCount,
} from "./utils/token-counter";
import { Cache } from "./utils/cache";
import { TokenBucketRateLimiter } from "./utils/rate-limiter";
import { LoggerPlugin } from "./plugins/logger";

export class Polyglot {
  private models: Map<string, LLMModel>;
  private middlewares: MiddlewareFunction[];
  private cache: Cache;
  private plugins: Plugin[];
  private rateLimiters: Map<string, RateLimiter>;
  private tokenUsageTracker: TokenUsageTracker;

  constructor() {
    this.models = new Map();
    this.middlewares = [];
    this.cache = new Cache();
    this.plugins = [];
    this.rateLimiters = new Map();
    this.tokenUsageTracker = new TokenUsageTracker();
  }

  /**
   * Adds a new model to the Polyglot instance.
   * @param name - The name to identify the model.
   * @param model - The LLMModel instance.
   * @param rateLimiter - Optional rate limiter for the model.
   */
  addModel(name: string, model: LLMModel, rateLimiter?: RateLimiter): void {
    this.models.set(name, model);
    if (rateLimiter) {
      this.rateLimiters.set(name, rateLimiter);
    }
  }

  /**
   * Adds a middleware function to the Polyglot instance.
   * @param middleware - The middleware function to add.
   */
  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
  }

  /**
   * Adds a plugin to the Polyglot instance.
   * @param plugin - The plugin to add.
   */
  addPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
    if (plugin.init) {
      plugin.init(this);
    }
  }

  private async runPlugins(
    stage: "preProcess" | "postProcess",
    data: ChatMessage[] | LLMResponse
  ): Promise<ChatMessage[] | LLMResponse> {
    for (const plugin of this.plugins) {
      if (plugin[stage]) {
        data = await plugin[stage]!(data as any);
      }
    }
    return data;
  }

  private async runMiddlewares(
    messages: ChatMessage[],
    modelName: string,
    options?: GenerateOptions
  ): Promise<LLMResponse> {
    let index = 0;
    const runMiddleware = async (
      messages: ChatMessage[]
    ): Promise<LLMResponse> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(messages, runMiddleware);
      } else {
        const model = this.models.get(modelName);
        if (!model) {
          throw new PolyglotError(
            `Model "${modelName}" not found`,
            "MODEL_NOT_FOUND"
          );
        }
        const rateLimiter = this.rateLimiters.get(modelName);
        if (rateLimiter) {
          await rateLimiter.consume(this.estimateMessageTokens(messages));
        }
        return model.generateResponse(messages, options);
      }
    };
    return runMiddleware(messages);
  }

  /**
   * Generates a response using the specified model.
   * @param modelName - The name of the model to use.
   * @param messages - The chat messages to generate a response for.
   * @param options - Optional generation options.
   * @param useCache - Whether to use caching (default: true).
   * @returns A promise that resolves to the generated response.
   */
  async generateResponse(
    modelName: string,
    messages: ChatMessage[],
    options?: GenerateOptions,
    useCache: boolean = true
  ): Promise<LLMResponse> {
    const estimatedTokens = estimateMessagesTokenCount(messages);
    logger.info(`Generating response`, { modelName, estimatedTokens });

    messages = (await this.runPlugins("preProcess", messages)) as ChatMessage[];

    const cacheKey = `${modelName}:${JSON.stringify(messages)}:${JSON.stringify(
      options
    )}`;
    if (useCache) {
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) {
        logger.info(`Cache hit for ${cacheKey}`);
        return cachedResponse;
      }
    }

    let retries = 3;
    while (retries > 0) {
      try {
        let response = await this.runMiddlewares(messages, modelName, options);
        response = (await this.runPlugins(
          "postProcess",
          response
        )) as LLMResponse;

        if (response.usage) {
          this.tokenUsageTracker.addUsage(
            response.usage.promptTokens,
            response.usage.completionTokens
          );
          logger.info(`Token usage updated`, {
            totalUsage: this.tokenUsageTracker.getTotalUsage(),
          });
        }

        if (useCache) {
          this.cache.set(cacheKey, response);
          logger.info(`Response cached for ${cacheKey}`);
        }
        return response;
      } catch (error: unknown) {
        if (error instanceof PolyglotError && retries > 1) {
          retries--;
          logger.warn(`Retrying request`, { retriesLeft: retries });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          if (error instanceof Error) {
            throw handleError(error);
          } else {
            throw handleError(
              new PolyglotError("An unknown error occurred", "UNKNOWN_ERROR")
            );
          }
        }
      }
    }

    throw new PolyglotError("Max retries reached", "MAX_RETRIES");
  }

  /**
   * Generates a streaming response using the specified model.
   * @param modelName - The name of the model to use.
   * @param messages - The chat messages to generate a response for.
   * @param options - Optional generation options.
   * @returns A streaming response.
   */
  generateStreamingResponse(
    modelName: string,
    messages: ChatMessage[],
    options?: GenerateOptions
  ): StreamingLLMResponse {
    const model = this.models.get(modelName);
    if (!model || !model.generateStreamingResponse) {
      throw new PolyglotError(
        `Streaming not supported for model "${modelName}"`,
        "STREAMING_NOT_SUPPORTED"
      );
    }
    return model.generateStreamingResponse(messages, options);
  }

  /**
   * Estimates the number of tokens in the given messages.
   * @param messages - The chat messages to estimate token count for.
   * @returns The estimated number of tokens.
   */
  estimateMessageTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }

  /**
   * Changes the model for a specific LLM provider.
   * @param modelName - The name of the model provider.
   * @param newModel - The new model to switch to.
   */
  changeModel(modelName: string, newModel: string): void {
    const model = this.models.get(modelName);
    if (!model) {
      throw new PolyglotError(
        `Model "${modelName}" not found`,
        "MODEL_NOT_FOUND"
      );
    }
    if ("setModel" in model && typeof model.setModel === "function") {
      model.setModel(newModel);
    } else {
      throw new PolyglotError(
        `Model "${modelName}" does not support changing models`,
        "MODEL_NOT_CHANGEABLE"
      );
    }
  }

  /**
   * Gets the total token usage across all requests.
   * @returns The total number of tokens used.
   */
  getTotalTokenUsage(): number {
    return this.tokenUsageTracker.getTotalUsage();
  }

  /**
   * Resets the token usage counter.
   */
  resetTokenUsage() {
    this.tokenUsageTracker.reset();
  }
}

export {
  Models,
  ChatMessage,
  LLMResponse,
  PolyglotError,
  ModelConfig,
  StreamingLLMResponse,
  Plugin,
  RateLimiter,
  TokenBucketRateLimiter,
  LoggerPlugin,
  GenerateOptions,
};
