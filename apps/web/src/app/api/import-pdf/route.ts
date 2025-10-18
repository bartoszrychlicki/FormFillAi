import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { conversationSchemaForGeneration } from "@formfillai/shared";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const isAnthropicConfigured = (): boolean =>
  typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.trim().length > 0;

interface ImportPdfRequest {
  file: {
    name: string;
    type: string;
    base64Data: string;
  };
}

const errorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const SYSTEM_PROMPT = `You are a PDF form to conversation schema converter. Your task is to analyze PDF forms (applications, surveys, registration forms, etc.) and convert them into a conversational schema that can be filled out through an AI-powered chat interface.

ALLOWED FIELD TYPES (ONLY USE THESE):
- "text" - for short answers, paragraphs, dates, times, addresses, names, descriptions
- "email" - ONLY for email address fields
- "number" - ONLY for numeric inputs (amounts, counts, measurements)
- "select" - for multiple choice, checkboxes, radio buttons (single selection only)

FIELD STRUCTURE EXAMPLES:

1. TEXT FIELD (short answer):
{
  "id": "full-name",
  "text": "What is your full name?",
  "type": "text",
  "validation": {
    "required": true,
    "min_words": 2,
    "failure_message": "Please provide your full name (first and last name)."
  },
  "ai_prompt": "Ensure the answer includes at least a first and last name. If only one name is provided, ask for the complete full name."
}

2. TEXT FIELD (address):
{
  "id": "residential-address",
  "text": "What is your residential address? Please include street, city, postal code.",
  "type": "text",
  "validation": {
    "required": true,
    "min_words": 3,
    "failure_message": "Please provide a complete address including street, city, and postal code."
  },
  "ai_prompt": "Ensure the address is complete with street, city, and postal code. If any part is missing, ask for the complete information."
}

3. EMAIL FIELD:
{
  "id": "email-address",
  "text": "What's your email address?",
  "type": "email",
  "validation": {
    "required": true,
    "failure_message": "Please provide a valid email address."
  },
  "ai_prompt": "Confirm the response is a valid email address containing '@' and a domain."
}

4. NUMBER FIELD:
{
  "id": "loan-amount",
  "text": "What loan amount are you requesting? (in PLN)",
  "type": "number",
  "validation": {
    "required": true,
    "failure_message": "Please provide the loan amount in PLN."
  },
  "ai_prompt": "Accept numeric values only. If the user provides a formatted number (e.g., '100,000'), extract the numeric value."
}

5. SELECT FIELD (for checkboxes/radio buttons):
{
  "id": "property-type",
  "text": "What type of property are you purchasing?",
  "type": "select",
  "options": [
    "Residential apartment",
    "Single-family house",
    "Garage/parking space",
    "Land plot"
  ],
  "validation": {
    "required": true,
    "failure_message": "Please select a property type."
  },
  "ai_prompt": "If the user describes the property type, match it to the closest option from the list."
}

6. OPTIONAL FIELD:
{
  "id": "additional-comments",
  "text": "Any additional comments or information you'd like to share?",
  "type": "text",
  "validation": {
    "required": false
  },
  "ai_prompt": "This is optional. Accept any additional information the user wants to provide."
}

FIELD ID RULES:
- Must be kebab-case (lowercase, hyphens only, no spaces)
- Keep concise but descriptive
- Examples: "full-name", "loan-amount", "property-type", "phone-number"

PDF FORM MAPPING GUIDELINES:

1. **Repeating Sections**: If the form has repeating sections (e.g., "Client 1", "Client 2", "Client 3"), only create fields for the FIRST instance. Add a note in the ai_prompt that additional applicants can be mentioned.

2. **Complex Grouped Data**: For grouped information (like address = street + city + postal code), create a SINGLE text field that asks for all components together.

3. **Checkboxes/Radio Buttons**: Convert to "select" type with options. If multiple checkboxes allow multiple selections in the PDF, pick the most important ones or note in ai_prompt that multiple aspects should be mentioned.

4. **Yes/No Questions**: Convert to select fields with options: ["Yes", "No"]

5. **Date Fields**: Convert to "text" type with instruction in ai_prompt to provide date in a readable format

6. **Tables/Grids**: For tables with multiple rows/columns, create focused questions for the most important data points

7. **Consents/Declarations**: Group related consents into a single question when possible, or skip purely legal acknowledgments

8. **Section Headers**: Use section information to provide context in the field text, but don't create separate fields for headers

SCHEMA TOP-LEVEL STRUCTURE:
{
  "id": "form-name-in-kebab-case",
  "welcomeMessage": "Create a welcoming message based on form title/purpose. Make it conversational and friendly.",
  "completionMessage": "Thank the user for completing the form and mention what happens next if indicated in the PDF.",
  "webhookUrl": "https://example.com/webhook",
  "saveOnTheGo": false,
  "fields": [ ...array of field objects as shown above... ]
}

CRITICAL RULES:
- ONLY use field types: text, email, number, select
- EVERY field MUST have: id, text, type, validation
- ai_prompt is OPTIONAL but HIGHLY recommended for complex fields
- validation MUST have "required" (boolean)
- Select fields MUST have "options" array with at least 2 items
- Keep the schema conversational - transform form language into natural questions
- Aim for 10-20 fields maximum - focus on the most important information
- Skip purely administrative fields (form version, internal codes, signatures)
- Make questions clear and self-contained

CONVERSATIONAL TRANSFORMATION:
- Form label: "Imię" (First name) → Question: "What is your first name?"
- Form label: "Wnioskowana kwota" → Question: "What loan amount are you requesting?"
- Form checkbox list → Select question: "Which option best describes your situation?"

Remember: The goal is to create a friendly, conversational experience that collects the same information as the PDF form but through natural dialogue.`;

