import { parseConversationSchema } from "./conversationSchema";

describe("parseConversationSchema", () => {
  const baseSchema = {
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
        ai_prompt: "Prefer a polite tone and confirm spelling if unsure.",
      },
      {
        id: "contact-email",
        text: "What's the best email to reach you at?",
        type: "email",
      },
      {
        id: "loan-purpose",
        text: "What will you use the loan for?",
        type: "select",
        options: ["Home", "Auto", "Consolidation"],
      },
    ],
  } as const;

  it("normalizes a valid schema", () => {
    const parsed = parseConversationSchema(baseSchema);

    expect(parsed).toEqual({
      id: "loan-intake",
      welcomeMessage: "Hi there! Let's get started.",
      completionMessage: "Thanks for sharing your details.",
      assistantContext: undefined,
      webhookUrl: new URL("https://example.com/webhook"),
      saveOnTheGo: false,
      fields: [
        {
          id: "full-name",
          text: "What is your full name?",
          type: "text",
          validation: { required: true, failureMessage: undefined, minWords: undefined },
          aiPrompt: "Prefer a polite tone and confirm spelling if unsure.",
        },
        {
          id: "contact-email",
          text: "What's the best email to reach you at?",
          type: "email",
          validation: { required: false, failureMessage: undefined, minWords: undefined },
          aiPrompt: undefined,
        },
        {
          id: "loan-purpose",
          text: "What will you use the loan for?",
          type: "select",
          options: ["Home", "Auto", "Consolidation"],
          validation: { required: false, failureMessage: undefined, minWords: undefined },
          aiPrompt: undefined,
        },
      ],
    });
  });

  it("trims assistant context and drops empty values", () => {
    const parsed = parseConversationSchema({
      ...baseSchema,
      assistantContext: "  Be a warm and encouraging teammate.  ",
    });

    expect(parsed.assistantContext).toBe("Be a warm and encouraging teammate.");

    const parsedEmpty = parseConversationSchema({
      ...baseSchema,
      assistantContext: "   ",
    });

    expect(parsedEmpty.assistantContext).toBeUndefined();
  });

  it("throws when a field type is unknown", () => {
    expect(() =>
      parseConversationSchema({
        ...baseSchema,
        fields: [
          {
            id: "bad",
            text: "??",
            type: "not-real",
          },
        ],
      } as unknown),
    ).toThrow('Field "bad" has invalid type "not-real": expected one of text, number, email, select.');
  });

  it("requires select options", () => {
    expect(() =>
      parseConversationSchema({
        ...baseSchema,
        fields: [
          {
            id: "loan-purpose",
            text: "Pick one",
            type: "select",
          },
        ],
      }),
    ).toThrow('Field "loan-purpose" of type select must provide non-empty options.');
  });

  it("rejects duplicated field identifiers", () => {
    expect(() =>
      parseConversationSchema({
        ...baseSchema,
        fields: [
          baseSchema.fields[0],
          baseSchema.fields[0],
        ],
      }),
    ).toThrow('Field id "full-name" is duplicated. All field ids must be unique.');
  });

  it("enforces https webhook endpoints", () => {
    expect(() =>
      parseConversationSchema({
        ...baseSchema,
        webhookUrl: "http://insecure.example.com",
      }),
    ).toThrow('Webhook URL must be a valid https endpoint.');
  });

  it("requires at least one field", () => {
    expect(() =>
      parseConversationSchema({
        ...baseSchema,
        fields: [],
      }),
    ).toThrow('Conversation schema must declare at least one field.');
  });
});
