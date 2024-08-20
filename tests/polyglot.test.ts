import { Polyglot } from "../src/index";
import { ChatGPTModel } from "../src/models/chatgpt";
import { ModelConfig, ChatMessage } from "../src/types";
import { HttpClient } from "../src/utils/http-client";

jest.mock("../src/utils/http-client");

describe("Polyglot", () => {
  let polyglot: Polyglot;
  let mockHttpPost: jest.MockedFunction<typeof HttpClient.post>;

  beforeEach(() => {
    polyglot = new Polyglot();
    mockHttpPost = HttpClient.post as jest.MockedFunction<
      typeof HttpClient.post
    >;
  });

  test("should create an instance", () => {
    expect(polyglot).toBeInstanceOf(Polyglot);
  });

  test("should add a model and generate response", async () => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "gpt-4o",
    };
    const model = new ChatGPTModel(config);
    polyglot.addModel("chatgpt", model);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "This is a test response from Polyglot",
          },
        },
      ],
      usage: {
        prompt_tokens: 5,
        completion_tokens: 10,
        total_tokens: 15,
      },
    };

    mockHttpPost.mockResolvedValue(mockResponse);

    const messages: ChatMessage[] = [
      { role: "user", content: "Hello Polyglot" },
    ];
    const response = await polyglot.generateResponse("chatgpt", messages);

    expect(response.content).toBe("This is a test response from Polyglot");
    expect(response.usage).toEqual({
      promptTokens: 5,
      completionTokens: 10,
      totalTokens: 15,
    });
  });

  test("should throw error for unknown model", async () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    await expect(
      polyglot.generateResponse("unknown-model", messages)
    ).rejects.toThrow('Model "unknown-model" not found');
  });
});
