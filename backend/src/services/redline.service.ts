import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph as DocxParagraph,
  TextRun,
  InsertedTextRun,
  DeletedTextRun,
} from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RedlineEdit {
  clause_ref: string;
  original_text: string;
  revised_text: string;
  edit_type: "replace" | "insert" | "delete";
  risk: "High" | "Medium" | "Low";
  playbook_rule: string;
  rationale: string;
}

export interface LocatedEdit extends RedlineEdit {
  matched: true;
  start: number;
  end: number;
}

export interface UnmatchedEdit extends RedlineEdit {
  matched: false;
  reason: string;
}

export type ProcessedEdit = LocatedEdit | UnmatchedEdit;

// ─── normalizeWithMap ─────────────────────────────────────────────────────────
//
// Returns:
//   norm — normalized string where:
//          • curly quotes/apostrophes → straight
//          • en/em dashes → '-'
//          • PDF ligatures expanded (fi, fl, ff, ffi, ffl)
//          • soft hyphens removed
//          • any whitespace run → single space
//          • result is trimmed
//   map  — map[j] = index in the ORIGINAL string of the j-th character of norm.
//
// Invariant: norm[j] came from original[map[j]].
// This lets us recover original offsets after an indexOf hit on norm.

export function normalizeWithMap(str: string): { norm: string; map: number[] } {
  const normChars: string[] = [];
  const map: number[] = [];
  let i = 0;
  let prevWasSpace = false;

  while (i < str.length) {
    const code = str.codePointAt(i)!;
    const ch = str[i];

    // Soft hyphen (U+00AD) — invisible line-break hint from PDFs; discard.
    if (code === 0x00AD) { i++; continue; }

    // Ellipsis (U+2026) → three dots
    if (code === 0x2026) {
      normChars.push(".", ".", ".");
      map.push(i, i, i);
      i++;
      prevWasSpace = false;
      continue;
    }

    // PDF ligatures — expand to component ASCII letters (all map to same source index)
    if (code >= 0xFB00 && code <= 0xFB06) {
      let lig: string;
      switch (code) {
        case 0xFB00: lig = "ff";  break;
        case 0xFB01: lig = "fi";  break;
        case 0xFB02: lig = "fl";  break;
        case 0xFB03: lig = "ffi"; break;
        case 0xFB04: lig = "ffl"; break;
        case 0xFB05: lig = "st";  break;
        case 0xFB06: lig = "st";  break;
        default:     lig = ch;    break;
      }
      for (const c of lig) { normChars.push(c); map.push(i); }
      i++;
      prevWasSpace = false;
      continue;
    }

    // Normalise problematic Unicode to ASCII equivalents
    let out: string;
    switch (code) {
      // Left/right single quotes, modifier apostrophes → straight apostrophe
      case 0x2018: case 0x2019: case 0x02BC: case 0x02BB:
        out = "'"; break;
      // Left/right double quotes → straight double quote
      case 0x201C: case 0x201D:
        out = '"'; break;
      // En-dash / em-dash → hyphen
      case 0x2013: case 0x2014:
        out = "-"; break;
      // Non-breaking space, narrow no-break space, thin space, BOM → regular space
      case 0x00A0: case 0x202F: case 0x2009: case 0xFEFF:
        out = " "; break;
      default:
        out = ch;
    }

    // Collapse any whitespace run into a single space
    if (/\s/.test(out)) {
      if (!prevWasSpace) {
        normChars.push(" ");
        map.push(i);            // map entry = first char of the whitespace run
        prevWasSpace = true;
      }
      i++;
      continue;
    }

    prevWasSpace = false;
    normChars.push(out);
    map.push(i);
    i++;
  }

  // Trim leading/trailing spaces from both arrays so map[0] is always a
  // non-space character's original index.
  let start = 0;
  let end = normChars.length;
  while (start < end && normChars[start] === " ") start++;
  while (end > start && normChars[end - 1] === " ") end--;

  return {
    norm: normChars.slice(start, end).join(""),
    map:  map.slice(start, end),
  };
}

