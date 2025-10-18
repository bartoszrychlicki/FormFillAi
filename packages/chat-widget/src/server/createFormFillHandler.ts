import type {
  ConversationEngine,
  ConversationSchema,
  SessionStore,
} from "@formfillai/shared";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export interface SchemaProvider {
  load(schemaId: string): Promise<ConversationSchema | null>;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface ConversationResponder {
  respond(input: {
    schema: ConversationSchema;
    fieldId: string;
    answer: unknown;
  }): Promise<{ status: "ok" | "retry"; message: string }>;
}

export interface CreateFormFillHandlerOptions {
  engine: ConversationEngine;
  schemaProvider: SchemaProvider;
  sessionStore?: SessionStore;
  webhook: WebhookConfig;
  responder: ConversationResponder;
}

export interface FormFillRequestHandler {
  (request: Request): Promise<Response>;
}

export type StartConversationRequest =
  | {
      schemaId: string;
    }
  | {
      schema: ConversationSchema;
    };

export interface ContinueConversationRequest {
  sessionId: string;
  reply: {
    fieldId?: string;
    value: unknown;
  };
}

export type FormFillRequestPayload = (
  | StartConversationRequest
  | ContinueConversationRequest
) & {
  schemaUrl?: string;
};

export interface FormFillResponsePayload {
  sessionId: string;
  botMessage: string;
  status: "in_progress" | "completed";
  nextField: {
    fieldId: string;
    text: string;
    type: string;
    options?: string[];
  } | null;
  conversationStatus?: "in_progress" | "completed";
}

export function createFormFillHandler(options: CreateFormFillHandlerOptions): FormFillRequestHandler {
  validateOptions(options);

  return async function formFillRequestHandler(request: Request): Promise<Response> {
    if (request.method && request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: {
          Allow: "POST",
        },
      });
    }

    let payload: FormFillRequestPayload | undefined;

    try {
      payload = (await request.json()) as FormFillRequestPayload;
    } catch (error) {
      return json({ error: "Invalid JSON payload" }, 400, error);
    }

    return json(
      {
        error: "createFormFillHandler is not implemented yet.",
        received: payload,
      },
      501,
    );
  };
}

function validateOptions(options: CreateFormFillHandlerOptions) {
  if (!options) {
    throw new Error("createFormFillHandler requires options.");
  }
  if (!options.engine) {
    throw new Error("createFormFillHandler requires a ConversationEngine instance.");
  }
  if (!options.schemaProvider) {
    throw new Error("createFormFillHandler requires a schemaProvider.");
  }
  if (!options.webhook?.url) {
    throw new Error("createFormFillHandler requires a webhook URL.");
  }
  if (!options.responder) {
    throw new Error("createFormFillHandler requires a conversation responder.");
  }
}

function json(body: unknown, status = 200, error?: unknown) {
  if (error) {
    globalThis.console?.error?.("FormFill handler error", error);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}
