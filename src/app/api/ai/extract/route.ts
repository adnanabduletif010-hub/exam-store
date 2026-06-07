import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const text = formData.get("text") as string | null;
    const file = formData.get("file") as File | null;
    const aiModel = (formData.get("model") as string) || "gemini-2.0-flash";

    let extractedText = "";

    if (text && text.trim().length > 0) {
      // Direct text input
      extractedText = text.trim();
    } else if (file) {
      // Only plain text files supported on Vercel (no native pdf-parse)
      const fileType = file.name.split(".").pop()?.toLowerCase();
      if (fileType === "txt") {
        extractedText = await file.text();
      } else {
        return NextResponse.json(
          { error: "Only .txt files or pasted text are supported. For PDF/DOCX, please copy-paste the text content directly." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Please provide text content or a .txt file." },
        { status: 400 }
      );
    }

    if (extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: "The content is too short. Please provide more educational text." },
        { status: 400 }
      );
    }

    // Truncate to fit Gemini token limits
    const maxLength = 60000;
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + "\n... [TRUNCATED]";
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: aiModel,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
You are an expert exam designer and educational content creator.
Read the following text extracted from academic materials and extract exactly between 5 and 15 multiple-choice questions (MCQs) that represent the core educational concepts in the text.

You MUST return ONLY a JSON array containing objects matching this schema:
[
  {
    "question": "The question text, written clearly and professionally.",
    "choices": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": 0,
    "explanation": "A simple, clear explanation of why this choice is correct based on the text."
  }
]

Educational Text:
"""
${extractedText}
"""
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const questions = JSON.parse(responseText.trim());
      if (!Array.isArray(questions)) {
        throw new Error("AI did not return a valid array.");
      }
      return NextResponse.json({ questions });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI output. Please try again." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("AI API error:", err);
    return NextResponse.json(
      { error: "Server error: " + err.message },
      { status: 500 }
    );
  }
}