// ─── Process edits against source ────────────────────────────────────────────

export function processEdits(source: string, edits: RedlineEdit[]): ProcessedEdit[] {
  // Pre-compute normalised document ONCE — used for every edit.
  const { norm: docNorm, map: docMap } = normalizeWithMap(source);

  const usedRanges: [number, number][] = [];

  return edits.map(edit => {
    const raw = edit.original_text ?? "";

    if (!raw.trim() && edit.edit_type !== "insert") {
      console.log(`[redline] MISS ${JSON.stringify(raw)} — empty original_text`);
      return { ...edit, matched: false as const, reason: "original_text is empty" };
    }

    // Normalise the target the same way (norm string only; no map needed).
    const normTgt = normalizeWithMap(raw).norm;

    if (!normTgt) {
      console.log(`[redline] MISS (blank after normalisation)`);
      return { ...edit, matched: false as const, reason: "original_text is blank after normalisation" };
    }

    // Search in normalised space — case-sensitive first, then case-insensitive.
    console.log("[diag] try:", JSON.stringify(normTgt.slice(0, 80)), "| found:", docNorm.includes(normTgt));
    let hit = docNorm.indexOf(normTgt);
    if (hit === -1) hit = docNorm.toLowerCase().indexOf(normTgt.toLowerCase());

    if (hit === -1) {
      console.log(`[redline] MISS ${JSON.stringify(raw.slice(0, 80))}`);
      return { ...edit, matched: false as const, reason: "original_text not found in source" };
    }

    // Recover original offsets using the position map.
    //   startOrig = map[hit]
    //   endOrig   = map[hit + normTgt.length - 1] + 1
    const startOrig = docMap[hit];
    const endNormIdx = hit + normTgt.length - 1;
    const endOrig = endNormIdx < docMap.length ? docMap[endNormIdx] + 1 : source.length;

    // Detect overlap with already-placed edits.
    const overlaps = usedRanges.some(([s, e]) => startOrig < e && endOrig > s);
    if (overlaps) {
      console.log(`[redline] MISS (overlap) ${JSON.stringify(raw.slice(0, 60))}`);
      return { ...edit, matched: false as const, reason: "overlaps with a previously placed edit" };
    }

    console.log(`[redline] OK   ${raw.replace(/\n/g, " ").slice(0, 60)}`);
    usedRanges.push([startOrig, endOrig]);
    return { ...edit, matched: true as const, start: startOrig, end: endOrig };
  });
}

// ─── DOCX with real tracked changes ──────────────────────────────────────────

