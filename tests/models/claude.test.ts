import { ClaudeModel } from "../../src/models/claude";
import { ModelConfig, ChatMessage } from "../../src/types";
import { HttpClient } from "../../src/utils/http-client";

jest.mock("../../src/utils/http-client");

describe("ClaudeModel", () => {
  let model: ClaudeModel;
  let mockHttpPost: jest.MockedFunction<typeof HttpClient.post>;

  beforeEach(() => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "claude-3-5-sonnet-20240620",
    };
    model = new ClaudeModel(config);
    mockHttpPost = HttpClient.post as jest.MockedFunction<
      typeof HttpClient.post
    >;
  });

  test("should create an instance", () => {
    expect(model).toBeInstanceOf(ClaudeModel);
  });

  test("should set model correctly", () => {
    model.setModel("claude-3-opus-20240229");
    expect(() => model.setModel("invalid-model")).toThrow();
  });

  test("should generate response correctly", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "This is a test response from Claude",
          },
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 25,
        total_tokens: 40,
      },
    };

    mockHttpPost.mockResolvedValue(mockResponse);

    const messages: ChatMessage[] = [{ role: "user", content: "Hello Claude" }];
    const response = await model.generateResponse(messages);

    expect(response.content).toBe("This is a test response from Claude");
    expect(response.usage).toEqual({
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    });
  });

  test("should throw error on API failure", async () => {
    mockHttpPost.mockRejectedValue(new Error("Claude API Error"));

    const messages: ChatMessage[] = [{ role: "user", content: "Hello Claude" }];
    await expect(model.generateResponse(messages)).rejects.toThrow(
      "Claude API Error"
    );
  });
});
