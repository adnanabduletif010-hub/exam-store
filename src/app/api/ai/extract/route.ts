import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { OfficeParser } from "officeparser";

export const maxDuration = 60; // Set Vercel execution timeout to 60 seconds (max for Hobby)

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
    const file = formData.get("file") as File | null;
    const aiModel = (formData.get("model") as string) || "gemini-2.0-flash";
    
    if (!file) {
      return NextResponse.json(
        { error: "No file was uploaded." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    const fileType = file.name.split(".").pop()?.toLowerCase();

    // 1. Text extraction based on file format
    if (fileType === "pdf") {
      try {
        const pdfParser = new PDFParse({ data: buffer });
        const pdfData = await pdfParser.getText();
        extractedText = pdfData.text;
      } catch (err: any) {
        console.error("PDF Parsing error:", err);
        return NextResponse.json(
          { error: "Failed to parse PDF document. " + err.message },
          { status: 500 }
        );
      }
    } else if (fileType === "docx" || fileType === "pptx") {
      try {
        // officeparser parseOffice handles docx/pptx
        const ast = await OfficeParser.parseOffice(buffer);
        extractedText = ast.toText();
      } catch (err: any) {
        console.error("Office document parsing error:", err);
        return NextResponse.json(
          { error: `Failed to parse .${fileType} document. ` + err.message },
          { status: 500 }
        );
      }
    } else if (fileType === "txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload PDF, DOCX, PPTX, or TXT." },
        { status: 400 }
      );
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: "The document contains insufficient readable text." },
        { status: 400 }
      );
    }

    // Truncate text if it is extremely long to fit Gemini token limits (e.g. max 30000 characters for speed/cost)
    const maxLength = 60000;
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + "\n... [TRUNCATED DUE TO SIZE] ...";
    }

    // 2. Initialize Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: aiModel,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = `
You are an expert exam designer and educational content creator.
Read the following text extracted from academic materials and extract exactly between 5 and 15 multiple-choice questions (MCQs) that represent the core educational concepts in the text.

You MUST return ONLY a JSON array containing objects matching this schema:
[
  {
    "question": "The question text, written clearly and professionally.",
    "choices": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": 0, // Integer index (0 to 3) representing the correct choice (0=A, 1=B, 2=C, 3=D)
    "explanation": "A simple, clear explanation of why this choice is correct based on the text."
  }
]

Educational Text:
"""
${extractedText}
"""
    `;

    // 3. Query Gemini model
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 4. Parse response JSON
    try {
      const questions = JSON.parse(responseText.trim());
      
      if (!Array.isArray(questions)) {
        throw new Error("AI did not return a valid array of questions.");
      }

      return NextResponse.json({ questions });
    } catch (parseErr: any) {
      console.error("Gemini output parsing failed. Output was:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI output into valid questions. Please try again." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Global AI API error:", err);
    return NextResponse.json(
      { error: "Server API error: " + err.message },
      { status: 500 }
    );
  }
}
