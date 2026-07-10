import PizZip from "pizzip";
import { normalizeWithMap } from "./redline.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-place DOCX editor.
//
// Applies redline edits + review comments to the ORIGINAL .docx so all original
// formatting, tables, styles, headers and numbering are preserved — because we
// only touch the specific <w:p> paragraphs being edited; everything else
// (including every table) is left byte-identical.
//
// Strategy is PARAGRAPH-LEVEL (not sub-run splitting), which is far more robust:
//   • replace edit → mark the matched paragraph deleted (<w:del> + <w:delText>)
//                    and insert a new paragraph after it (<w:ins>), reusing the
//                    original paragraph's <w:pPr> so indentation/numbering match.
//   • comment       → anchor a Word comment across the matched paragraph.
//
// If a paragraph can't be matched, the edit is skipped (never corrupts the doc).
// ─────────────────────────────────────────────────────────────────────────────

const AUTHOR = "Contralyne AI";
const DATE = "2020-01-01T00:00:00Z"; // fixed date keeps output deterministic

export interface DocxEdit {
  originalText: string;
  revisedText?: string;   // present for replace/insert
  editType: "replace" | "insert" | "delete";
  comment?: string;       // if set, add a Word comment instead of a tracked change
}

interface ParaMatch {
  paraXml: string;
  index: number;
  score: number;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Visible text of a single <w:p> paragraph (concatenate <w:t> contents)
function paragraphText(paraXml: string): string {
  const parts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(paraXml)) !== null) {
    parts.push(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  return parts.join("");
}

// Split the document body into top-level paragraph chunks. <w:p> never nests,
// so a non-greedy match is safe and preserves table paragraphs too.
function splitParagraphs(documentXml: string): { pre: string; paras: string[]; post: string } {
  const bodyOpen = documentXml.indexOf("<w:body");
  const bodyClose = documentXml.lastIndexOf("</w:body>");
  const pre = documentXml.slice(0, documentXml.indexOf(">", bodyOpen) + 1);
  const body = documentXml.slice(documentXml.indexOf(">", bodyOpen) + 1, bodyClose);
  const post = documentXml.slice(bodyClose);
  // Keep non-paragraph nodes (tables, sectPr) inline by splitting on paragraph boundaries
  const paras: string[] = [];
  const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
  let last = 0, m;
  const chunks: string[] = [];
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) chunks.push(body.slice(last, m.index)); // e.g. a <w:tbl> table block
    chunks.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < body.length) chunks.push(body.slice(last));
  return { pre, paras: chunks, post };
}

// Find the paragraph whose visible text best contains the edit's original text
function findParagraph(chunks: string[], original: string): ParaMatch | null {
  const target = normalizeWithMap(original).norm.toLowerCase();
  if (target.length < 8) return null; // too short to match reliably
  let best: ParaMatch | null = null;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (!c.startsWith("<w:p")) continue;
    const norm = normalizeWithMap(paragraphText(c)).norm.toLowerCase();
    if (!norm) continue;
    let score = 0;
    if (norm.includes(target)) score = target.length / norm.length; // full containment
    else if (target.includes(norm) && norm.length > 20) score = norm.length / target.length * 0.8;
    if (score > (best?.score ?? 0.5)) best = { paraXml: c, index: i, score };
  }
  return best;
}

// Extract <w:pPr>…</w:pPr> from a paragraph (its formatting properties)
function extractPpr(paraXml: string): string {
  const m = paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  return m ? m[0] : "";
}

// Turn a paragraph's runs into a tracked-DELETED paragraph
function makeDeletedParagraph(paraXml: string, delId: number): string {
  // Convert <w:t …>text</w:t> → <w:delText …>text</w:delText>, wrap each run in <w:del>
  let out = paraXml.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/g, (_full, attrs, inner) => {
    const innerDel = inner.replace(/<w:t(\b[^>]*)>/g, "<w:delText$1>").replace(/<\/w:t>/g, "</w:delText>");
    return `<w:del w:id="${delId}" w:author="${AUTHOR}" w:date="${DATE}"><w:r${attrs}>${innerDel}</w:r></w:del>`;
  });
  return out;
}

