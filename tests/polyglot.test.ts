import { Polyglot } from "../src/index";
import { ChatGPTModel } from "../src/models/chatgpt";
import { ModelConfig } from "../src/types";

describe("Polyglot", () => {
  let polyglot: Polyglot;

  beforeEach(() => {
    polyglot = new Polyglot();
  });

  test("should create an instance", () => {
    expect(polyglot).toBeInstanceOf(Polyglot);
  });

  test("should add a model", () => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "gpt-4o",
    };
    const model = new ChatGPTModel(config);
    polyglot.addModel("chatgpt", model);

    expect(() => polyglot.generateResponse("chatgpt", [])).not.toThrow();
  });
});
