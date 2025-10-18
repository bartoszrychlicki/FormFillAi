import { z } from "zod";

export const fieldTypes = ["text", "number", "email", "select"] as const;

export type ConversationFieldType = (typeof fieldTypes)[number];

export interface FieldValidation {
  required: boolean;
  failureMessage?: string;
  minWords?: number;
}

export interface ConversationField {
  id: string;
  text: string;
  type: ConversationFieldType;
  options?: string[];
  validation: FieldValidation;
  aiPrompt?: string;
}

export interface ConversationSchema {
  id: string;
  welcomeMessage: string;
  completionMessage: string;
  webhookUrl: URL;
  fields: ConversationField[];
  saveOnTheGo: boolean;
}

const fieldValidationSchema = z
  .object({
    required: z.boolean().optional(),
    failure_message: z
      .string()
      .trim()
      .min(1, "Field validation failure message cannot be empty when provided.")
      .optional(),
    min_words: z
      .number()
      .int("min_words must be an integer value.")
      .min(1, "min_words must be at least 1 when provided.")
      .optional(),
  })
  .optional();

const rawFieldSchema = z
  .object({
    id: z.string().min(1, "Field id cannot be empty."),
    text: z.string().min(1, "Field text cannot be empty."),
    type: z.string().min(1, "Field type cannot be empty."),
    options: z
      .array(z.string().trim().min(1, "Field options must be non-empty strings."))
      .optional(),
    ai_prompt: z
      .string()
      .trim()
      .min(1, "Field ai_prompt cannot be empty when provided.")
      .optional(),
    validation: fieldValidationSchema,
  })
  .strict()
  .superRefine((field, ctx) => {
    if (!fieldTypes.includes(field.type as ConversationFieldType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${field.id}" has invalid type "${field.type}": expected one of ${fieldTypes.join(", ")}.`,
      });
      return;
    }

    if ((field.type as ConversationFieldType) === "select") {
      if (!field.options || field.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field.id}" of type select must provide non-empty options.`,
        });
        return;
      }
    } else if (field.options && field.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${field.id}" of type ${field.type} must not define options.`,
      });
    }
  });

const conversationSchemaWithoutTransforms = z
  .object({
    id: z.string().min(1, "Conversation schema id cannot be empty."),
    welcomeMessage: z.string().min(1, "Welcome message cannot be empty."),
    completionMessage: z.string().min(1, "Completion message cannot be empty."),
    webhookUrl: z.string().min(1, "Webhook URL is required."),
    saveOnTheGo: z.boolean().optional(),
    fields: z
      .array(rawFieldSchema)
      .min(1, "Conversation schema must declare at least one field."),
  })
  .strict();

const normaliseField = (field: z.infer<typeof rawFieldSchema>): ConversationField => {
  const typedField = field.type as ConversationFieldType;

  const failureMessage = field.validation?.failure_message?.trim();
  const minWords = field.validation?.min_words;

  const validation: FieldValidation = {
    required: field.validation?.required ?? false,
    failureMessage: failureMessage && failureMessage.length > 0 ? failureMessage : undefined,
    minWords,
  };

  const sanitisedOptions = field.options?.map((value) => value.trim());
  const aiPrompt = field.ai_prompt?.trim();

  return {
    id: field.id,
    text: field.text,
    type: typedField,
    options: typedField === "select" ? sanitisedOptions : undefined,
    validation,
    aiPrompt: aiPrompt && aiPrompt.length > 0 ? aiPrompt : undefined,
  };
};

export const conversationSchema = conversationSchemaWithoutTransforms.transform((value) => {
  const seen = new Set<string>();

  for (const field of value.fields) {
    if (seen.has(field.id)) {
      throw new Error(`Field id "${field.id}" is duplicated. All field ids must be unique.`);
    }
    seen.add(field.id);
  }

  let webhook: URL;
  try {
    webhook = new URL(value.webhookUrl);
  } catch {
    throw new Error("Webhook URL must be a valid https endpoint.");
  }

  if (webhook.protocol !== "https:") {
    throw new Error("Webhook URL must be a valid https endpoint.");
  }

  return {
    id: value.id,
    welcomeMessage: value.welcomeMessage,
    completionMessage: value.completionMessage,
    webhookUrl: webhook,
    saveOnTheGo: value.saveOnTheGo ?? false,
    fields: value.fields.map(normaliseField),
  } satisfies ConversationSchema;
});

export function parseConversationSchema(input: unknown): ConversationSchema {
  const result = conversationSchema.safeParse(input);

  if (!result.success) {
    const [issue] = result.error.issues;
    if (issue?.message) {
      throw new Error(issue.message);
    }

    throw new Error("Invalid conversation schema provided.");
  }

  return result.data;
}

const rawFieldSchemaForGeneration = z
  .object({
    id: z
      .string()
      .min(1, "Field id cannot be empty.")
      .regex(/^[a-z0-9-]+$/, "Field id must be kebab-case (lowercase letters, numbers, hyphens only)."),
    text: z.string().min(5, "Field text must be at least 5 characters."),
    type: z.string().min(1, "Field type cannot be empty."),
    options: z
      .array(z.string().trim().min(1, "Field options must be non-empty strings."))
      .optional(),
    ai_prompt: z
      .string()
      .trim()
      .min(10, "Field ai_prompt should be descriptive (at least 10 characters).")
      .optional(),
    validation: fieldValidationSchema,
  })
  .strict()
  .superRefine((field, ctx) => {
    if (!fieldTypes.includes(field.type as ConversationFieldType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${field.id}" has invalid type "${field.type}": expected one of ${fieldTypes.join(", ")}.`,
      });
      return;
    }

    if ((field.type as ConversationFieldType) === "select") {
      if (!field.options || field.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field.id}" of type select must provide non-empty options.`,
        });
        return;
      }
    } else if (field.options && field.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${field.id}" of type ${field.type} must not define options.`,
      });
    }
  });

export const conversationSchemaForGeneration = z
  .object({
    id: z
      .string()
      .min(1, "Conversation schema id cannot be empty.")
      .regex(/^[a-z0-9-]+$/, "Schema id must be kebab-case."),
    welcomeMessage: z.string().min(10, "Welcome message should be at least 10 characters."),
    completionMessage: z.string().min(10, "Completion message should be at least 10 characters."),
    webhookUrl: z.string().url("Webhook URL must be a valid URL."),
    saveOnTheGo: z.boolean().optional(),
    fields: z
      .array(rawFieldSchemaForGeneration)
      .min(1, "Conversation schema must declare at least one field."),
  })
  .strict();
