import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import FirecrawlApp from "@mendable/firecrawl-js";
import { conversationSchemaForGeneration } from "@formfillai/shared";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const isFirecrawlConfigured = (): boolean =>
  typeof process.env.FIRECRAWL_API_KEY === "string" &&
  process.env.FIRECRAWL_API_KEY.trim().length > 0;

const isAnthropicConfigured = (): boolean =>
  typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.trim().length > 0;

interface ImportFormRequest {
  url: string;
}

const errorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const SYSTEM_PROMPT = `You are a Google Forms to conversation schema converter. Convert forms to EXACTLY match the JSON structure shown in the examples below.

ALLOWED FIELD TYPES (ONLY USE THESE):
- "text" - for short answers, paragraphs, dates, times, file uploads, URLs
- "email" - ONLY for email address fields
- "number" - ONLY for numeric inputs
- "select" - for multiple choice, dropdowns (single selection only)

FIELD STRUCTURE EXAMPLES:

1. TEXT FIELD (short answer):
{
  "id": "team-name",
  "text": "What's your team name?",
  "type": "text",
  "validation": {
    "required": true,
    "failure_message": "Please share your team name so we can properly credit your submission."
  },
  "ai_prompt": "Accept any team name the user provides. If they're unsure, encourage them to choose a name for their team."
}

2. TEXT FIELD (with min_words for longer responses):
{
  "id": "team-lead-name",
  "text": "Who's your team lead - Full name? (Team member 1)",
  "type": "text",
  "validation": {
    "required": true,
    "min_words": 2,
    "failure_message": "Please provide the team lead's full name, including both first and last name."
  },
  "ai_prompt": "Ensure the answer includes at least a first and last name. If only one name is provided, ask for the complete full name."
}

3. EMAIL FIELD:
{
  "id": "team-lead-email",
  "text": "What's your team lead's email?",
  "type": "email",
  "validation": {
    "required": true,
    "failure_message": "Please provide a valid email address for the team lead."
  },
  "ai_prompt": "Confirm the response is a valid email address containing '@' and a domain. If it's formatted incorrectly, explain the issue and ask them to try again."
}

4. SELECT FIELD (dropdown/multiple choice):
{
  "id": "team-size",
  "text": "Number of people on your team?",
  "type": "select",
  "options": [
    "1",
    "2",
    "3",
    "4",
    "More (not eligible for winning & prizes)"
  ],
  "validation": {
    "required": true,
    "failure_message": "Please select the number of team members."
  },
  "ai_prompt": "If the user provides a number, match it to the closest option."
}

5. OPTIONAL FIELD:
{
  "id": "additional-feedback",
  "text": "Anything else? Any quick feedback?",
  "type": "text",
  "validation": {
    "required": false
  },
  "ai_prompt": "This is completely optional. Accept any feedback, suggestions, or additional comments the user wants to share."
}

FIELD ID RULES:
- Must be kebab-case (lowercase, hyphens only, no spaces)
- Example: "What's your email?" → "email" or "your-email"
- Keep concise but descriptive

GOOGLE FORMS MAPPING:
- "Short answer" / "Short-answer text" → type: "text"
- "Paragraph" / "Long answer" → type: "text" (add min_words: 10 if substantive answer expected)
- "Email" → type: "email"
- "Number" → type: "number"
- "Multiple choice" / "Dropdown" → type: "select" (extract ALL options exactly as shown)
- "Checkboxes" → type: "select" (pick ONLY the first option or most relevant, note in ai_prompt: "Original was multi-select")
- Linear scale / Date / Time / File upload → type: "text"

REQUIRED DETECTION:
- If Google Forms field has asterisk (*) → validation.required: true
- Otherwise → validation.required: false

SCHEMA TOP-LEVEL STRUCTURE:
{
  "id": "form-name-in-kebab-case",
  "welcomeMessage": "Use form title/description, make it welcoming and conversational",
  "completionMessage": "Thank the user for completing the form",
  "webhookUrl": "https://example.com/webhook",
  "saveOnTheGo": false,
  "fields": [ ...array of field objects as shown above... ]
}

CRITICAL RULES:
- ONLY use field types: text, email, number, select
- EVERY field MUST have: id, text, type, validation
- ai_prompt is OPTIONAL but recommended
- validation MUST have "required" (boolean)
- Select fields MUST have "options" array with at least 2 items
- NO EXTRA FIELDS beyond the structure shown
- Skip form sections, titles, decorative elements - ONLY convert actual input fields`;

export async function POST(request: Request) {
  let payload: ImportFormRequest;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  if (!payload.url || typeof payload.url !== "string") {
    return errorResponse("url is required and must be a string.", 400);
  }

  if (!isFirecrawlConfigured()) {
    return errorResponse(
      "Firecrawl is not configured. Set the FIRECRAWL_API_KEY environment variable.",
      503,
    );
  }

  if (!isAnthropicConfigured()) {
    return errorResponse(
      "Anthropic API is not configured. Set the ANTHROPIC_API_KEY environment variable.",
      503,
    );
  }

  let markdown: string;

  try {
    const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

    const scrapeResult = await firecrawl.scrape(payload.url, {
      formats: ["markdown"],
    });

    if (!scrapeResult.markdown) {
      console.error("Firecrawl scraping failed - no markdown returned", scrapeResult);
      return errorResponse("Failed to scrape the form URL. Please ensure it's a valid Google Forms link.", 500);
    }

    markdown = scrapeResult.markdown;
  } catch (error) {
    console.error("Firecrawl error", error);
    return errorResponse("Failed to scrape the form. Please check the URL and try again.", 500);
  }

  try {
    const result = await generateObject({
      model: anthropic(ANTHROPIC_MODEL),
      schema: conversationSchemaForGeneration,
      system: SYSTEM_PROMPT,
      prompt: `Convert this Google Form to a conversation schema:\n\n${markdown}`,
    });

    return NextResponse.json({
      schema: result.object,
      success: true,
    });
  } catch (error) {
    console.error("AI generation error", error);
    return errorResponse(
      "Failed to generate schema from the form. The form structure might not be compatible.",
      500,
    );
  }
}
