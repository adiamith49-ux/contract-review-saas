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
// If a paragraph can't be matched, the finding is attached as a comment on the
// title paragraph instead — findings are never dropped, the doc never rebuilt.
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

const STOPWORDS = new Set([
  "the","and","for","shall","this","that","with","any","all","are","not","upon","such","from",
  "under","which","have","has","been","will","may","its","their","of","to","in","on","or","by",
  "as","be","is","it","an","a","party","parties","agreement","section","hereby","herein","thereof",
]);

// Significant (>3 char, non-stopword) unique tokens of a string
function tokenize(s: string): string[] {
  return [...new Set(
    normalizeWithMap(s).norm.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOPWORDS.has(w)),
  )];
}

// Find the paragraph that best matches the edit's original text. Uses exact
// containment first, then fuzzy token-overlap — the AI's "contractText" is often
// a paraphrase/truncation (with ellipses), so exact matching alone misses it.
function findParagraph(chunks: string[], original: string): ParaMatch | null {
  const exact = normalizeWithMap(original).norm.toLowerCase();
  const targetTokens = tokenize(original);
  if (exact.length < 8 || targetTokens.length < 3) return null;

  let best: ParaMatch | null = null;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (!c.startsWith("<w:p")) continue;
    const paraText = paragraphText(c);
    const norm = normalizeWithMap(paraText).norm.toLowerCase();
    if (norm.length < 12) continue;

    let score = 0;
    if (norm.includes(exact)) {
      score = 1; // verbatim (redline edits) — strongest
    } else if (norm.length >= 30 && exact.includes(norm)) {
      // The AI quote spans multiple paragraphs (whole section, table rows) and
      // this paragraph sits verbatim inside it — anchor here. Longer paragraphs
      // score higher so the anchor lands on the meatiest part of the quote.
      score = 0.6 + Math.min(0.3, norm.length / 500);
    } else {
      const pTokens = tokenize(paraText);
      const pSet = new Set(pTokens);
      const hit = targetTokens.filter(t => pSet.has(t)).length;
      // forward: fraction of the target's significant words present here.
      // reverse: terse paragraphs (table cells, headings) rarely contain most of
      // a long AI quote, but the quote usually contains most of THEIR words.
      const forward = hit / targetTokens.length;
      const reverse = pTokens.length >= 4 && hit >= 4 ? hit / pTokens.length : 0;
      score = Math.max(forward, reverse * 0.85) * 0.95; // cap below verbatim
    }
    if (score > (best?.score ?? 0.55)) best = { paraXml: c, index: i, score }; // need >55% overlap
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
  const trackedParagraphs = new Set<number>(); // paragraphs already rewritten as tracked changes
  const unplaced: DocxEdit[] = [];

  for (const edit of edits) {
    const match = findParagraph(chunks, edit.originalText);

    if (edit.comment && !edit.revisedText) {
      // Comment-only edits can stack — several findings may cite one paragraph
      if (!match || trackedParagraphs.has(match.index)) { unplaced.push(edit); continue; }
      const cid = idCounter++;
      comments.push({ id: cid, text: edit.comment });
      chunks[match.index] = addCommentToParagraph(chunks[match.index], cid);
      applied++;
      continue;
    }

    // replace / insert / delete as tracked changes — one per paragraph
    if (!match || trackedParagraphs.has(match.index)) { unplaced.push(edit); continue; }
    trackedParagraphs.add(match.index);
    const current = chunks[match.index];
    const ppr = extractPpr(current);
    const delId = idCounter++;
    const insId = idCounter++;
    let replacement = "";
    if (edit.editType !== "insert") replacement += makeDeletedParagraph(current, delId);
    if (edit.editType !== "delete" && edit.revisedText) replacement += makeInsertedParagraph(ppr, edit.revisedText, insId);
    if (edit.comment) {
      const cid = idCounter++;
      comments.push({ id: cid, text: edit.comment });
      replacement = addCommentToParagraph(replacement || current, cid);
    }
    chunks[match.index] = replacement || current;
    applied++;
  }

  // Findings that couldn't be anchored to their exact clause are attached as
  // comments on the first substantial paragraph (the title) instead of being
  // dropped — the document body stays untouched, so formatting is never lost.
  if (unplaced.length > 0) {
    const titleIdx = chunks.findIndex(c => c.startsWith("<w:p") && paragraphText(c).trim().length >= 4);
    if (titleIdx >= 0) {
      for (const edit of unplaced) {
        const ref = edit.originalText.replace(/\s+/g, " ").trim().slice(0, 100);
        const parts = [`Re: "${ref}${edit.originalText.length > 100 ? "…" : ""}"`];
        if (edit.comment) parts.push(edit.comment);
        if (edit.revisedText) parts.push(`Suggested revision: ${edit.revisedText}`);
        const cid = idCounter++;
        comments.push({ id: cid, text: parts.join(" — ") });
        chunks[titleIdx] = addCommentToParagraph(chunks[titleIdx], cid);
        applied++;
      }
    } else {
      skipped += unplaced.length;
    }
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