// Build a new tracked-INSERTED paragraph carrying the original's formatting
function makeInsertedParagraph(ppr: string, text: string, insId: number): string {
  return `<w:p>${ppr}<w:ins w:id="${insId}" w:author="${AUTHOR}" w:date="${DATE}"><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:ins></w:p>`;
}

// Anchor a comment across a paragraph
function addCommentToParagraph(paraXml: string, commentId: number): string {
  const start = `<w:commentRangeStart w:id="${commentId}"/>`;
  const end = `<w:commentRangeEnd w:id="${commentId}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${commentId}"/></w:r>`;
  // insert start after <w:pPr> (or after <w:p…>) and end before </w:p>
  const pprMatch = paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  let out = paraXml;
  if (pprMatch) {
    const at = paraXml.indexOf(pprMatch[0]) + pprMatch[0].length;
    out = paraXml.slice(0, at) + start + paraXml.slice(at);
  } else {
    out = paraXml.replace(/(<w:p\b[^>]*>)/, `$1${start}`);
  }
  out = out.replace(/<\/w:p>$/, `${end}</w:p>`);
  return out;
}

function buildCommentsXml(comments: { id: number; text: string }[]): string {
  const body = comments.map(c =>
    `<w:comment w:id="${c.id}" w:author="${AUTHOR}" w:date="${DATE}" w:initials="AI"><w:p><w:r><w:t xml:space="preserve">${xmlEscape(c.text)}</w:t></w:r></w:p></w:comment>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:comments>`;
}

/**
 * Apply edits to an original .docx buffer. Returns a new .docx buffer with the
 * original formatting intact and edits shown as Word tracked changes + comments.
 * Returns { buffer, applied, skipped }.
 */
export function editOriginalDocx(
  originalBuffer: Buffer,
  edits: DocxEdit[],
): { buffer: Buffer; applied: number; skipped: number } {
  const zip = new PizZip(originalBuffer);
  const docPath = "word/document.xml";
  let documentXml = zip.file(docPath)?.asText();
  if (!documentXml) throw new Error("document.xml not found — not a valid .docx");

  const { pre, paras, post } = splitParagraphs(documentXml);
  const chunks = [...paras];

  let idCounter = 1000;
  const comments: { id: number; text: string }[] = [];
  let applied = 0, skipped = 0;
  const usedParagraphs = new Set<number>();

  for (const edit of edits) {
    const match = findParagraph(chunks, edit.originalText);
    if (!match || usedParagraphs.has(match.index)) { skipped++; continue; }
    usedParagraphs.add(match.index);

    if (edit.comment && !edit.revisedText) {
      const cid = idCounter++;
      comments.push({ id: cid, text: edit.comment });
      chunks[match.index] = addCommentToParagraph(match.paraXml, cid);
      applied++;
      continue;
    }

    // replace / insert / delete as tracked changes
    const ppr = extractPpr(match.paraXml);
    const delId = idCounter++;
    const insId = idCounter++;
    let replacement = "";
    if (edit.editType !== "insert") replacement += makeDeletedParagraph(match.paraXml, delId);
    if (edit.editType !== "delete" && edit.revisedText) replacement += makeInsertedParagraph(ppr, edit.revisedText, insId);
    if (edit.comment) {
      const cid = idCounter++;
      comments.push({ id: cid, text: edit.comment });
      replacement = addCommentToParagraph(replacement || match.paraXml, cid);
    }
    chunks[match.index] = replacement || match.paraXml;
    applied++;
  }

  documentXml = pre + chunks.join("") + post;
  zip.file(docPath, documentXml);

  // Register comments part if any comments were added
  if (comments.length > 0) {
    zip.file("word/comments.xml", buildCommentsXml(comments));

    // content types
    const ctPath = "[Content_Types].xml";
    let ct = zip.file(ctPath)?.asText() ?? "";
    if (ct && !ct.includes("comments+xml")) {
      ct = ct.replace(/<\/Types>/, `<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>`);
      zip.file(ctPath, ct);
    }

    // document rels
    const relsPath = "word/_rels/document.xml.rels";
    let rels = zip.file(relsPath)?.asText() ?? "";
    if (rels && !rels.includes("comments.xml")) {
      const rid = `rIdComments${Date.now() % 100000}`;
      rels = rels.replace(/<\/Relationships>/, `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>`);
      zip.file(relsPath, rels);
    }
  }

  const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, applied, skipped };
}
