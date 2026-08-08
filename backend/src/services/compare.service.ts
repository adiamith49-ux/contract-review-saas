// Paragraph-level version diff for contract drafts.
// No external dependency — a Myers-style LCS over normalized paragraphs,
// then a similarity pass to reclassify adjacent add/delete pairs as "modified".

export type DiffType = "added" | "deleted" | "modified" | "unchanged";

/** One run of text inside a modified block: unchanged, or added/removed words. */
export interface DiffPart {
  t: string;
  c: "same" | "del" | "add";
}

export interface DiffBlock {
  type: DiffType;
  base?: string;      // paragraph from the base (prior) version
  compared?: string;  // paragraph from the compared (new) version
  /**
   * This unit started a new paragraph in the uploaded document. Diffing happens
   * at sentence level for accuracy, but the reader wants the contract to look
   * like the contract — this is what lets the viewer re-flow sentences back into
   * the original paragraphs instead of showing one box per sentence.
   */
  para?: boolean;
  // Word-level breakdown, present on "modified" blocks only. Without this a
  // reworded clause is just two walls of text and the reader has to spot the
  // difference by eye.
  baseParts?: DiffPart[];
  comparedParts?: DiffPart[];
}

export interface DiffResult {
  blocks: DiffBlock[];
  added: number;
  deleted: number;
  modified: number;
}

// Above this, a "paragraph" is really a whole page and gets split further.
// PDF extraction produces almost no blank lines, so blank-line splitting alone
// yielded 7,500-char units on a real contract — and two 7,500-char units are
// never byte-identical, so the LCS matched nothing: every page came back as a
// delete plus an add, with zero unchanged and zero modified blocks.
const MAX_UNIT_CHARS = 400;

// Sentence boundary: terminator + space + capital/digit, not splitting common
// legal abbreviations or numbered references like "Section 12.2".
function splitSentences(block: string): string[] {
  return block
    .split(/(?<=[.;:!?])\s+(?=["'(]?[A-Z0-9])/)
    .reduce<string[]>((acc, s) => {
      const prev = acc[acc.length - 1];
      // Re-join fragments left by "No." / "Inc." / a bare numeral.
      if (prev && /\b(?:No|Inc|Ltd|Corp|Co|e\.g|i\.e|vs|Art|Sec|para)\.$|\b\d+\.$/i.test(prev)) {
        acc[acc.length - 1] = `${prev} ${s}`;
      } else acc.push(s);
      return acc;
    }, [])
    .map(s => s.trim())
    .filter(Boolean);
}

interface Unit { text: string; para: boolean }

function splitParagraphs(text: string): Unit[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)              // blank-line separated blocks
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return blocks.flatMap(b => {
    const parts = b.length > MAX_UNIT_CHARS ? splitSentences(b) : [b];
    // Only the first sentence of a block opens a paragraph; the rest flow on.
    return parts.map((text, i) => ({ text, para: i === 0 }));
  });
}

// ─── Word-level diff inside a modified unit ──────────────────────────────────

function wordLcs(a: string[], b: string[]): { base: DiffPart[]; compared: DiffPart[] } {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const base: DiffPart[] = [], compared: DiffPart[] = [];
  const push = (arr: DiffPart[], t: string, c: DiffPart["c"]) => {
    const last = arr[arr.length - 1];
    if (last && last.c === c) last.t += ` ${t}`;   // coalesce runs
    else arr.push({ t, c });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push(base, a[i], "same"); push(compared, b[j], "same"); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push(base, a[i], "del"); i++; }
    else { push(compared, b[j], "add"); j++; }
  }
  while (i < n) { push(base, a[i], "del"); i++; }
  while (j < m) { push(compared, b[j], "add"); j++; }
  return { base, compared };
}

function wordDiff(base: string, compared: string) {
  return wordLcs(base.split(/\s+/).filter(Boolean), compared.split(/\s+/).filter(Boolean));
}

// LCS table over exact-equal normalized paragraphs
function lcs(a: Unit[], b: Unit[]): DiffBlock[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].text === b[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffBlock[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) { out.push({ type: "unchanged", base: a[i].text, compared: b[j].text, para: a[i].para || b[j].para }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "deleted", base: a[i].text, para: a[i].para }); i++; }
    else { out.push({ type: "added", compared: b[j].text, para: b[j].para }); j++; }
  }
  while (i < n) { out.push({ type: "deleted", base: a[i].text, para: a[i].para }); i++; }
  while (j < m) { out.push({ type: "added", compared: b[j].text, para: b[j].para }); j++; }
  return out;
}

// Jaccard similarity over word sets — cheap, good enough to pair reworded clauses
function similarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

// Collapse a deleted-then-added run into "modified" pairs when the paragraphs are similar enough
function reclassifyModified(blocks: DiffBlock[]): DiffBlock[] {
  const out: DiffBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "deleted") {
      // gather the contiguous deleted run and the following added run
      const deleted: DiffBlock[] = [b];
      let k = i + 1;
      while (k < blocks.length && blocks[k].type === "deleted") { deleted.push(blocks[k]); k++; }
      const added: DiffBlock[] = [];
      while (k < blocks.length && blocks[k].type === "added") { added.push(blocks[k]); k++; }

      if (added.length > 0) {
        const usedAdded = new Set<number>();
        for (const del of deleted) {
          let bestIdx = -1, best = 0.35; // threshold: below this it's a genuine delete+add, not a rewrite
          added.forEach((ad, idx) => {
            if (usedAdded.has(idx)) return;
            const s = similarity(del.base!, ad.compared!);
            if (s > best) { best = s; bestIdx = idx; }
          });
          if (bestIdx >= 0) {
            usedAdded.add(bestIdx);
            const parts = wordDiff(del.base!, added[bestIdx].compared!);
            out.push({
              type: "modified",
              base: del.base,
              compared: added[bestIdx].compared,
              baseParts: parts.base,
              comparedParts: parts.compared,
              para: del.para || added[bestIdx].para,
            });
          } else {
            out.push(del);
          }
        }
        added.forEach((ad, idx) => { if (!usedAdded.has(idx)) out.push(ad); });
        i = k - 1;
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

export function diffContracts(baseText: string, comparedText: string): DiffResult {
  const base = splitParagraphs(baseText);
  const compared = splitParagraphs(comparedText);
  const blocks = reclassifyModified(lcs(base, compared));
  return {
    blocks,
    added:    blocks.filter(b => b.type === "added").length,
    deleted:  blocks.filter(b => b.type === "deleted").length,
    modified: blocks.filter(b => b.type === "modified").length,
  };
}
