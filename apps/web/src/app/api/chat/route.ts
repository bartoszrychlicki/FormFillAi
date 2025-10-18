import { NextResponse } from "next/server";
import { generateText, LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  parseConversationSchema,
  validateFieldValue,
  type ConversationField,
  type ConversationSchema,
  type ConversationStep,
} from "@formfillai/shared";
import { getConversationEngine } from "@/lib/conversation/engine";

const isAiConfigured = (): boolean =>
  typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.trim().length > 0;

interface ChatRequest {
  sessionId?: string;
  schema?: unknown;
  schemaUrl?: string;
  reply?: {
    fieldId?: string;
    value: unknown;
  };
}

interface ChatResponse {
  sessionId: string;
  botMessage: string;
  conversationStatus: "in_progress" | "completed";
  nextField: NextFieldPayload | null;
}

interface NextFieldPayload {
  fieldId: string;
  text: string;
  type: ConversationField["type"];
  options?: string[];
}

const errorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const handleEngineError = (error: unknown) => {
  if (error instanceof Error) {
    if (error.message.startsWith("Session missing")) {
      return errorResponse(error.message, 404);
    }
    if (error.message.startsWith("Expected reply")) {
      return errorResponse(error.message, 400);
    }
  }

  console.error("Conversation progression failed", error);
  return errorResponse("Unable to process conversation turn.", 500);
};

export async function POST(request: Request) {
  let payload: ChatRequest;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  if (!isAiConfigured()) {
    return errorResponse(
      "AI integration is not configured. Set the ANTHROPIC_API_KEY environment variable to enable chat.",
      503,
    );
  }

  const engine = getConversationEngine();

  if (!payload.sessionId) {
    if (!payload.schema) {
      return errorResponse("schema is required to start a conversation.", 400);
    }

    let schema: ConversationSchema;
    try {
      schema = parseConversationSchema(payload.schema);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid schema supplied.";
      return errorResponse(message, 400);
    }

    const turn = await engine.startConversation(schema);
    const botMessage = composeIntroMessage(schema, turn.nextField);

    return NextResponse.json(
      buildResponse({
        sessionId: turn.session.sessionId,
        botMessage,
        status: turn.session.status,
        nextField: turn.nextField,
      }),
    );
  }

  if (!payload.reply || !("value" in payload.reply)) {
    return errorResponse("reply.value is required to continue the conversation.", 400);
  }
  const replyValue = payload.reply.value;

  const session = await engine.getSession(payload.sessionId);
  if (!session) {
    return errorResponse(`Session missing: ${payload.sessionId}`, 404);
  }

  if (!session.currentFieldId) {
    return errorResponse("Conversation already completed.", 400);
  }

  const schema = await engine.getSchema(session.schemaId);
  if (!schema) {
    return errorResponse("Conversation schema not found.", 500);
  }

  if (payload.reply.fieldId && payload.reply.fieldId !== session.currentFieldId) {
    return errorResponse(
      `Expected reply for field "${session.currentFieldId}" but received "${payload.reply.fieldId}".`,
      400,
    );
  }

  const currentField = schema.fields.find((field) => field.id === session.currentFieldId);
  if (!currentField) {
    return errorResponse("Expected field not present in schema.", 500);
  }

  const validationOutcome = validateFieldValue(currentField, replyValue);
  if (!validationOutcome.success) {
    const botMessage = await composeValidationFailureMessage({
      schema,
      field: currentField,
      answer: replyValue,
      validationMessage: validationOutcome.message,
    });

    return NextResponse.json(
      buildResponse({
        sessionId: session.sessionId,
        botMessage,
        status: session.status,
        nextField: currentField,
      }),
    );
  }

  const currentIndex = schema.fields.findIndex((field) => field.id === currentField.id);
  const nextFieldCandidate = currentIndex >= 0 ? (schema.fields[currentIndex + 1] ?? null) : null;

  const followUp = await generateAnswerResponse({
    schema,
    field: currentField,
    answer: validationOutcome.value,
    nextField: nextFieldCandidate,
  });

  if (followUp.status === "retry") {
    return NextResponse.json(
      buildResponse({
        sessionId: session.sessionId,
        botMessage: followUp.message,
        status: session.status,
        nextField: currentField,
      }),
    );
  }

  let turn: ConversationStep;
  try {
    turn = await engine.submitReply({
      sessionId: payload.sessionId,
      fieldId: payload.reply.fieldId,
      value: validationOutcome.value,
    });
  } catch (error) {
    return handleEngineError(error);
  }

  if (turn.completed) {
    await deliverToWebhook(schema, turn.session.sessionId, turn.session.collectedData);
    await engine.clearSession(turn.session.sessionId);
  }

  return NextResponse.json(
    buildResponse({
      sessionId: turn.session.sessionId,
      botMessage: followUp.message,
      status: turn.session.status,
      nextField: turn.nextField,
    }),
  );
}

