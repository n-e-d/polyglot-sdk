import { RateLimiter } from "../types";

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefillTimestamp: number;

  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefillTimestamp = Date.now();
  }

  private refill() {
    const now = Date.now();
    const timeElapsed = now - this.lastRefillTimestamp;
    const tokensToAdd = (timeElapsed / 1000) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  async consume(tokens: number): Promise<void> {
    this.refill();
    if (this.tokens < tokens) {
      const timeToWait = ((tokens - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
      this.refill();
    }
    this.tokens -= tokens;
  }
}
