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
  /** 1 = verbatim hit; below that the anchor was recovered by word alignment. */
  confidence: number;
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

// ─── Word-token index ────────────────────────────────────────────────────────
//
// Verbatim `indexOf` on the normalised text is the fast path, but it only fires
// when the model quoted the clause character-perfectly. It routinely doesn't —
// it drops a stray "(a)", changes "Sec." to "Section", or re-quotes from memory
// a word or two off. Matching on WORDS instead of characters absorbs all of
// that: punctuation stops mattering, and a greedy alignment tolerates a handful
// of inserted/dropped words while still yielding exact character offsets for
// the span that was actually found.

interface Token {
  /** lowercased word */
  t: string;
  /** offsets into the NORMALISED string */
  s: number;
  e: number;
}

function tokenize(norm: string): Token[] {
  const toks: Token[] = [];
  const re = /[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    toks.push({ t: m[0].toLowerCase(), s: m.index, e: m.index + m[0].length });
  }
  return toks;
}

function buildTokenIndex(toks: Token[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  for (let i = 0; i < toks.length; i++) {
    const at = idx.get(toks[i].t);
    if (at) at.push(i);
    else idx.set(toks[i].t, [i]);
  }
  return idx;
}

// Greedy alignment of tgt against doc[start…]. Allows a word to be skipped on
// either side, which is what "the model dropped/added a word" looks like.
// Returns how many target words were matched and how much of doc was consumed.
function align(doc: Token[], start: number, limit: number, tgt: Token[]): { hits: number; consumed: number } {
  let i = 0, j = 0, hits = 0, lastHit = 0;
  while (i < limit && j < tgt.length) {
    if (doc[start + i].t === tgt[j].t) {
      hits++; i++; j++; lastHit = i;
    } else if (i + 1 < limit && doc[start + i + 1].t === tgt[j].t) {
      i++;                                    // doc has an extra word
    } else if (j + 1 < tgt.length && doc[start + i].t === tgt[j + 1].t) {
      j++;                                    // target has an extra word
    } else {
      i++; j++;                               // substitution
    }
  }
  return { hits, consumed: lastHit };
}

/**
 * Locate `tgtToks` inside `docToks`, returning normalised-space offsets.
 * Anchors on the RAREST target word so candidate windows stay few even when the
 * clause opens with "the" or "Party".
 */
function locateTokens(
  docToks: Token[],
  docIdx: Map<string, number[]>,
  tgtToks: Token[],
): { s: number; e: number; confidence: number } | null {
  const n = tgtToks.length;
  if (n === 0) return null;

  // Pick the anchor: the target word with the fewest occurrences in the doc.
  let anchorAt = -1;
  let anchorPositions: number[] = [];
  for (let j = 0; j < n; j++) {
    const positions = docIdx.get(tgtToks[j].t);
    if (!positions || positions.length === 0) continue;
    if (anchorAt === -1 || positions.length < anchorPositions.length) {
      anchorAt = j;
      anchorPositions = positions;
    }
  }
  if (anchorAt === -1) return null;           // not one word of it is in the doc

  // A very common anchor means a very expensive scan for no extra accuracy.
  const candidates = anchorPositions.length > 4000 ? anchorPositions.slice(0, 4000) : anchorPositions;

  // Short quotes get no fuzz — a 3-word window matches half the document.
  const threshold = n < 6 ? 1 : 0.75;

  let best: { s: number; e: number; confidence: number } | null = null;

  for (const pos of candidates) {
    const start = pos - anchorAt;
    if (start < 0 || start >= docToks.length) continue;

    // Allow the doc window to run a little past the target length to absorb
    // words the model dropped.
    const limit = Math.min(n + 4, docToks.length - start);
    const { hits, consumed } = align(docToks, start, limit, tgtToks);
    if (consumed === 0) continue;

    const confidence = hits / n;
    if (confidence < threshold) continue;
    if (best && confidence <= best.confidence) continue;

    best = {
      s: docToks[start].s,
      e: docToks[start + consumed - 1].e,
      confidence,
    };
    if (confidence === 1) break;              // can't do better
  }

  return best;
}

// ─── Process edits against source ────────────────────────────────────────────

export function processEdits(source: string, edits: RedlineEdit[]): ProcessedEdit[] {
  // Pre-compute the normalised document and its token index ONCE — reused for
  // every edit, so a 30-edit "Apply All" costs one pass over the contract.
  const { norm: docNorm, map: docMap } = normalizeWithMap(source);
  const docNormLower = docNorm.toLowerCase();
  const docToks = tokenize(docNorm);
  const docIdx = buildTokenIndex(docToks);

  // Track placed spans alongside the clause that claimed them, so an edit that
  // loses a collision can say which finding beat it to that text.
  const usedRanges: { start: number; end: number; clause: string }[] = [];

  return edits.map(edit => {
    const raw = edit.original_text ?? "";

    if (!raw.trim() && edit.edit_type !== "insert") {
      return { ...edit, matched: false as const, reason: "no contract text was quoted for this finding" };
    }

    const normTgt = normalizeWithMap(raw).norm;
    if (!normTgt) {
      return { ...edit, matched: false as const, reason: "quoted text is blank after normalisation" };
    }

    let normStart: number;
    let normEnd: number;                      // exclusive, in normalised space
    let confidence: number;

    // Fast path — the model quoted it verbatim.
    let hit = docNorm.indexOf(normTgt);
    if (hit === -1) hit = docNormLower.indexOf(normTgt.toLowerCase());

    if (hit !== -1) {
      normStart = hit;
      normEnd = hit + normTgt.length;
      confidence = 1;
    } else {
      // Word-alignment path — survives paraphrase-level drift.
      const located = locateTokens(docToks, docIdx, tokenize(normTgt));
      if (!located) {
        return {
          ...edit,
          matched: false as const,
          reason: "the quoted clause text does not appear in this contract — it looks paraphrased rather than copied",
        };
      }
      normStart = located.s;
      normEnd = located.e;
      confidence = located.confidence;
    }

    // Recover ORIGINAL offsets through the position map.
    const startOrig = docMap[normStart];
    const endOrig = normEnd - 1 < docMap.length ? docMap[normEnd - 1] + 1 : source.length;

    if (startOrig === undefined || endOrig <= startOrig) {
      return { ...edit, matched: false as const, reason: "matched text could not be mapped back to the contract" };
    }

    // Tracked changes cannot nest, so the first claim on a span wins.
    const clash = usedRanges.find(r => startOrig < r.end && endOrig > r.start);
    if (clash) {
      return {
        ...edit,
        matched: false as const,
        reason: `targets the same text as "${clash.clause}", which was redlined first`,
      };
    }

    usedRanges.push({ start: startOrig, end: endOrig, clause: edit.clause_ref });
    return { ...edit, matched: true as const, start: startOrig, end: endOrig, confidence };
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
