// Paragraph-level version diff for contract drafts.
// No external dependency — a Myers-style LCS over normalized paragraphs,
// then a similarity pass to reclassify adjacent add/delete pairs as "modified".

export type DiffType = "added" | "deleted" | "modified" | "unchanged";

export interface DiffBlock {
  type: DiffType;
  base?: string;      // paragraph from the base (prior) version
  compared?: string;  // paragraph from the compared (new) version
}

export interface DiffResult {
  blocks: DiffBlock[];
  added: number;
  deleted: number;
  modified: number;
}

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)              // blank-line separated blocks
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// LCS table over exact-equal normalized paragraphs
function lcs(a: string[], b: string[]): DiffBlock[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffBlock[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "unchanged", base: a[i], compared: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "deleted", base: a[i] }); i++; }
    else { out.push({ type: "added", compared: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: "deleted", base: a[i] }); i++; }
  while (j < m) { out.push({ type: "added", compared: b[j] }); j++; }
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
            out.push({ type: "modified", base: del.base, compared: added[bestIdx].compared });
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