const buildResponse = ({
  sessionId,
  botMessage,
  status,
  nextField,
}: {
  sessionId: string;
  botMessage: string;
  status: "in_progress" | "completed";
  nextField: ConversationField | null;
}): ChatResponse => ({
  sessionId,
  botMessage,
  conversationStatus: status,
  nextField: nextField ? serialiseField(nextField) : null,
});

const serialiseField = (field: ConversationField): NextFieldPayload => ({
  fieldId: field.id,
  text: field.text,
  type: field.type,
  ...(field.options ? { options: field.options } : {}),
});

const composeIntroMessage = (
  schema: ConversationSchema,
  nextField: ConversationField | null,
): string => {
  if (!nextField) {
    return schema.welcomeMessage;
  }
  return `${schema.welcomeMessage}\n\n${nextField.text}`;
};

const composeValidationFailureMessage = async ({
  schema,
  field,
  answer,
  validationMessage,
}: {
  schema: ConversationSchema;
  field: ConversationField;
  answer: unknown;
  validationMessage: string;
}): Promise<string> => {
  const prompt = createValidationFailurePrompt({
    schema,
    field,
    answer,
    validationMessage,
  });

  try {
    const result = await generateText({
      model: anthropic("claude-3-5-haiku-20241022"),
      prompt,
    });

    const text = result.text.trim();
    return text.length > 0 ? text : fallbackValidation(field, validationMessage);
  } catch (error) {
    console.error("Validation guidance prompt failed", error);
    return fallbackValidation(field, validationMessage);
  }
};

const createValidationFailurePrompt = ({
  schema,
  field,
  answer,
  validationMessage,
}: {
  schema: ConversationSchema;
  field: ConversationField;
  answer: unknown;
  validationMessage: string;
}) => {
  const guidelines = buildFieldGuidelines(field);

  return `You are FormFillAI, a concise assistant guiding users through a structured form.
Schema name: ${schema.id}
Field currently being answered: ${field.text}
Field type: ${field.type}
Validation guidelines:\n${guidelines}
User response (JSON): ${JSON.stringify(answer)}
Validation issue: ${validationMessage}

Explain briefly why the response cannot be accepted, then restate the question verbatim so the user can answer again:
${field.text}
`;
};

const fallbackFollowUp = (nextField: ConversationField): string => `Thanks! ${nextField.text}`;

const fallbackValidation = (field: ConversationField, validationMessage: string): string =>
  `${validationMessage}\n\n${field.text}`;

type FollowUpStatus = "accepted" | "retry";

interface FollowUpResult {
  status: FollowUpStatus;
  message: string;
}

const generateAnswerResponse = async ({
  schema,
  field,
  answer,
  nextField,
}: {
  schema: ConversationSchema;
  field: ConversationField;
  answer: unknown;
  nextField: ConversationField | null;
}): Promise<FollowUpResult> => {
  const prompt = buildFollowUpPrompt({ schema, field, answer, nextField });

  try {
    const result = await generateText({
      model: anthropic("claude-3-5-haiku-20241022"),
      prompt,
    });

    const parsed = parseFollowUpResponse(result.text);
    if (parsed) {
      return enforceFollowUpContract(parsed, { schema, field, nextField });
    }
    throw new Error("Follow-up response was not valid JSON.");
  } catch (error) {
    console.error("Failed to generate follow-up response", error);
    if (nextField) {
      return { status: "accepted", message: fallbackFollowUp(nextField) };
    }
    return { status: "accepted", message: schema.completionMessage };
  }
};

