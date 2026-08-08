// Who the redlines and Word comments are attributed to.
//
// Word shows a tracked change's `w:author` next to every comment balloon, so an
// export has to carry the reviewer's own name — "Contralyne AI" on a document
// sent to a counterparty reads as if nobody at the firm reviewed it.
//
// The name comes from Clerk; the designation is a local preference (Settings →
// Preferences), because there is no profile-title field on the user record.

const PREF_KEY = "contralyn_prefs";

export function loadReviewerTitle(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return "";
    const title = JSON.parse(raw)?.reviewerTitle;
    return typeof title === "string" ? title.trim() : "";
  } catch {
    return "";
  }
}

/** e.g. "Pranav Raja, Legal Counsel" — falls back to the name, then to undefined. */
export function reviewerLabel(name?: string | null, title?: string): string | undefined {
  const n = (name ?? "").trim();
  const t = (title ?? loadReviewerTitle()).trim();
  if (n && t) return `${n}, ${t}`;
  return n || t || undefined;
}
