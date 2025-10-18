import { promises as fs } from "node:fs";
import path from "node:path";

import { parseConversationSchema, type ConversationSchema } from "@formfillai/shared";

export interface SchemaPreviewField {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface SchemaPreview {
  id: string;
  schemaUrl: string;
  welcomeMessage: string;
  completionMessage: string;
  webhookUrl: string;
  fieldCount: number;
  fields: SchemaPreviewField[];
}

const PUBLIC_PREFIX = "/schemas";

const resolveSchemaDirectory = async (): Promise<string | null> => {
  const candidates = [
    path.join(process.cwd(), "public", "schemas"),
    path.join(process.cwd(), "apps", "web", "public", "schemas"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // ignore and keep looking
    }
  }

  return null;
};

export async function loadSchemaCatalog(): Promise<SchemaPreview[]> {
  const directory = await resolveSchemaDirectory();
  if (!directory) {
    console.warn("Unable to locate schema directory. Checked public/schemas and apps/web/public/schemas.");
    return [];
  }

  let entries: string[] = [];
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    console.warn("Schema catalog directory unreadable", error);
    return [];
  }

  const schemas: SchemaPreview[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(directory, entry);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const definition = JSON.parse(raw) as unknown;
      const schema = parseConversationSchema(definition);
      schemas.push(toPreview(schema, `${PUBLIC_PREFIX}/${entry}`));
    } catch (error) {
      console.error(`Failed to load schema from ${entry}`, error);
    }
  }

  return schemas.sort((a, b) => a.id.localeCompare(b.id));
}

const toPreview = (schema: ConversationSchema, schemaUrl: string): SchemaPreview => ({
  id: schema.id,
  schemaUrl,
  welcomeMessage: schema.welcomeMessage,
  completionMessage: schema.completionMessage,
  webhookUrl: schema.webhookUrl.toString(),
  fieldCount: schema.fields.length,
  fields: schema.fields.map((field) => ({
    id: field.id,
    text: field.text,
    type: field.type,
    required: field.validation.required,
    options: field.options,
  })),
});
