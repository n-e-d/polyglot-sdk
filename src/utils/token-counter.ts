import { ChatMessage } from "../types";

function countTokens(text: string): number {
  const tokens = text.toLowerCase().match(/\b[\w']+\b|\S/g) || [];

  let tokenCount = 0;
  for (const token of tokens) {
    tokenCount += 1;

    if (token.length > 10) {
      tokenCount += Math.floor(token.length / 5);
    }

    if (/^\d+$/.test(token)) {
      tokenCount += Math.max(1, Math.floor(token.length / 2));
    }
  }

  tokenCount += Math.floor(text.length / 100);
  return tokenCount;
}

export function estimateTokenCount(text: string): number {
  return countTokens(text);
}

export function estimateMessagesTokenCount(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => {
    // Add a small overhead for each message (e.g., for role encoding)
    return (
      total +
      4 +
      estimateTokenCount(message.role) +
      estimateTokenCount(message.content)
    );
  }, 0);
}

export class TokenUsageTracker {
  private totalTokens: number = 0;

  addUsage(promptTokens: number, completionTokens: number) {
    this.totalTokens += promptTokens + completionTokens;
  }

  getTotalUsage(): number {
    return this.totalTokens;
  }

  reset() {
    this.totalTokens = 0;
  }
}