const buildFollowUpPrompt = ({
  schema,
  field,
  answer,
  nextField,
}: {
  schema: ConversationSchema;
  field: ConversationField;
  answer: unknown;
  nextField: ConversationField | null;
}) => {
  const guidelines = buildFieldGuidelines(field);
  const instructionForAccepted = nextField
    ? `If the response is acceptable, acknowledge it in one short sentence, then ask the next question verbatim on a new line: ${nextField.text}`
    : "If the response is acceptable and there are no further questions, acknowledge it briefly and confirm the form is complete.";

  const instructionForRetry = `If the response cannot be accepted, explain why in one short sentence and restate the current question verbatim on a new line: ${field.text}`;

  return `You are FormFillAI, a concise assistant guiding users through a structured form.
Schema name: ${schema.id}
Field just answered: ${field.text}
Field type: ${field.type}
Validation guidelines:\n${guidelines}
User response (JSON): ${JSON.stringify(answer)}

Respond with a single JSON object using this schema:
{
  "status": "accepted" | "retry",
  "message": string
}

${instructionForAccepted}
${instructionForRetry}
Output JSON only. Do not wrap it in markdown fences or include additional commentary.`;
};

const parseFollowUpResponse = (rawText: string): FollowUpResult | null => {
  const text = rawText.trim();
  let processed = text;

  if (processed.startsWith("```")) {
    const withoutFence = processed.replace(/^```[a-zA-Z]*\n?/, "");
    const fenceIndex = withoutFence.lastIndexOf("```");
    processed = fenceIndex >= 0 ? withoutFence.slice(0, fenceIndex) : withoutFence;
  }

  const extracted = extractFirstJsonObject(processed);
  if (extracted) {
    return safeParseFollowUpJson(extracted);
  }

  return null;
};

const safeParseFollowUpJson = (input: string): FollowUpResult | null => {
  try {
    const candidate = input.trimEnd();
    if (!candidate.endsWith("}")) {
      return null;
    }

    const json = JSON.parse(candidate);
    if (!json || typeof json !== "object") {
      return null;
    }

    const status = (json as { status?: string }).status;
    const message = (json as { message?: unknown }).message;

    if (
      (status === "accepted" || status === "retry") &&
      typeof message === "string" &&
      message.trim().length > 0
    ) {
      return { status, message: message.trim() };
    }
  } catch (error) {
    console.warn("Unable to parse follow-up JSON", error);
  }

  return null;
};

const extractFirstJsonObject = (input: string): string | null => {
  const start = input.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  try {
    const end = input.indexOf("}", start);
    if (end >= 0) {
      return input.slice(start, end + 1);
    }
  } catch {
    // ignore fallback failure
  }

  return null;
};

const enforceFollowUpContract = (
  result: FollowUpResult,
  {
    schema,
    field,
    nextField,
  }: {
    schema: ConversationSchema;
    field: ConversationField;
    nextField: ConversationField | null;
  },
): FollowUpResult => {
  const trimmed = result.message.trim();

  if (result.status === "accepted") {
    if (nextField) {
      return {
        status: "accepted",
        message: ensureIncludesQuestion(trimmed, nextField.text),
      };
    }

    return {
      status: "accepted",
      message: trimmed.length > 0 ? trimmed : schema.completionMessage,
    };
  }

  // retry branch
  return {
    status: "retry",
    message: ensureIncludesQuestion(trimmed, field.text),
  };
};

const ensureIncludesQuestion = (message: string, question: string): string => {
  if (normaliseWhitespace(message).includes(normaliseWhitespace(question))) {
    return message;
  }
  const separator = message.endsWith("\n") ? "" : "\n";
  return `${message}${separator}${question}`;
};

const normaliseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const buildFieldGuidelines = (field: ConversationField): string => {
  const guidelines: string[] = [];

  if (field.validation.required) {
    guidelines.push("- The user must provide a response; blank answers are not acceptable.");
  }

  if (field.validation.minWords) {
    const wordLabel = field.validation.minWords === 1 ? "word" : "words";
    guidelines.push(
      `- The response must include at least ${field.validation.minWords} ${wordLabel} before proceeding.`,
    );
  }

  if (field.aiPrompt) {
    guidelines.push(`- ${field.aiPrompt}`);
  }

  return guidelines.length > 0
    ? guidelines.join("\n")
    : "- No additional validation guidance provided; rely on the question intent.";
};

const deliverToWebhook = async (
  schema: ConversationSchema,
  sessionId: string,
  payload: Record<string, unknown>,
) => {
  try {
    await fetch(schema.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        schemaId: schema.id,
        data: payload,
      }),
    });
  } catch (error) {
    console.error("Webhook delivery failed", error);
  }
};
