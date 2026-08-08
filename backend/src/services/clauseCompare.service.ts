// Clause-level comparison between two versions of a contract.
//
// The text diff in compare.service.ts answers "what characters changed". This
// answers the question a lawyer actually asks: "which clauses deviate, which
// are identical, and which are missing" — the same three buckets a reviewer
// filters on. Alignment is deterministic and free; the AI is spent only on
// extracting the clause inventory and on writing the difference summaries for
// the pairs that actually differ.

export interface ExtractedClauseRef {
  clauseType: string;   // canonical topic key, e.g. "limitation_of_liability"
  title: string;        // human label, e.g. "Limitation of Liability"
  section: string;      // "8", "24.1" — may be empty
  text: string;         // verbatim clause text
}

export type ClauseStatus = "identical" | "deviation" | "missing_in_base" | "missing_in_compared";

export interface ClauseComparison {
  status: ClauseStatus;
  clauseType: string;
  title: string;
  baseSection?: string;
  comparedSection?: string;
  baseText?: string;
  comparedText?: string;
  /** AI-written summary of how the two versions differ. Deviations only. */
  summary?: string;
  impact?: "low" | "medium" | "high";
}

// Compare clause bodies ignoring the noise that survives PDF/DOCX extraction:
// case, punctuation spacing, and runs of whitespace. Two clauses that differ
// only in how the extractor spaced them are the same clause, not a deviation.
function normalizeBody(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s([,.;:)])/g, "$1")
    .trim();
}

function normalizeType(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Section "24" and "24.1" belong to the same clause family; "24" and "25" don't.
function sectionsRelated(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

function titleWords(s: string): Set<string> {
  const stop = new Set(["and", "or", "the", "of", "to", "for", "a", "an", "in", "clause", "section"]);
  return new Set(s.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !stop.has(w)));
}

function titleSimilarity(a: string, b: string): number {
  const wa = titleWords(a), wb = titleWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size);
}

/**
 * Pair clauses across the two versions and bucket each pair. Deterministic —
 * no AI, no cost. A clause matches at most one counterpart; anything left over
 * on either side is reported as missing from the other version.
 */
export function alignClauses(
  base: ExtractedClauseRef[],
  compared: ExtractedClauseRef[],
): ClauseComparison[] {
  const out: ClauseComparison[] = [];
  const usedCompared = new Set<number>();

  const score = (a: ExtractedClauseRef, b: ExtractedClauseRef): number => {
    // Same canonical type is the strongest signal, then a related section
    // number, then a similar title. Below the floor it is not the same clause.
    let s = 0;
    if (normalizeType(a.clauseType) && normalizeType(a.clauseType) === normalizeType(b.clauseType)) s += 0.6;
    if (sectionsRelated(a.section, b.section)) s += 0.25;
    s += titleSimilarity(a.title, b.title) * 0.3;
    return s;
  };

  for (const b of base) {
    let bestIdx = -1, best = 0.45;   // floor: below this they are different clauses
    compared.forEach((c, i) => {
      if (usedCompared.has(i)) return;
      const s = score(b, c);
      if (s > best) { best = s; bestIdx = i; }
    });

    if (bestIdx < 0) {
      out.push({
        status: "missing_in_compared",
        clauseType: b.clauseType, title: b.title,
        baseSection: b.section, baseText: b.text,
      });
      continue;
    }

    const c = compared[bestIdx];
    usedCompared.add(bestIdx);
    const identical = normalizeBody(b.text) === normalizeBody(c.text);
    out.push({
      status: identical ? "identical" : "deviation",
      clauseType: b.clauseType || c.clauseType,
      title: b.title || c.title,
      baseSection: b.section, comparedSection: c.section,
      baseText: b.text, comparedText: c.text,
    });
  }

  compared.forEach((c, i) => {
    if (usedCompared.has(i)) return;
    out.push({
      status: "missing_in_base",
      clauseType: c.clauseType, title: c.title,
      comparedSection: c.section, comparedText: c.text,
    });
  });

  // Deviations first — that is what a reviewer opens the screen to find.
  const order: Record<ClauseStatus, number> = {
    deviation: 0, missing_in_compared: 1, missing_in_base: 2, identical: 3,
  };
  return out.sort((x, y) => order[x.status] - order[y.status]);
}

export function clauseCounts(items: ClauseComparison[]) {
  return {
    deviations: items.filter(i => i.status === "deviation").length,
    identical:  items.filter(i => i.status === "identical").length,
    missing:    items.filter(i => i.status === "missing_in_base" || i.status === "missing_in_compared").length,
    total:      items.length,
  };
}