export async function exportRedlineDocx(
  filename: string,
  source: string,
  processedEdits: ProcessedEdit[],
): Promise<Buffer> {
  const nowISO = new Date().toISOString();
  const author = "Contralyn AI";

  // Sort placed edits ascending — walk source left to right.
  const placed = processedEdits
    .filter((e): e is LocatedEdit => e.matched)
    .sort((a, b) => a.start - b.start);

  const unplaced = processedEdits.filter((e): e is UnmatchedEdit => !e.matched);

  // ── Build flat segment list ────────────────────────────────────────────────
  type Seg = { type: "text"; text: string } | { type: "edit"; edit: LocatedEdit; raw: string };
  const segs: Seg[] = [];
  let cursor = 0;

  for (const edit of placed) {
    if (edit.start > cursor) segs.push({ type: "text", text: source.slice(cursor, edit.start) });
    segs.push({ type: "edit", edit, raw: source.slice(edit.start, edit.end) });
    cursor = edit.end;
  }
  if (cursor < source.length) segs.push({ type: "text", text: source.slice(cursor) });

  // ── Convert segments → DOCX paragraphs ───────────────────────────────────
  const docParas: DocxParagraph[] = [];
  let revId = 0;
  let currentRuns: (TextRun | InsertedTextRun | DeletedTextRun)[] = [];

  function flush() {
    if (currentRuns.length > 0) {
      docParas.push(new DocxParagraph({ children: [...currentRuns] }));
      currentRuns = [];
    }
  }

  for (const seg of segs) {
    if (seg.type === "text") {
      // Double newlines = paragraph break; single newlines = inline space.
      const parts = seg.text.split(/\n\n+/);
      for (let p = 0; p < parts.length; p++) {
        if (p > 0) flush();
        const part = parts[p].replace(/\n/g, " ").trim();
        if (part) currentRuns.push(new TextRun(part));
      }
    } else {
      const { edit, raw } = seg;
      const id = revId++;

      if (edit.edit_type === "delete") {
        currentRuns.push(new DeletedTextRun({ text: raw, id, author, date: nowISO }));
      } else if (edit.edit_type === "insert") {
        currentRuns.push(new TextRun(raw));
        currentRuns.push(new InsertedTextRun({ text: ` ${edit.revised_text}`, id, author, date: nowISO, color: "0070C0" }));
      } else {
        // replace
        currentRuns.push(new DeletedTextRun({ text: raw, id, author, date: nowISO }));
        currentRuns.push(new InsertedTextRun({ text: edit.revised_text, id, author, date: nowISO, color: "0070C0" }));
      }
    }
  }
  flush();

  // Ensure the document always has at least one paragraph (even when source is empty).
  if (docParas.length === 0) {
    docParas.push(new DocxParagraph({ children: [new TextRun("(No contract text available)")] }));
  }

  // ── Unplaced-edits appendix ────────────────────────────────────────────────
  const unplacedParas: DocxParagraph[] = [];
  if (unplaced.length > 0) {
    unplacedParas.push(new DocxParagraph({ text: "" }));
    unplacedParas.push(new DocxParagraph({ text: "Unplaced Edits", heading: HeadingLevel.HEADING_1 }));
    unplacedParas.push(new DocxParagraph({
      children: [new TextRun({
        text: "These edits were generated but could not be placed because their original text was not found verbatim in the contract.",
        italics: true,
        color: "718096",
      })],
    }));

    for (const e of unplaced) {
      const col = e.risk === "High" ? "7F1D1D" : e.risk === "Medium" ? "9A3412" : "166534";
      unplacedParas.push(new DocxParagraph({
        children: [new TextRun({ text: `[${e.risk}] ${e.clause_ref}`, bold: true, color: col })],
      }));
      unplacedParas.push(new DocxParagraph(`Reason: ${e.reason}`));
      unplacedParas.push(new DocxParagraph(`Rationale: ${e.rationale}`));
      if (e.revised_text) {
        unplacedParas.push(new DocxParagraph(`Suggested language: "${e.revised_text}"`));
      }
      unplacedParas.push(new DocxParagraph({ text: "" }));
    }
  }

  // ── Build document ─────────────────────────────────────────────────────────
  const headerNote = placed.length > 0
    ? "Red strikethrough = deleted text  ·  Blue underline = inserted text. Use Word's Review tab to accept or reject changes."
    : `No tracked changes could be placed inline (${unplaced.length} unplaced edit${unplaced.length !== 1 ? "s" : ""} listed below).`;

  const doc = new Document({
    sections: [{
      children: [
        new DocxParagraph({ text: `Contract Redlines — ${filename}`, heading: HeadingLevel.TITLE }),
        new DocxParagraph({
          children: [new TextRun({ text: headerNote, italics: true, size: 18, color: "718096" })],
        }),
        new DocxParagraph({ text: "" }),
        ...docParas,
        ...unplacedParas,
        new DocxParagraph({ text: "" }),
        new DocxParagraph({
          children: [new TextRun({
            text: "AI-generated redlines are for informational purposes only and do not constitute legal advice.",
            italics: true,
            size: 18,
            color: "718096",
          })],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
