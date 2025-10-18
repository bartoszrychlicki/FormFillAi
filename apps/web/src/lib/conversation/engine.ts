import { ConversationEngine, InMemorySessionStore } from "@formfillai/shared";

const createEngine = () => new ConversationEngine({ store: new InMemorySessionStore() });

let engine = createEngine();

export const getConversationEngine = (): ConversationEngine => engine;

export const resetConversationEngine = (): void => {
  engine = createEngine();
};
