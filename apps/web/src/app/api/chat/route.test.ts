import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { parseConversationSchema } from "@formfillai/shared";
import { resetConversationEngine } from "@/lib/conversation/engine";
import { POST } from "./route";

jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

jest.mock("@ai-sdk/openai", () => ({
  openai: jest.fn(() => ({ providerId: "openai", id: "mock-model" })),
}));

const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>;
const mockedOpenAI = openai as jest.MockedFunction<typeof openai>;

const acceptMessage = (message: string) => ({
  text: JSON.stringify({ status: "accepted", message }),
});

const retryMessage = (message: string) => ({
  text: JSON.stringify({ status: "retry", message }),
});

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/chat", () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
  });

  beforeEach(() => {
    resetConversationEngine();
    mockedGenerateText.mockReset();
    mockedGenerateText.mockResolvedValue(acceptMessage("Acknowledged. Please continue."));
    mockedOpenAI.mockClear();
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("starts a conversation and returns the first prompt", async () => {
    const response = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    expect(response.status).toBe(200);

    const payload = await response.json();

    expect(typeof payload.sessionId).toBe("string");
    expect(payload.conversationStatus).toBe("in_progress");
    expect(payload.botMessage).toContain("loan intake");
    expect(payload.nextField).toMatchObject({ fieldId: "full-name", type: "text" });
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it("returns an error when the OpenAI API key is missing", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;

      const response = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
      expect(response.status).toBe(503);

      const payload = await response.json();
      expect(payload.error).toContain("OPENAI_API_KEY");
    } finally {
      if (originalKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalKey;
      }
    }
  });

  it("advances the conversation and asks the next question via AI", async () => {
    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage("Thanks Alicia. What's your best email?\nWhich email address should we use for updates?"),
    );

    const response = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "full-name", value: "Alicia Example" },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.botMessage).toContain("Thanks Alicia");
    expect(payload.nextField).toMatchObject({ fieldId: "contact-email" });
    expect(mockedGenerateText).toHaveBeenCalledTimes(1);
    const [{ prompt }] = mockedGenerateText.mock.calls[0];
    expect(prompt).toContain("full legal name");
    expect(prompt).toContain("Alicia Example");
    expect(prompt).toContain("Validation guidelines");
  });

  it("requires a full legal name before advancing to the next field", async () => {
    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

    mockedGenerateText.mockResolvedValueOnce({
      text: "It seems you only shared a first name. Could you provide your full legal name, including first and last?\n\nWhat's your full legal name?",
    });

    const invalidNameResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "full-name", value: "Tomek" },
      }),
    );

    expect(invalidNameResponse.status).toBe(200);
    const invalidPayload = await invalidNameResponse.json();
    expect(invalidPayload.nextField).toMatchObject({ fieldId: "full-name" });
    expect(invalidPayload.botMessage).toContain("full legal name");

    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage(
        "Thanks Tomek Kowalski. Which email address should we use for updates?\nWhich email address should we use for updates?",
      ),
    );

    const validNameResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "full-name", value: "Tomek Kowalski" },
      }),
    );

    expect(validNameResponse.status).toBe(200);
    const validPayload = await validNameResponse.json();
    expect(validPayload.nextField).toMatchObject({ fieldId: "contact-email" });
    expect(mockedGenerateText).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid answers and re-asks the same question", async () => {
    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage(
        "Great to meet you, Alex. What's your email?\nWhich email address should we use for updates?",
      ),
    );

    const nameResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "full-name", value: "Alex Applicant" },
      }),
    );
    expect(nameResponse.status).toBe(200);

    mockedGenerateText.mockResolvedValueOnce({
      text: "That email looks off. Could you share it in the format name@example.com?\n\nWhich email address should we use for updates?",
    });

    const invalidEmailResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "contact-email", value: "alex-at-example" },
      }),
    );

    expect(invalidEmailResponse.status).toBe(200);
    const invalidPayload = await invalidEmailResponse.json();
    expect(invalidPayload.conversationStatus).toBe("in_progress");
    expect(invalidPayload.nextField).toMatchObject({ fieldId: "contact-email" });
    expect(invalidPayload.botMessage).toContain("email looks off");

    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage("Thanks! How much funding are you looking for?\nHow much funding are you looking for?"),
    );

    const validEmailResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "contact-email", value: "alex@applicant.test" },
      }),
    );

    expect(validEmailResponse.status).toBe(200);
    const validPayload = await validEmailResponse.json();
    expect(validPayload.nextField).toMatchObject({ fieldId: "requested-amount" });
    expect(mockedGenerateText).toHaveBeenCalledTimes(3);

    const calls = mockedGenerateText.mock.calls;
    const validationCall = calls.at(1) ?? [];
    const acknowledgementCall = calls.at(2) ?? [];
    const [validationArgs] = validationCall;
    const [acknowledgementArgs] = acknowledgementCall;

    expect(validationArgs?.prompt).toContain("Validation issue");
    expect(validationArgs?.prompt).toContain("Which email address should we use for updates?");
    expect(acknowledgementArgs?.prompt).toContain("Validation guidelines");
  });

  it("completes the conversation and posts to the webhook", async () => {
    const schema = parsedLoanIntakeSchema;

    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

  const answers = {
    "full-name": "Alex Applicant",
    "contact-email": "alex@applicant.test",
    "requested-amount": 45000,
    "loan-purpose": "Home improvements",
  } as const;

    mockedGenerateText.mockReset();

  for (let i = 0; i < schema.fields.length; i += 1) {
    const field = schema.fields[i];
    const isLast = i === schema.fields.length - 1;
    const nextField = schema.fields[i + 1] ?? null;

    if (nextField) {
      mockedGenerateText.mockResolvedValueOnce(
        acceptMessage(`Thanks for that update.\n${nextField.text}`),
      );
    } else {
      mockedGenerateText.mockResolvedValueOnce(acceptMessage(schema.completionMessage));
    }

    const response = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: field.id, value: answers[field.id as keyof typeof answers] },
        }),
      );

      const payload = await response.json();

      if (isLast) {
        expect(payload.conversationStatus).toBe("completed");
        expect(payload.nextField).toBeNull();
        expect(payload.botMessage).toBe(schema.completionMessage);
      } else {
        expect(payload.conversationStatus).toBe("in_progress");
      }
  }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(schema.webhookUrl, expect.any(Object));

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      sessionId,
      schemaId: schema.id,
      data: answers,
    });
  });

  it("returns 400 when schema is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("guards against out-of-order replies", async () => {
    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

    const response = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "loan-purpose", value: "Vehicle" },
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain('Expected reply for field "full-name"');
  });

  it("keeps the conversation on the same field when the AI requests a retry", async () => {
    const startResponse = await POST(jsonRequest({ schema: loanIntakeSchemaDefinition }));
    const { sessionId } = await startResponse.json();

    mockedGenerateText.mockReset();
    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage(
        "Thanks Alex Applicant. What's the best email?\nWhich email address should we use for updates?",
      ),
    );

    const nameResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "full-name", value: "Alex Applicant" },
      }),
    );
    expect(nameResponse.status).toBe(200);

    mockedGenerateText.mockResolvedValueOnce(
      retryMessage(
        "That email looks off. Please share it in the format name@example.com.\nWhich email address should we use for updates?",
      ),
    );

    const retryResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "contact-email", value: "alex@applicant.test" },
      }),
    );

    expect(retryResponse.status).toBe(200);
    const retryPayload = await retryResponse.json();
    expect(retryPayload.nextField).toMatchObject({ fieldId: "contact-email" });
    expect(retryPayload.botMessage).toContain("email looks off");

    mockedGenerateText.mockResolvedValueOnce(
      acceptMessage("Thanks! How much funding are you looking for?\nHow much funding are you looking for?"),
    );

    const validEmailResponse = await POST(
      jsonRequest({
        sessionId,
        reply: { fieldId: "contact-email", value: "alex@applicant.test" },
      }),
    );

    expect(validEmailResponse.status).toBe(200);
    const validPayload = await validEmailResponse.json();
    expect(validPayload.nextField).toMatchObject({ fieldId: "requested-amount" });
  });
});
const loanIntakeSchemaDefinition = {
  id: "loan-intake",
  welcomeMessage: "Hi there! I'm here to guide you through the loan intake.",
  completionMessage: "Perfect, thanks! We'll follow up shortly with next steps.",
  webhookUrl: "https://example.com/webhooks/loan-intake",
  saveOnTheGo: false,
  fields: [
    {
      id: "full-name",
      text: "What's your full legal name?",
      type: "text",
      validation: {
        required: true,
        min_words: 2,
        failure_message:
          "Please provide your full legal name, including both first and last name.",
      },
      ai_prompt:
        "Only accept answers that include at least a first and last name. If the reply is too short or a single word, ask for the complete legal name before moving on.",
    },
    {
      id: "contact-email",
      text: "Which email address should we use for updates?",
      type: "email",
      validation: {
        required: true,
        failure_message:
          "That doesn't look like a valid email. Please reply with an address such as name@example.com.",
      },
      ai_prompt:
        "Confirm the response is a real email address containing '@' and a domain. If it is missing parts or formatted incorrectly, explain what is wrong and ask them to try again before you proceed.",
    },
    {
      id: "requested-amount",
      text: "How much funding are you looking for?",
      type: "number",
      validation: {
        required: true,
        failure_message:
          "Please share the amount using numbers (you can optionally use k/m/b for thousands, millions, or billions).",
      },
      ai_prompt:
        "Translate shorthand like 200k or 1.5m into a numeric USD amount. If the user mentions a different currency or gives a non-numeric description, confirm the USD amount before asking the next question.",
    },
    {
      id: "loan-purpose",
      text: "What will you use the funds for? Choose one of the options below.",
      type: "select",
      options: [
        "Home improvements",
        "Debt consolidation",
        "Vehicle",
        "Other",
      ],
      validation: {
        required: true,
        failure_message: "Please choose one of the listed purposes so we can continue.",
      },
      ai_prompt:
        "If the response does not match one of the provided options, ask the user to pick from the list. If they attempt to revise an earlier answer instead, clarify which question they want to update before moving forward.",
    },
  ],
} as const;

const parsedLoanIntakeSchema = parseConversationSchema(loanIntakeSchemaDefinition);
