import { randomUUID } from "node:crypto";
import { ConversationField, ConversationSchema } from "../schema/conversationSchema";

export type ConversationStatus = "in_progress" | "completed" | "abandoned";

export interface ConversationSession {
  sessionId: string;
  schemaId: string;
  currentFieldId: string | null;
  status: ConversationStatus;
  collectedData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationStep {
  session: ConversationSession;
  nextField: ConversationField | null;
  answeredField: ConversationField | null;
  completed: boolean;
}

export interface SessionStore {
  create(_session: ConversationSession): Promise<void>;
  update(_session: ConversationSession): Promise<void>;
  delete(_sessionId: string): Promise<void>;
  get(_sessionId: string): Promise<ConversationSession | null>;
}

export interface ConversationEngineOptions {
  store?: SessionStore;
  schemaLoader?: (schemaId: string) => Promise<ConversationSchema | null>;
  idGenerator?: () => string;
  clock?: () => Date;
}

export interface SubmitReplyInput {
  sessionId: string;
  value: unknown;
  fieldId?: string;
}

export class ConversationEngine {
  private readonly store?: SessionStore;
  private readonly schemaLoader?: ConversationEngineOptions["schemaLoader"];
  private readonly idGenerator: () => string;
  private readonly clock: () => Date;
  private readonly schemaRegistry = new Map<string, ConversationSchema>();
  private readonly sessionCache = new Map<string, ConversationSession>();

  constructor(options: ConversationEngineOptions = {}) {
    this.store = options.store;
    this.schemaLoader = options.schemaLoader;
    this.idGenerator = options.idGenerator ?? defaultIdGenerator;
    this.clock = options.clock ?? (() => new Date());
  }

  async startConversation(
    schema: ConversationSchema,
    options?: { sessionId?: string },
  ): Promise<ConversationStep> {
    this.schemaRegistry.set(schema.id, schema);

    const now = this.clock();
    const sessionId = options?.sessionId ?? this.idGenerator();
    const firstField = schema.fields[0];

    const session: ConversationSession = {
      sessionId,
      schemaId: schema.id,
      currentFieldId: firstField.id,
      status: "in_progress",
      collectedData: {},
      createdAt: now,
      updatedAt: now,
    };

    this.sessionCache.set(sessionId, session);

    if (this.store) {
      await this.store.create(cloneSession(session));
      if (schema.saveOnTheGo) {
        await this.store.update(cloneSession(session));
      }
    }

    return {
      session: cloneSession(session),
      nextField: firstField,
      answeredField: null,
      completed: false,
    };
  }

  async submitReply(input: SubmitReplyInput): Promise<ConversationStep> {
    const session = await this.resolveSession(input.sessionId);

    if (!session) {
      throw new Error(`Session missing: ${input.sessionId}`);
    }

    const schema = await this.ensureSchema(session.schemaId);
    const currentField = this.getCurrentField(schema, session);
    const expectedFieldId = currentField.id;

    const replyFieldId = input.fieldId ?? expectedFieldId;
    if (replyFieldId !== expectedFieldId) {
      throw new Error(
        `Expected reply for field "${expectedFieldId}" but received "${replyFieldId}".`,
      );
    }

    const now = this.clock();

    const nextIndex = schema.fields.findIndex((field) => field.id === expectedFieldId) + 1;
    const nextField = schema.fields[nextIndex] ?? null;

    session.collectedData = {
      ...session.collectedData,
      [expectedFieldId]: input.value,
    };
    session.currentFieldId = nextField ? nextField.id : null;
    session.status = nextField ? "in_progress" : "completed";
    session.updatedAt = now;

    this.sessionCache.set(session.sessionId, session);

    if (this.store) {
      if (schema.saveOnTheGo || !nextField) {
        await this.store.update(cloneSession(session));
      }
    }

    return {
      session: cloneSession(session),
      nextField,
      answeredField: currentField,
      completed: !nextField,
    };
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const session = await this.resolveSession(sessionId);
    return session ? cloneSession(session) : null;
  }

  async clearSession(sessionId: string): Promise<void> {
    this.sessionCache.delete(sessionId);
    if (this.store) {
      await this.store.delete(sessionId);
    }
  }

  async getSchema(schemaId: string): Promise<ConversationSchema | null> {
    try {
      const schema = await this.ensureSchema(schemaId);
      return schema;
    } catch (error) {
      return null;
    }
  }

  private async resolveSession(sessionId: string): Promise<ConversationSession | null> {
    const cached = this.sessionCache.get(sessionId);
    if (cached) {
      return cached;
    }

    if (!this.store) {
      return null;
    }

    const stored = await this.store.get(sessionId);
    if (stored) {
      const clone = cloneSession(stored);
      this.sessionCache.set(sessionId, clone);
      return this.sessionCache.get(sessionId) ?? null;
    }

    return null;
  }

  private async ensureSchema(schemaId: string): Promise<ConversationSchema> {
    const cached = this.schemaRegistry.get(schemaId);
    if (cached) {
      return cached;
    }

    if (this.schemaLoader) {
      const loaded = await this.schemaLoader(schemaId);
      if (loaded) {
        this.schemaRegistry.set(schemaId, loaded);
        return loaded;
      }
    }

    throw new Error(`Schema not registered for id: ${schemaId}`);
  }

  private getCurrentField(schema: ConversationSchema, session: ConversationSession): ConversationField {
    if (!session.currentFieldId) {
      throw new Error("Conversation already completed.");
    }

    const field = schema.fields.find((item) => item.id === session.currentFieldId);
    if (!field) {
      throw new Error(
        `Field "${session.currentFieldId}" is not present in schema "${schema.id}".`,
      );
    }

    return field;
  }
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, ConversationSession>();

  async create(session: ConversationSession): Promise<void> {
    this.sessions.set(session.sessionId, cloneSession(session));
  }

  async update(session: ConversationSession): Promise<void> {
    this.sessions.set(session.sessionId, cloneSession(session));
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
  sessionId: session.sessionId,
  schemaId: session.schemaId,
  currentFieldId: session.currentFieldId,
  status: session.status,
  collectedData: { ...session.collectedData },
  createdAt: new Date(session.createdAt.getTime()),
  updatedAt: new Date(session.updatedAt.getTime()),
});

const defaultIdGenerator = (): string => randomUUID();
