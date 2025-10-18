import type { ConversationSchema } from "../schema/conversationSchema";
import { parseConversationSchema } from "../schema/conversationSchema";
import {
  ConversationEngine,
  type ConversationSession,
  type SessionStore,
} from "./conversationEngine";

const baseSchema = parseConversationSchema({
  id: "loan-intake",
  welcomeMessage: "Hi there! Let's get started.",
  completionMessage: "Thanks for sharing your details.",
  webhookUrl: "https://example.com/webhook",
  fields: [
    {
      id: "full-name",
      text: "What is your full name?",
      type: "text",
      validation: { required: true },
    },
    {
      id: "contact-email",
      text: "What's the best email to reach you?",
      type: "email",
    },
    {
      id: "loan-purpose",
      text: "What will you use the loan for?",
      type: "select",
      options: ["Home", "Auto", "Consolidation"],
    },
  ],
});

class RecordingStore implements SessionStore {
  public readonly created: ConversationSession[] = [];
  public readonly updated: ConversationSession[] = [];
  private readonly sessions = new Map<string, ConversationSession>();

  async create(session: ConversationSession): Promise<void> {
    const clone = cloneSession(session);
    this.created.push(clone);
    this.sessions.set(clone.sessionId, clone);
  }

  async update(session: ConversationSession): Promise<void> {
    const clone = cloneSession(session);
    this.updated.push(clone);
    this.sessions.set(clone.sessionId, clone);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async get(sessionId: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? cloneSession(session) : null;
  }
}

const cloneSession = (session: ConversationSession): ConversationSession => ({
  ...session,
  collectedData: { ...session.collectedData },
  createdAt: new Date(session.createdAt.getTime()),
  updatedAt: new Date(session.updatedAt.getTime()),
});

const sequenceClock = (timestamps: Date[]) => {
  let index = 0;
  return () => timestamps[Math.min(index++, timestamps.length - 1)];
};

describe("ConversationEngine", () => {
  const baseNow = new Date("2025-01-01T00:00:00.000Z");

  it("starts a session and returns the first prompt", async () => {
    const engine = new ConversationEngine({
      idGenerator: () => "session-abc",
      clock: sequenceClock([baseNow]),
    });

    const result = await engine.startConversation(baseSchema);

    expect(result.session.sessionId).toBe("session-abc");
    expect(result.session.schemaId).toBe("loan-intake");
    expect(result.session.status).toBe("in_progress");
    expect(result.session.currentFieldId).toBe("full-name");
    expect(result.session.collectedData).toEqual({});
    expect(result.session.createdAt.toISOString()).toBe(baseNow.toISOString());
    expect(result.session.updatedAt.toISOString()).toBe(baseNow.toISOString());
    expect(result.nextField?.id).toBe("full-name");
    expect(result.answeredField).toBeNull();
    expect(result.completed).toBe(false);
  });

  it("advances through the schema and completes once all fields answered", async () => {
    const timestamps = [
      baseNow,
      new Date("2025-01-01T00:00:05.000Z"),
      new Date("2025-01-01T00:00:10.000Z"),
      new Date("2025-01-01T00:00:15.000Z"),
    ];
    const engine = new ConversationEngine({
      idGenerator: () => "session-rolling",
      clock: sequenceClock(timestamps),
    });

    const start = await engine.startConversation(baseSchema);

    const firstTurn = await engine.submitReply({
      sessionId: start.session.sessionId,
      value: "Alicia",
    });
    expect(firstTurn.session.collectedData).toEqual({ "full-name": "Alicia" });
    expect(firstTurn.session.currentFieldId).toBe("contact-email");
    expect(firstTurn.nextField?.id).toBe("contact-email");
    expect(firstTurn.answeredField?.id).toBe("full-name");
    expect(firstTurn.completed).toBe(false);
    expect(firstTurn.session.updatedAt.toISOString()).toBe(timestamps[1].toISOString());

    const secondTurn = await engine.submitReply({
      sessionId: start.session.sessionId,
      value: "alice@example.com",
    });
    expect(secondTurn.session.collectedData).toEqual({
      "full-name": "Alicia",
      "contact-email": "alice@example.com",
    });
    expect(secondTurn.session.currentFieldId).toBe("loan-purpose");
    expect(secondTurn.nextField?.id).toBe("loan-purpose");
    expect(secondTurn.answeredField?.id).toBe("contact-email");
    expect(secondTurn.completed).toBe(false);

    const finalTurn = await engine.submitReply({
      sessionId: start.session.sessionId,
      value: "Home",
    });
    expect(finalTurn.session.collectedData).toEqual({
      "full-name": "Alicia",
      "contact-email": "alice@example.com",
      "loan-purpose": "Home",
    });
    expect(finalTurn.session.status).toBe("completed");
    expect(finalTurn.nextField).toBeNull();
    expect(finalTurn.answeredField?.id).toBe("loan-purpose");
    expect(finalTurn.completed).toBe(true);
  });

  it("validates reply ordering", async () => {
    const engine = new ConversationEngine();
    const { session } = await engine.startConversation(baseSchema);

    await expect(
      engine.submitReply({
        sessionId: session.sessionId,
        fieldId: "contact-email",
        value: "out-of-order@example.com",
      }),
    ).rejects.toThrow(
      'Expected reply for field "full-name" but received "contact-email".',
    );
  });

  it("rejects unknown sessions", async () => {
    const engine = new ConversationEngine();

    await expect(
      engine.submitReply({
        sessionId: "missing",
        value: "noop",
      }),
    ).rejects.toThrow("Session missing: missing");
  });

  it("persists only on completion when saveOnTheGo is disabled", async () => {
    const store = new RecordingStore();
    const engine = new ConversationEngine({
      store,
      idGenerator: () => "session-persist",
      clock: sequenceClock([
        baseNow,
        new Date("2025-01-01T00:00:01.000Z"),
        new Date("2025-01-01T00:00:02.000Z"),
        new Date("2025-01-01T00:00:03.000Z"),
      ]),
    });

    const { session } = await engine.startConversation(baseSchema);
    expect(store.created).toHaveLength(1);
    expect(store.updated).toHaveLength(0);

    await engine.submitReply({ sessionId: session.sessionId, value: "Alicia" });
    expect(store.updated).toHaveLength(0);

    await engine.submitReply({ sessionId: session.sessionId, value: "alice@example.com" });
    expect(store.updated).toHaveLength(0);

    await engine.submitReply({ sessionId: session.sessionId, value: "Home" });
    expect(store.updated).toHaveLength(1);
    expect(store.updated.at(-1)?.status).toBe("completed");
  });

  it("persists after each turn when saveOnTheGo is enabled", async () => {
    const store = new RecordingStore();
    const engine = new ConversationEngine({
      store,
      idGenerator: () => "session-save",
    });

    const schemaWithSave: ConversationSchema = {
      ...baseSchema,
      saveOnTheGo: true,
    };

    const { session } = await engine.startConversation(schemaWithSave);
    expect(store.created).toHaveLength(1);
    expect(store.updated).toHaveLength(1);

    await engine.submitReply({ sessionId: session.sessionId, value: "Alicia" });
    await engine.submitReply({ sessionId: session.sessionId, value: "alice@example.com" });
    await engine.submitReply({ sessionId: session.sessionId, value: "Home" });

    expect(store.updated).toHaveLength(4);
  });

  it("loads sessions from the backing store when not cached", async () => {
    const store = new RecordingStore();
    const primaryEngine = new ConversationEngine({ store, idGenerator: () => "session-shared" });

    const schemaWithSave: ConversationSchema = {
      ...baseSchema,
      saveOnTheGo: true,
    };

    const start = await primaryEngine.startConversation(schemaWithSave);
    await primaryEngine.submitReply({ sessionId: start.session.sessionId, value: "Alicia" });

    const loader = async (schemaId: string) => {
      const schema = [schemaWithSave].find((item) => item.id === schemaId);
      return schema ?? null;
    };

    const secondaryEngine = new ConversationEngine({ store, schemaLoader: loader });
    const cached = await secondaryEngine.getSession(start.session.sessionId);

    expect(cached?.sessionId).toBe(start.session.sessionId);
    expect(cached?.collectedData).toEqual({ "full-name": "Alicia" });
  });
});
