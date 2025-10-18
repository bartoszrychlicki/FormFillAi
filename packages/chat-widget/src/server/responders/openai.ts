import type { ConversationResponder } from "../createFormFillHandler";

export interface OpenAIResponderOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export function createOpenAIResponder(options: OpenAIResponderOptions): ConversationResponder {
  if (!options?.apiKey) {
    throw new Error("createOpenAIResponder requires an OpenAI API key.");
  }

  return {
    async respond() {
      throw new Error("OpenAI responder not implemented yet.");
    },
  } satisfies ConversationResponder;
}
