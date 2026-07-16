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

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// mammoth.extractRawText flattens <w:tbl> rows into disconnected plain-text
// lines with no delimiter — a "Field | Value" table becomes two lines with
// no relationship between them. convertToHtml preserves <table>/<tr>/<td>
// structure, so we walk that and re-emit each table as GitHub-style
// "| cell | cell |" rows — still plain text (safe for the AI prompt, chat
// context, and fuzzy redline matching, all of which expect a plain string),
// but with row/column structure the frontend viewer can detect and render
// as a real <table> instead of stray paragraphs.
export function htmlToStructuredText(html: string): string {
  const blocks: string[] = [];
  let lastIndex = 0;
  const tableRe = /<table[^>]*>[\s\S]*?<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const before = stripTags(html.slice(lastIndex, m.index)).trim();
    if (before) blocks.push(before);

    const rows: string[] = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(m[0])) !== null) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(stripTags(cm[1]).replace(/\s+/g, " ").trim());
      }
      if (cells.length > 0) rows.push(`| ${cells.join(" | ")} |`);
    }
    if (rows.length > 0) blocks.push(rows.join("\n"));

    lastIndex = m.index + m[0].length;
  }
  const tail = stripTags(html.slice(lastIndex)).trim();
  if (tail) blocks.push(tail);

  return blocks.join("\n\n");
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.convertToHtml({ buffer });
    return normalizeExtractedText(htmlToStructuredText(result.value).trim());
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