export async function POST(request: Request) {
  let payload: ImportPdfRequest;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  if (!payload.file || typeof payload.file !== "object") {
    return errorResponse("file is required and must be an object.", 400);
  }

  if (!payload.file.base64Data || typeof payload.file.base64Data !== "string") {
    return errorResponse("file.base64Data is required and must be a string.", 400);
  }

  if (!payload.file.type || !payload.file.type.includes("pdf")) {
    return errorResponse("Only PDF files are supported.", 400);
  }

  if (!isAnthropicConfigured()) {
    return errorResponse(
      "Anthropic API is not configured. Set the ANTHROPIC_API_KEY environment variable.",
      503,
    );
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const analysisPrompt = `Analyze this PDF form and extract all input fields, their labels, types, and whether they appear to be required.

Focus on:
1. Input fields (text boxes, checkboxes, radio buttons, dropdowns)
2. Field labels and descriptions
3. Required field indicators (asterisks, "required" text, etc.)
4. Section organization
5. Form purpose and context

Provide a detailed analysis of the form structure that will help create a conversational schema.`;

    const analysisMessage = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: payload.file.base64Data,
              },
            },
            {
              type: "text",
              text: analysisPrompt,
            },
          ],
        },
      ],
    });

    const analysisTextContent = analysisMessage.content.find((block) => block.type === "text");
    const analysisText =
      analysisTextContent && analysisTextContent.type === "text"
        ? analysisTextContent.text
        : "No analysis available";

    const schemaGenerationPrompt = `Based on the PDF form analysis below, generate a conversation schema following the structure and rules provided in your system prompt.

Form Analysis:
${analysisText}

Generate a complete conversation schema that captures the essential information from this form in a conversational manner.`;

    const result = await generateObject({
      model: anthropic(ANTHROPIC_MODEL),
      schema: conversationSchemaForGeneration,
      system: SYSTEM_PROMPT,
      prompt: schemaGenerationPrompt,
    });

    return NextResponse.json({
      schema: result.object,
      success: true,
    });
  } catch (error) {
    console.error("PDF import error", error);
    return errorResponse(
      "Failed to generate schema from the PDF. The form structure might not be compatible.",
      500,
    );
  }
}
