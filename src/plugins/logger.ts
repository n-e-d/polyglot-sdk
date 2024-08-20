import { Plugin, ChatMessage, LLMResponse } from "../types";

export const LoggerPlugin: Plugin = {
  name: "logger",
  preProcess: async (messages: ChatMessage[]) => {
    console.log("Sending messages:", messages);
    return messages;
  },
  postProcess: async (response: LLMResponse) => {
    console.log("Received response:", response);
    return response;
  },
};
