import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PDF and Word text extraction (runs server-side only)
async function extractTextFromFile(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  if (fileType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  }

  if (
    fileType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type. Only PDF and .docx are accepted.");
}

// Attempt to fetch content from a submitted URL
async function fetchUrlContent(url: string): Promise<{
  success: boolean;
  content: string | null;
}> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return { success: false, content: null };
    }

    const text = await response.text();
    return { success: true, content: text };
  } catch {
    return { success: false, content: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let attemptId: string;
    let promptNumber: number;
    let submissionType: string;
    let initialResponseData: Record<string, unknown> = {};
    let finalResponseData: Record<string, unknown> = {};

    let uploadFile: File | null = null;
    let uploadFileType = "";

    let submittedUrl = "";
    let urlRationale = "";

    // ---------- Handle multipart form data (file uploads) ----------
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      attemptId = formData.get("attempt_id") as string;
      promptNumber = parseInt(formData.get("prompt_number") as string);
      submissionType = "file";

      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File exceeds 10MB limit" },
          { status: 400 }
        );
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Only PDF and .docx files are accepted" },
          { status: 400 }
        );
      }

      uploadFile = file;
      uploadFileType = file.type;

      initialResponseData = {
        type: "file",
        file_name: file.name,
        file_type: file.type,
        processing_status: "pending_file_processing",
      };

      // ---------- Handle JSON body (typed text or URL submission) ----------
    } else {
      const body = await request.json();

      attemptId = body.attempt_id;
      promptNumber = body.prompt_number;
      submissionType = body.submission_type; // "typed" or "url"

      if (submissionType === "typed") {
        const text = body.text?.trim();

        // Validate minimum 50 words
        const wordCount = text ? text.split(/\s+/).length : 0;
        if (wordCount < 50) {
          return NextResponse.json(
            { error: "Response must be at least 50 words" },
            { status: 400 }
          );
        }

        initialResponseData = {
          type: "typed",
          text: text,
          processing_status: "complete",
        };
      } else if (submissionType === "url") {
        const url = body.url?.trim();
        const rationale = body.rationale?.trim();

        // Validate URL format
        try {
          new URL(url);
        } catch {
          return NextResponse.json(
            { error: "Invalid URL format" },
            { status: 400 }
          );
        }

        // Validate rationale (min 50 words)
        const rationaleWordCount = rationale
          ? rationale.split(/\s+/).length
          : 0;
        if (rationaleWordCount < 50) {
          return NextResponse.json(
            { error: "Rationale must be at least 50 words" },
            { status: 400 }
          );
        }

        submittedUrl = url;
        urlRationale = rationale;

        initialResponseData = {
          type: "url",
          url: url,
          rationale: rationale,
          fetch_success: null,
          processing_status: "pending_url_fetch",
        };
      } else {
        return NextResponse.json(
          { error: "Invalid submission type" },
          { status: 400 }
        );
      }
    }

    // ---------- Store response in Supabase ----------
    // First, get the current responses for this attempt
    const { data: attempt, error: fetchError } = await supabaseAdmin
      .from("attempts")
      .select("responses")
      .eq("id", attemptId)
      .single();

    if (fetchError || !attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    let existingResponses = attempt.responses || {};

    const savePromptResponse = async (
      responseData: Record<string, unknown>,
      shouldSetCoachReviewFlag: boolean
    ) => {
      const updatedResponses = {
        ...existingResponses,
        [`prompt_${promptNumber}`]: responseData,
      };

      let updatePayload: Record<string, unknown> = {
        responses: updatedResponses,
      };

      if (shouldSetCoachReviewFlag) {
        updatePayload = {
          ...updatePayload,
          needs_coach_review: true,
        };
      }

      let { error: updateError } = await supabaseAdmin
        .from("attempts")
        .update(updatePayload)
        .eq("id", attemptId);

      // Fallback if the coach-review column is not present yet.
      if (
        updateError &&
        shouldSetCoachReviewFlag &&
        (updateError.message?.includes("needs_coach_review") ||
          updateError.message?.includes("column") ||
          updateError.message?.includes("schema cache"))
      ) {
        const fallback = await supabaseAdmin
          .from("attempts")
          .update({ responses: updatedResponses })
          .eq("id", attemptId);
        updateError = fallback.error;
      }

      if (!updateError) {
        existingResponses = updatedResponses;
      }

      return updateError;
    };

    // Persist candidate input before any external API calls.
    let updateError = await savePromptResponse(initialResponseData, false);
    if (updateError) {
      console.error("Failed to save initial response:", updateError);
      return NextResponse.json(
        { error: "Failed to save response" },
        { status: 500 }
      );
    }

    finalResponseData = initialResponseData;
    let shouldSetCoachReviewFlag = false;

    if (submissionType === "file" && uploadFile) {
      // Convert file to buffer for text extraction
      const arrayBuffer = await uploadFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text from the file
      const extractedText = await extractTextFromFile(buffer, uploadFileType);

      // Upload file to Supabase Storage
      const filePath = `${attemptId}/prompt-${promptNumber}-${uploadFile.name}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("simulation-uploads")
        .upload(filePath, buffer, {
          contentType: uploadFileType,
          upsert: true,
        });

      if (uploadError) {
        console.error("File upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload file" },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("simulation-uploads")
        .getPublicUrl(filePath);

      finalResponseData = {
        ...initialResponseData,
        file_path: filePath,
        file_url: publicUrlData.publicUrl,
        extracted_text: extractedText,
        processing_status: "complete",
      };
    }

    if (submissionType === "url" && submittedUrl && urlRationale) {
      const { success, content } = await fetchUrlContent(submittedUrl);

      if (success && content) {
        finalResponseData = {
          ...initialResponseData,
          fetch_success: true,
          fetched_content: content,
          processing_status: "complete",
        };
      } else {
        shouldSetCoachReviewFlag = true;
        finalResponseData = {
          ...initialResponseData,
          fetch_success: false,
          fetched_content: null,
          processing_status: "complete",
          coach_review_reason: "url_fetch_failed",
        };
      }
    }

    updateError = await savePromptResponse(
      finalResponseData,
      shouldSetCoachReviewFlag
    );

    if (updateError) {
      console.error("Failed to save response:", updateError);
      return NextResponse.json(
        { error: "Failed to save response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt_number: promptNumber,
      submission_type: submissionType,
    });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Your response has been saved." },
      { status: 500 }
    );
  }
}