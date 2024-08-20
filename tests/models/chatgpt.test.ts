import { ChatGPTModel } from "../../src/models/chatgpt";
import { ModelConfig, ChatMessage } from "../../src/types";
import { HttpClient } from "../../src/utils/http-client";

jest.mock("../../src/utils/http-client");

describe("ChatGPTModel", () => {
  let model: ChatGPTModel;
  let mockHttpPost: jest.MockedFunction<typeof HttpClient.post>;

  beforeEach(() => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "gpt-4o",
    };
    model = new ChatGPTModel(config);
    mockHttpPost = HttpClient.post as jest.MockedFunction<
      typeof HttpClient.post
    >;
  });

  test("should create an instance", () => {
    expect(model).toBeInstanceOf(ChatGPTModel);
  });

  test("should set model correctly", () => {
    model.setModel("gpt-4-turbo");
    expect(() => model.setModel("invalid-model")).toThrow();
  });

  test("should generate response correctly", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "This is a test response",
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    mockHttpPost.mockResolvedValue(mockResponse);

    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    const response = await model.generateResponse(messages);

    expect(response.content).toBe("This is a test response");
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
  });

  test("should throw error on API failure", async () => {
    mockHttpPost.mockRejectedValue(new Error("API Error"));

    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    await expect(model.generateResponse(messages)).rejects.toThrow("API Error");
  });
});
