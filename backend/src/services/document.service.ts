import {
  DetectDocumentTextCommand,
  TextractClient,
} from "@aws-sdk/client-textract";
import { fileTypeFromBuffer } from "file-type";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { config } from "../config.js";

const textract = new TextractClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const MAGIC_BYTES_MAP: Record<string, string[]> = {
  "application/pdf": ["application/pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "application/zip", // DOCX files are ZIP archives
  ],
  "application/msword": ["application/x-cfb"],
};

export async function validateFileType(buffer: Buffer, declaredMimeType: string): Promise<void> {
  if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
    throw new Error(`File type not allowed: ${declaredMimeType}`);
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) return; // Can't detect — allow through (some valid files have no magic bytes)

  const allowed = MAGIC_BYTES_MAP[declaredMimeType] ?? [];
  // DOCX: accept both application/zip (modern) and direct docx detection
  const isDocx = declaredMimeType.includes("wordprocessingml") &&
    (detected.mime === "application/zip" || detected.mime.includes("officedocument"));

  if (!isDocx && !allowed.includes(detected.mime) && detected.mime !== declaredMimeType) {
    throw new Error(`File content does not match declared type. Expected ${declaredMimeType}, got ${detected.mime}`);
  }
}

async function extractTextWithTextract(buffer: Buffer): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: buffer },
  });

  const response = await textract.send(command);
  const lines = (response.Blocks ?? [])
    .filter((b) => b.BlockType === "LINE" && b.Text)
    .map((b) => b.Text ?? "");

  return lines.join("\n").trim();
}

// Normalize extracted text so the stored canonical form is clean ASCII-compatible text.
// Applied to ALL extraction paths before any text is stored, sent to AI, or matched.
// NFKC handles the bulk of Unicode compatibility characters; explicit replacements
// catch the PDF-specific ligature codepoints that NFKC may leave untouched.
export function normalizeExtractedText(text: string): string {
  // Unicode NFKC: expands ligatures, compatibility forms, and half-width chars
  let out = text.normalize("NFKC");

  // Explicit PDF ligature fallback (NFKC should already handle these, belt-and-suspenders)
  out = out
    .replace(/ﬀ/g, "ff")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/ﬅ/g, "st")
    .replace(/ﬆ/g, "st");

  // Strip soft hyphens (invisible line-break hints left by PDF exporters)
  out = out.replace(/­/g, "");

  return out;
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value.trim());
  }

  if (mimeType === "application/pdf") {
    const data = await pdfParse(buffer);
    const text = data.text.trim();

    // Fallback to Textract if PDF appears to be a scan (no extractable text)
    if (text.length < 100) {
      try {
        return normalizeExtractedText(await extractTextWithTextract(buffer));
      } catch (err) {
        // Textract not configured or lacks permissions — return whatever text was extracted
        console.warn("Textract OCR fallback failed:", (err as Error).message);
        return normalizeExtractedText(text);
      }
    }

    return normalizeExtractedText(text);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
