import { ClaudeModel } from "../../src/models/claude";
import { ModelConfig } from "../../src/types";

describe("ClaudeModel", () => {
  let model: ClaudeModel;

  beforeEach(() => {
    const config: ModelConfig = {
      apiKey: "test-api-key",
      model: "claude-3-5-sonnet-20240620",
    };
    model = new ClaudeModel(config);
  });

  test("should create an instance", () => {
    expect(model).toBeInstanceOf(ClaudeModel);
  });

  test("should set model correctly", () => {
    model.setModel("claude-3-opus-20240229");

    expect(() => model.setModel("invalid-model")).toThrow();
  });
});
