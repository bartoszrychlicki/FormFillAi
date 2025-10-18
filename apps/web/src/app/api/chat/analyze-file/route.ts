import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64Data: string;
}

interface AnalyzeFileRequest {
  sessionId: string;
  file: UploadedFile;
  schemaId: string;
}

const errorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const isAiConfigured = (): boolean =>
  typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.trim().length > 0;

export async function POST(request: Request) {
  let payload: AnalyzeFileRequest;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  if (!payload.sessionId || !payload.file || !payload.schemaId) {
    return errorResponse("sessionId, file, and schemaId are required.", 400);
  }

  if (!isAiConfigured()) {
    return errorResponse(
      "AI integration is not configured. Set the ANTHROPIC_API_KEY environment variable.",
      503,
    );
  }

  try {
    const analysisPrompt = `You are FormFillAI, a helpful assistant analyzing documents for form filling.

A user just uploaded a document: "${payload.file.name}"
Form schema ID: ${payload.schemaId}

Your task:
1. Quickly scan the document and identify what type of document it is (e.g., "invoice", "resume", "form", "contract")
2. Determine if this document type is likely relevant to this form
3. Give a VERY brief 1-2 sentence response

Respond in a friendly, conversational tone. Format your response like this:

"Thanks for uploading ${payload.file.name}! I've analyzed it - it appears to be [document type]. I'll use any relevant information as we go through the form."

OR if clearly not relevant:

"Thanks for uploading ${payload.file.name}! I've analyzed it - it appears to be [document type]. This doesn't seem directly related to the form questions, but I'll keep it available in case it's useful."

Keep it SHORT and conversational. Do NOT list all the data you found.`;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: payload.file.type as "application/pdf",
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

    const textContent = message.content.find((block) => block.type === "text");
    const analysisText = textContent && textContent.type === "text" ? textContent.text : "";

    return NextResponse.json({
      analysis: analysisText.trim(),
    });
  } catch (error) {
    console.error("File analysis failed", error);
    return errorResponse("Failed to analyze the uploaded file.", 500);
  }
}
