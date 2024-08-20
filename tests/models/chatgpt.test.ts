import { ChatGPTModel } from "../../src/models/chatgpt";
import { ModelConfig } from "../../src/types";

describe("ChatGPTModel", () => {
  let model: ChatGPTModel;

  beforeEach(() => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "gpt-4o",
    };
    model = new ChatGPTModel(config);
  });

  test("should create an instance", () => {
    expect(model).toBeInstanceOf(ChatGPTModel);
  });

  test("should set model correctly", () => {
    model.setModel("gpt-4-turbo");

    expect(() => model.setModel("invalid-model")).toThrow();
  });
});
