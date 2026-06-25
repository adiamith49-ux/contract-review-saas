import PDFDocument from "pdfkit";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph as DocxParagraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  CommentRangeStart,
  CommentRangeEnd,
  CommentReference,
  InsertedTextRun,
  DeletedTextRun,
  ShadingType,
} from "docx";
import type { AnalysisResult } from "../types.js";

// ─── Colors ───────────────────────────────────────────────────────────────────
const NAVY        = "#1B2A4A";
const WHITE       = "#FFFFFF";
const LIGHT_BG    = "#F7F8FA";
const BORDER      = "#E2E8F0";
const TEXT_PRIMARY   = "#1A202C";
const TEXT_SECONDARY = "#4A5568";
const TEXT_MUTED     = "#718096";

const RISK_COLORS: Record<string, string> = {
  low: "#166534", medium: "#9A3412", high: "#7F1D1D", critical: "#4C1D95",
};
const RISK_BG: Record<string, string> = {
  low: "#F0FFF4", medium: "#FFEDD5", high: "#FEE2E2", critical: "#EDE9FE",
};
const RISK_BORDER: Record<string, string> = {
  low: "#4ADE80", medium: "#FB923C", high: "#F87171", critical: "#A78BFA",
};

// ─── Page geometry ────────────────────────────────────────────────────────────
const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 36;
const CONTENT_W = PAGE_W - MARGIN * 2; // 523.28

// Two-column: left = contract text, right = annotations
const LEFT_COL_W  = 316;
const COL_GAP     = 10;
const RIGHT_COL_W = CONTENT_W - LEFT_COL_W - COL_GAP; // ~197
const RIGHT_COL_X = MARGIN + LEFT_COL_W + COL_GAP;    // ~362

const FOOTER_H       = 30;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 12;
const ROW_GAP        = 5;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Para { text: string; isHeading: boolean }

interface AnnotationItem {
  severity: string;
  heading:  string;
  finding:  string;
  recommendation: string;
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, hex: string) {
  if (h <= 0 || w <= 0) return;
  const [r, g, b] = hexToRgb(hex);
  doc.save().rect(x, y, w, h).fill([r, g, b] as any).restore();
}

function strokeRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, hex: string, lw = 0.5) {
  const [r, g, b] = hexToRgb(hex);
  doc.save().lineWidth(lw).rect(x, y, w, h).stroke([r, g, b] as any).restore();
}

function setFill(doc: PDFKit.PDFDocument, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.fillColor([r, g, b] as any);
}

function riskLabel(level: string) { return level.toUpperCase(); }

function formatContractType(t: string) {
  const labels: Record<string, string> = {
    nda: "Non-Disclosure Agreement", msa: "Master Service Agreement",
    saas: "SaaS Agreement", sow: "Statement of Work",
    order_form: "Order Form", employment: "Employment Agreement",
    vendor_agreement: "Vendor Agreement", other: "Contract",
  };
  return labels[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function cleanText(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, (c) => {
    const map: Record<string, string> = {
      "\u2014": "--", "\u2013": "-", "\u2018": "'", "\u2019": "'",
      "\u201C": '"',  "\u201D": '"',  "\u2022": "-", "\u00A0": " ",
      "\u2192": "->", "\u2190": "<-", "\u2026": "...",
    };
    return map[c] ?? "";
  });
}

// ─── Page management ──────────────────────────────────────────────────────────

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number) {
  const y = PAGE_H - FOOTER_H;
  fillRect(doc, 0, y, PAGE_W, FOOTER_H, NAVY);
  setFill(doc, WHITE);
  doc.fontSize(6.5).font("Helvetica")
    .text(
      "AI-generated insights are for informational purposes only and do not constitute legal advice.",
      MARGIN, y + 10, { width: CONTENT_W - 50, lineBreak: false },
    );
  doc.fontSize(6.5).font("Helvetica")
    .text(`Page ${pageNum}`, PAGE_W - MARGIN - 36, y + 10, { width: 36, align: "right", lineBreak: false });
}

function addPage(doc: PDFKit.PDFDocument, pageNum: number): number {
  doc.addPage({ size: "A4", margin: 0 });
  pageNum++;
  drawFooter(doc, pageNum);
  // Thin continuation header
  fillRect(doc, 0, 0, PAGE_W, 32, NAVY);
  setFill(doc, WHITE);
  doc.fontSize(8).font("Helvetica")
    .text("CONTRALYN  --  Contract Review (continued)", MARGIN, 10, { lineBreak: false });
  doc.y = 42;
  return pageNum;
}

// ─── Contract text parsing ────────────────────────────────────────────────────

function detectHeading(text: string): boolean {
  if (text.length > 110) return false;
  if (/^\d+(\.\d+)*\.?\s+\S/.test(text)) return true;               // "1.2 Something"
  if (/^[A-Z\s\d\-\(\)\.,:]+$/.test(text) && /[A-Z]{2,}/.test(text)) return true; // ALL CAPS
  return false;
}

function parseContractParagraphs(raw: string): Para[] {
  return raw
    .split(/\n{2,}/)
    .map(b => b.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(b => b.length > 0)
    .map(b => ({ text: b, isHeading: detectHeading(b) }));
}

// ─── Annotation collection & matching ────────────────────────────────────────

function collectAnnotations(analysis: AnalysisResult, appliedIds?: Set<string>): AnnotationItem[] {
  const items: AnnotationItem[] = [];

  (analysis.riskSummary as any[]).forEach((r, i) => {
    if (appliedIds && !appliedIds.has(`r-${i}`)) return;
    items.push({
      severity: r.severity ?? r.risk_level ?? "medium",
      heading:  cleanText(r.area ?? ""),
      finding:  cleanText(r.risk ?? ""),
      recommendation: cleanText(r.recommendation ?? ""),
    });
  });

  (analysis.clauseAnalysis as any[]).forEach((c, i) => {
    if (appliedIds && !appliedIds.has(`c-${i}`)) return;
    items.push({
      severity: c.risk ?? c.severity ?? "medium",
      heading:  cleanText(c.clause ?? ""),
      finding:  cleanText(c.finding ?? ""),
      recommendation: cleanText(c.recommendation ?? "") + (c.suggestedLanguage ? `\n\nSuggested language: "${cleanText(c.suggestedLanguage)}"` : ""),
    });
  });

  // Include ambiguity flags in export
  ((analysis as any).ambiguityFlags ?? []).forEach((a: any, i: number) => {
    if (appliedIds && !appliedIds.has(`a-${i}`)) return;
    items.push({
      severity: "medium",
      heading:  cleanText(`Ambiguity: "${a.term}" — ${a.location}`),
      finding:  cleanText(a.issue ?? ""),
      recommendation: cleanText(a.suggestion ?? ""),
    });
  });

  // Deduplicate on heading+finding prefix
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.heading.slice(0, 40) + "|" + item.finding.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMatchingParagraph(paragraphs: Para[], finding: string, heading: string): number | null {
  // 1. Extract section references like "Section 1.2", "Sections 8.1-8.4"
  const secNums: string[] = [];
  const secRe = /(?:Section|Clause|Art(?:icle)?)[s]?\s+(\d+(?:\.\d+)*)/gi;
  let m: RegExpExecArray | null;
  while ((m = secRe.exec(finding)) !== null) secNums.push(m[1]);

  for (const ref of secNums) {
    const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match paragraphs that START with that section number
    const startPat = new RegExp(`^\\s*${esc}[.\\s\\-]`);
    for (let i = 0; i < paragraphs.length; i++) {
      if (startPat.test(paragraphs[i].text)) return i;
    }
    // Match heading paragraphs that CONTAIN the number
    const containsPat = new RegExp(`\\b${esc}\\b`);
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].isHeading && containsPat.test(paragraphs[i].text)) return i;
    }
  }

  // 2. Keyword match against clause heading
  if (heading && heading.length > 3) {
    const stop = new Set(["and", "or", "the", "a", "an", "in", "of", "to", "for", "with", "on", "at", "by", "its", "this"]);
    const kws = heading.toLowerCase()
      .replace(/[-\u2013\u2014]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !stop.has(w) && /[a-z]/.test(w));

    if (kws.length > 0) {
      const threshold = Math.ceil(kws.length * 0.45);
      let bestIdx = -1, bestScore = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        const pLower = paragraphs[i].text.toLowerCase();
        const score = kws.filter(kw => pLower.includes(kw)).length;
        if (score >= threshold && score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx >= 0) return bestIdx;
    }
  }

  return null;
}

function buildAnnotationMap(
  paragraphs: Para[],
  items: AnnotationItem[],
): { map: Map<number, AnnotationItem[]>; unmatched: AnnotationItem[] } {
  const map = new Map<number, AnnotationItem[]>();
  const unmatched: AnnotationItem[] = [];

  for (const item of items) {
    const idx = findMatchingParagraph(paragraphs, item.finding, item.heading);
    if (idx !== null) {
      const existing = map.get(idx) ?? [];
      existing.push(item);
      map.set(idx, existing);
    } else {
      unmatched.push(item);
    }
  }
  return { map, unmatched };
}

// ─── Measurement ──────────────────────────────────────────────────────────────

function measureParaHeight(doc: PDFKit.PDFDocument, para: Para, colW: number): number {
  doc.fontSize(para.isHeading ? 9.5 : 8.5).font(para.isHeading ? "Helvetica-Bold" : "Helvetica");
  return doc.heightOfString(para.text, { width: colW - 14, lineGap: 1.5 })
    + (para.isHeading ? 10 : 5); // top padding
}

function measureSingleAnnotation(doc: PDFKit.PDFDocument, item: AnnotationItem): number {
  const tw = RIGHT_COL_W - 18;
  doc.fontSize(7.5).font("Helvetica-Bold");
  const headH = item.heading ? doc.heightOfString(item.heading, { width: tw, lineGap: 1 }) + 8 : 0;
  doc.fontSize(8).font("Helvetica");
  const findH = doc.heightOfString(item.finding, { width: tw, lineGap: 1.5 });
  const recH  = item.recommendation
    ? doc.heightOfString(item.recommendation, { width: tw, lineGap: 1.5 })
    : 0;
  // header(20) + headH + divider(6) + find_label(10) + findH + rec_label(10) + recH + bottom_pad(8)
  return 20 + headH + 6 + 10 + findH + (item.recommendation ? 10 + recH : 0) + 8;
}

function measureAnnotationsColumn(doc: PDFKit.PDFDocument, items: AnnotationItem[]): number {
  return items.reduce((sum, item, i) =>
    sum + measureSingleAnnotation(doc, item) + (i < items.length - 1 ? 6 : 0), 0);
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

// Draw one paragraph in the left column (with optional yellow highlight)
function drawParagraphLeft(
  doc:          PDFKit.PDFDocument,
  rowY:         number,
  rowH:         number,
  para:         Para,
  isAnnotated:  boolean,
  severity:     string,
): void {
  if (isAnnotated) {
    // Yellow highlight background for the full row height
    fillRect(doc, MARGIN, rowY, LEFT_COL_W, rowH, "#FFFBEB");
    // Severity-coloured left bar
    fillRect(doc, MARGIN, rowY, 3, rowH, RISK_BORDER[severity] ?? RISK_BORDER.medium);
  }

  const topPad = para.isHeading ? 9 : 5;
  setFill(doc, TEXT_PRIMARY);
  doc.fontSize(para.isHeading ? 9.5 : 8.5)
     .font(para.isHeading ? "Helvetica-Bold" : "Helvetica")
     .text(para.text, MARGIN + (isAnnotated ? 10 : 4), rowY + topPad, {
       width: LEFT_COL_W - (isAnnotated ? 16 : 8),
       lineGap: 1.5,
     });
}

// Draw one annotation box, returns its height
function drawSingleAnnotation(
  doc:  PDFKit.PDFDocument,
  x:    number,
  y:    number,
  item: AnnotationItem,
): number {
  const h           = measureSingleAnnotation(doc, item);
  const bg          = RISK_BG[item.severity]     ?? RISK_BG.high;
  const borderColor = RISK_BORDER[item.severity] ?? RISK_BORDER.high;
  const headerColor = RISK_COLORS[item.severity] ?? RISK_COLORS.high;
  const tw          = RIGHT_COL_W - 18;

  fillRect(doc,    x, y, RIGHT_COL_W, h, bg);
  fillRect(doc,    x, y, 3, h, borderColor);
  strokeRect(doc,  x, y, RIGHT_COL_W, h, borderColor, 0.5);
  fillRect(doc,    x, y, RIGHT_COL_W, 20, headerColor);

  // Header text
  setFill(doc, WHITE);
  doc.fontSize(7).font("Helvetica-Bold")
    .text("CONTRALYN AI", x + 7, y + 6, { lineBreak: false });
  doc.fontSize(6.5).font("Helvetica-Bold")
    .text(`${riskLabel(item.severity)} RISK`, x + 7, y + 7, {
      width: RIGHT_COL_W - 14, align: "right", lineBreak: false,
    });

  let ty = y + 22;

  // Clause heading inside box
  if (item.heading) {
    setFill(doc, headerColor);
    doc.fontSize(7.5).font("Helvetica-Bold")
      .text(item.heading, x + 8, ty + 3, { width: tw, lineGap: 1 });
    ty = doc.y + 3;
    // thin divider
    const [dr, dg, db] = hexToRgb(borderColor);
    doc.save().lineWidth(0.4)
      .moveTo(x + 8, ty).lineTo(x + RIGHT_COL_W - 8, ty)
      .stroke([dr, dg, db] as any).restore();
    ty += 3;
  }

  // Finding
  setFill(doc, headerColor);
  doc.fontSize(6.5).font("Helvetica-Bold").text("FINDING", x + 8, ty + 3, { lineBreak: false });
  ty += 10;
  setFill(doc, TEXT_PRIMARY);
  doc.fontSize(8).font("Helvetica").text(item.finding, x + 8, ty, { width: tw, lineGap: 1.5 });
  ty = doc.y;

  // Recommendation
  if (item.recommendation) {
    ty += 6;
    setFill(doc, headerColor);
    doc.fontSize(6.5).font("Helvetica-Bold").text("RECOMMENDATION", x + 8, ty, { lineBreak: false });
    ty += 10;
    setFill(doc, TEXT_SECONDARY);
    doc.fontSize(8).font("Helvetica").text(item.recommendation, x + 8, ty, { width: tw, lineGap: 1.5 });
  }

  return h;
}

// Draw all annotation boxes for a row, stacked
function drawAnnotationsColumn(
  doc:     PDFKit.PDFDocument,
  startY:  number,
  items:   AnnotationItem[],
): void {
  let ty = startY;
  for (let i = 0; i < items.length; i++) {
    const h = drawSingleAnnotation(doc, RIGHT_COL_X, ty, items[i]);
    ty += h + (i < items.length - 1 ? 6 : 0);
  }
}

// Full-width section heading
function sectionHeading(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  fillRect(doc, MARGIN, y, 4, 20, NAVY);
  setFill(doc, NAVY);
  doc.fontSize(11).font("Helvetica-Bold").text(title, MARGIN + 10, y + 3, { width: CONTENT_W - 10 });
  doc.moveDown(0.4);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportToPdf(
  filename:      string,
  contractType:  string,
  analysis:      AnalysisResult,
  summary?:      string,
  createdAt?:    string,
  extractedText?: string,
  appliedIds?:   Set<string>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4", margin: 0, compress: false,
      info: { Title: `${filename} -- Contralyn Review`, Author: "Contralyn AI" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNum = 1;
    drawFooter(doc, pageNum); // draw footer on page 1 first (fixed Y, won't overlap content)

    // ── HEADER ────────────────────────────────────────────────────────────
    fillRect(doc, 0, 0, PAGE_W, 76, NAVY);
    setFill(doc, WHITE);
    doc.fontSize(20).font("Helvetica-Bold").text("CONTRALYN", MARGIN, 16, { lineBreak: false });
    doc.fontSize(9).font("Helvetica").text("AI Contract Analysis Report", MARGIN, 42, { lineBreak: false });

    const riskBorderColor = RISK_BORDER[analysis.riskLevel] ?? RISK_BORDER.high;
    const badgeW = 90;
    fillRect(doc, PAGE_W - MARGIN - badgeW, 20, badgeW, 26, riskBorderColor);
    setFill(doc, NAVY);
    doc.fontSize(10).font("Helvetica-Bold")
      .text(`${riskLabel(analysis.riskLevel)} RISK`, PAGE_W - MARGIN - badgeW, 28, {
        width: badgeW, align: "center", lineBreak: false,
      });

    // ── METADATA BAR ──────────────────────────────────────────────────────
    const metaY = 80;
    fillRect(doc,   MARGIN, metaY, CONTENT_W, 48, LIGHT_BG);
    strokeRect(doc, MARGIN, metaY, CONTENT_W, 48, BORDER, 0.5);

    const col3 = CONTENT_W / 3;
    [
      { label: "FILE",     value: filename,                        x: MARGIN + 10 },
      { label: "TYPE",     value: formatContractType(contractType), x: MARGIN + col3 + 10 },
      { label: "REVIEWED", value: createdAt ? formatDate(createdAt) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), x: MARGIN + col3 * 2 + 10 },
    ].forEach(f => {
      setFill(doc, TEXT_MUTED);
      doc.fontSize(6.5).font("Helvetica-Bold").text(f.label, f.x, metaY + 7, { lineBreak: false });
      setFill(doc, TEXT_PRIMARY);
      doc.fontSize(9).font("Helvetica-Bold").text(f.value, f.x, metaY + 19, { width: col3 - 14, ellipsis: true, lineBreak: false });
    });

    doc.y = metaY + 48 + 12;

    // ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────
    if (summary) {
      const clean = cleanText(summary)
        .replace(/^Plain-English Summary:[^\n]*\n?/i, "")
        .replace(/#{1,6}\s*/g, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/---+/g, "")
        .replace(/\n{3,}/g, "\n\n").trim();
      const paras = clean.split(/\n\n+/).filter(Boolean);
      const excerpt = paras.slice(0, 2).join("\n\n") + (paras.length > 2 ? "\n..." : "");

      sectionHeading(doc, "Executive Summary");
      setFill(doc, TEXT_PRIMARY);
      doc.fontSize(9).font("Helvetica").text(excerpt, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.8);
    }

    // ── CONTRACT TEXT WITH ANNOTATIONS (redlines format) ──────────────────
    const hasText = extractedText && extractedText.trim().length > 100;

    if (hasText) {
      sectionHeading(doc, "Contract Review");

      const paragraphs = parseContractParagraphs(cleanText(extractedText!));
      const allAnnotations = collectAnnotations(analysis, appliedIds);
      const { map: annotationMap, unmatched } = buildAnnotationMap(paragraphs, allAnnotations);

      for (let i = 0; i < paragraphs.length; i++) {
        const para        = paragraphs[i];
        const annotations = annotationMap.get(i) ?? [];
        const isAnnotated = annotations.length > 0;

        // Highest severity in this row
        const severity = annotations.find(a => a.severity === "critical")?.severity
          ?? annotations.find(a => a.severity === "high")?.severity
          ?? annotations.find(a => a.severity === "medium")?.severity
          ?? annotations[0]?.severity
          ?? "medium";

        const leftH  = measureParaHeight(doc, para, LEFT_COL_W);
        const rightH = isAnnotated ? measureAnnotationsColumn(doc, annotations) : 0;
        const rowH   = Math.max(leftH, rightH) + ROW_GAP;

        if (doc.y + rowH > CONTENT_BOTTOM) {
          pageNum = addPage(doc, pageNum);
        }

        const rowY = doc.y;

        drawParagraphLeft(doc, rowY, rowH, para, isAnnotated, severity);
        if (isAnnotated) drawAnnotationsColumn(doc, rowY, annotations);

        doc.y = rowY + rowH;
      }

      // Unmatched annotations at the end
      if (unmatched.length > 0) {
        doc.moveDown(0.5);
        if (doc.y > CONTENT_BOTTOM - 80) pageNum = addPage(doc, pageNum);
        sectionHeading(doc, "Additional Findings");

        for (const item of unmatched) {
          const rightH = measureSingleAnnotation(doc, item);
          const rowH   = rightH + ROW_GAP;

          if (doc.y + rowH > CONTENT_BOTTOM) pageNum = addPage(doc, pageNum);

          const rowY = doc.y;

          // Left: just the clause heading
          setFill(doc, TEXT_PRIMARY);
          doc.fontSize(9).font("Helvetica-Bold")
            .text(item.heading || "Additional Finding", MARGIN + 4, rowY + 4, {
              width: LEFT_COL_W - 8, lineBreak: false,
            });

          drawSingleAnnotation(doc, RIGHT_COL_X, rowY, item);
          doc.y = rowY + rowH;
        }
      }
    } else {
      // Fallback: analysis-only two-column report (no contract text)
      const allAnnotations = collectAnnotations(analysis, appliedIds);
      if (allAnnotations.length > 0) {
        sectionHeading(doc, "Analysis Findings");
        allAnnotations.forEach((item, idx) => {
          const rightH = measureSingleAnnotation(doc, item);
          const rowH   = rightH + ROW_GAP;
          if (doc.y + rowH > CONTENT_BOTTOM) pageNum = addPage(doc, pageNum);

          const rowY = doc.y;

          // Left: numbered badge + heading
          fillRect(doc, MARGIN, rowY + 1, 18, 18, NAVY);
          setFill(doc, WHITE);
          doc.fontSize(7.5).font("Helvetica-Bold")
            .text(String(idx + 1), MARGIN, rowY + 5, { width: 18, align: "center", lineBreak: false });
          setFill(doc, TEXT_PRIMARY);
          doc.fontSize(9).font("Helvetica-Bold")
            .text(item.heading, MARGIN + 22, rowY + 3, { width: LEFT_COL_W - 26 });

          drawSingleAnnotation(doc, RIGHT_COL_X, rowY, item);
          doc.y = rowY + rowH;
        });
      }
    }

    doc.end();
  });
}

// ─── DOCX Export ─────────────────────────────────────────────────────────────

interface RedlineProcessedEdit {
  matched: boolean;
  start?: number;
  end?: number;
  clause_ref: string;
  original_text: string;
  revised_text: string;
  edit_type: "replace" | "insert" | "delete";
  risk: string;
  rationale: string;
  reason?: string;
}

export async function exportToDocx(
  filename:      string,
  contractType:  string,
  analysis:      AnalysisResult,
  summary?:      string,
  createdAt?:    string,
  extractedText?: string,
  appliedIds?:   Set<string>,
  redlineEdits?: RedlineProcessedEdit[],
): Promise<Buffer> {
  const riskColorHex: Record<string, string> = {
    low: "166534", medium: "9A3412", high: "7F1D1D", critical: "4C1D95",
  };
  const severityBg: Record<string, string> = {
    low: "F0FFF4", medium: "FFEDD5", high: "FEE2E2", critical: "EDE9FE",
  };
  const overallColor = riskColorHex[analysis.riskLevel] ?? "000000";
  const now     = new Date();
  const nowISO  = now.toISOString();

  // ─── Comment registry ──────────────────────────────────────────────────────
  let nextCommentId = 1;
  const commentDefs: {
    id: number; author: string; date: Date;
    children: DocxParagraph[];
  }[] = [];

  function registerComment(
    heading: string, finding: string, recommendation: string, severity: string,
  ): number {
    const id = nextCommentId++;
    const label = severity.toUpperCase();
    commentDefs.push({
      id,
      author: "Contralyn AI",
      date:   now,
      children: [
        new DocxParagraph({
          children: [new TextRun({
            text: `[${label} RISK]  ${heading}`,
            bold: true,
            color: riskColorHex[severity] ?? "000000",
          })],
        }),
        new DocxParagraph({
          children: [new TextRun({ text: `Finding: ${finding}` })],
        }),
        ...(recommendation
          ? [new DocxParagraph({
              children: [new TextRun({ text: `Recommendation: ${recommendation}` })],
            })]
          : []),
      ],
    });
    return id;
  }

  // ─── Helper: wrap paragraph text with comment markers ─────────────────────
  function annotatedParagraph(
    text: string, isHeading: boolean, annotations: AnnotationItem[],
  ): DocxParagraph {
    // Worst severity wins for background colour
    const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const severity = annotations.reduce(
      (w, a) => (order[a.severity] ?? 0) > (order[w] ?? 0) ? a.severity : w,
      "low",
    );

    const commentId = registerComment(
      annotations.map(a => a.heading).join(" / "),
      annotations.map(a => a.finding).join("\n\n"),
      annotations.map(a => a.recommendation).filter(Boolean).join("\n\n"),
      severity,
    );

    return new DocxParagraph({
      heading:  isHeading ? HeadingLevel.HEADING_3 : undefined,
      shading:  { type: ShadingType.CLEAR, color: "auto", fill: severityBg[severity] ?? "FEE2E2" },
      children: [
        new CommentRangeStart(commentId),
        new TextRun({ text, bold: isHeading }),
        new CommentRangeEnd(commentId),
        new CommentReference(commentId),
      ],
    });
  }

  // ─── Build contract body with inline redline tracked changes ────────────────
  const bodyChildren: DocxParagraph[] = [];
  let hasBody = false;
  const author = "Contralyn AI";

  // Get placed redline edits sorted by position
  const placedEdits = (redlineEdits ?? [])
    .filter(e => e.matched && typeof e.start === "number" && typeof e.end === "number")
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  if (extractedText && extractedText.trim().length > 100) {
    hasBody = true;

    if (placedEdits.length > 0) {
      // ── Proper inline redline: walk the source text, splice in tracked changes ──
      // This produces output like the example redline PDF: strikethrough for deletions,
      // underline for insertions, inline in the flowing contract text.
      type Seg = { type: "text"; text: string } | { type: "edit"; edit: RedlineProcessedEdit; raw: string };
      const segs: Seg[] = [];
      let cursor = 0;

      for (const edit of placedEdits) {
        const start = edit.start ?? 0;
        const end = edit.end ?? 0;
        if (start > cursor) segs.push({ type: "text", text: extractedText.slice(cursor, start) });
        segs.push({ type: "edit", edit, raw: extractedText.slice(start, end) });
        cursor = end;
      }
      if (cursor < extractedText.length) segs.push({ type: "text", text: extractedText.slice(cursor) });

      // Convert segments into DOCX paragraphs with tracked changes
      let revId = 0;
      let currentRuns: (TextRun | InsertedTextRun | DeletedTextRun)[] = [];

      function flushRuns() {
        if (currentRuns.length > 0) {
          bodyChildren.push(new DocxParagraph({ children: [...currentRuns] }));
          currentRuns = [];
        }
      }

      for (const seg of segs) {
        if (seg.type === "text") {
          const parts = seg.text.split(/\n\n+/);
          for (let p = 0; p < parts.length; p++) {
            if (p > 0) flushRuns();
            const part = parts[p].replace(/\n/g, " ").trim();
            if (part) {
              const isHeading = detectHeading(part);
              currentRuns.push(new TextRun({ text: part, bold: isHeading }));
            }
          }
        } else {
          const { edit, raw } = seg;
          const id = revId++;

          // Add a Word comment with the rationale for each edit
          const commentId = registerComment(
            edit.clause_ref,
            edit.rationale,
            edit.revised_text ? `Suggested: "${edit.revised_text}"` : "",
            edit.risk?.toLowerCase() ?? "medium",
          );
          currentRuns.push(new CommentRangeStart(commentId) as any);

          if (edit.edit_type === "delete") {
            currentRuns.push(new DeletedTextRun({ text: raw, id, author, date: nowISO }));
          } else if (edit.edit_type === "insert") {
            currentRuns.push(new TextRun(raw));
            currentRuns.push(new InsertedTextRun({ text: ` ${edit.revised_text}`, id, author, date: nowISO, color: "0070C0" }));
          } else {
            // replace — strikethrough original, underline new
            currentRuns.push(new DeletedTextRun({ text: raw, id, author, date: nowISO }));
            currentRuns.push(new InsertedTextRun({ text: edit.revised_text, id, author, date: nowISO, color: "0070C0" }));
          }

          currentRuns.push(new CommentRangeEnd(commentId) as any);
          currentRuns.push(new CommentReference(commentId) as any);
        }
      }
      flushRuns();

      // Unplaced redline edits appendix
      const unplacedEdits = (redlineEdits ?? []).filter(e => !e.matched);
      if (unplacedEdits.length > 0) {
        bodyChildren.push(new DocxParagraph({ text: "" }));
        bodyChildren.push(new DocxParagraph({ text: "Unplaced Edits", heading: HeadingLevel.HEADING_2 }));
        bodyChildren.push(new DocxParagraph({
          children: [new TextRun({
            text: "These edits could not be placed inline because their original text was not found verbatim.",
            italics: true, color: "718096",
          })],
        }));
        for (const e of unplacedEdits) {
          const col = (e.risk ?? "").toLowerCase() === "high" ? "7F1D1D" : (e.risk ?? "").toLowerCase() === "medium" ? "9A3412" : "166534";
          bodyChildren.push(new DocxParagraph({
            children: [new TextRun({ text: `[${e.risk}] ${e.clause_ref}`, bold: true, color: col })],
          }));
          bodyChildren.push(new DocxParagraph(`Rationale: ${e.rationale}`));
          if (e.revised_text) bodyChildren.push(new DocxParagraph(`Suggested: "${e.revised_text}"`));
          bodyChildren.push(new DocxParagraph({ text: "" }));
        }
      }
    } else {
      // ── Fallback: no redline edits — use analysis annotations with Word comments ──
      const paragraphs = parseContractParagraphs(cleanText(extractedText));
      const allAnnotations = collectAnnotations(analysis, appliedIds);
      const { map: annotationMap, unmatched } = buildAnnotationMap(paragraphs, allAnnotations);

      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        const annotations = annotationMap.get(i) ?? [];

        if (annotations.length > 0) {
          bodyChildren.push(annotatedParagraph(para.text, para.isHeading, annotations));
        } else {
          bodyChildren.push(new DocxParagraph({
            heading: para.isHeading ? HeadingLevel.HEADING_3 : undefined,
            children: [new TextRun({ text: para.text, bold: para.isHeading })],
          }));
        }
      }

      if (unmatched.length > 0) {
        bodyChildren.push(new DocxParagraph({ text: "" }));
        bodyChildren.push(new DocxParagraph({ text: "Additional Findings", heading: HeadingLevel.HEADING_2 }));
        for (const item of unmatched) {
          bodyChildren.push(new DocxParagraph({
            children: [new TextRun({ text: item.heading, bold: true, color: riskColorHex[item.severity] ?? "000000" })],
          }));
          bodyChildren.push(new DocxParagraph(item.finding));
          if (item.recommendation) bodyChildren.push(new DocxParagraph(`Recommendation: ${item.recommendation}`));
          bodyChildren.push(new DocxParagraph({ text: "" }));
        }
      }
    }
  }

  // ─── Summary paragraphs ────────────────────────────────────────────────────
  const summaryParas: DocxParagraph[] = summary
    ? [
        new DocxParagraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_1 }),
        new DocxParagraph({
          children: [new TextRun({
            text: cleanText(summary)
              .replace(/^Plain-English Summary:[^\n]*\n?/i, "")
              .replace(/#{1,6}\s*/g, "").replace(/\*\*/g, "").replace(/\*/g, "").trim(),
            size: 20,
          })],
        }),
        new DocxParagraph({ text: "" }),
      ]
    : [];

  // ─── Negotiation summary appendix ─────────────────────────────────────────
  const negSummary: DocxParagraph[] = [];
  const filteredNegPoints = (analysis.negotiationPoints as any[]).filter((_, i) =>
    !appliedIds || appliedIds.has(`n-${i}`),
  );
  if (filteredNegPoints.length > 0) {
    negSummary.push(new DocxParagraph({ text: "" }));
    negSummary.push(new DocxParagraph({ text: "Negotiation Points", heading: HeadingLevel.HEADING_1 }));
    for (const n of filteredNegPoints) {
      negSummary.push(new DocxParagraph({ children: [new TextRun({ text: n.point ?? "", bold: true })] }));
      negSummary.push(new DocxParagraph(`Preferred position: ${n.preferredPosition ?? ""}`));
      negSummary.push(new DocxParagraph(`Fallback position: ${n.fallbackPosition ?? ""}`));
      negSummary.push(new DocxParagraph({ text: "" }));
    }
  }

  // ─── Fallback (no extracted text): table-based report ─────────────────────
  const fallbackChildren: (DocxParagraph | Table)[] = hasBody ? [] : [
    new DocxParagraph({ text: "Risk Areas", heading: HeadingLevel.HEADING_1 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Area", "Severity", "Finding", "Recommendation"].map(
            h => new TableCell({ children: [new DocxParagraph({ children: [new TextRun({ text: h, bold: true })] })] }),
          ),
        }),
        ...(analysis.riskSummary as any[]).map(r =>
          new TableRow({
            children: [r.area, ((r.severity ?? "") as string).toUpperCase(), r.risk ?? "", r.recommendation ?? ""].map(
              v => new TableCell({ children: [new DocxParagraph(String(v))] }),
            ),
          }),
        ),
      ],
    }),
    new DocxParagraph({ text: "" }),
    new DocxParagraph({ text: "Clause Analysis", heading: HeadingLevel.HEADING_1 }),
    ...analysis.clauseAnalysis.flatMap(c => [
      new DocxParagraph({ children: [new TextRun({ text: (c as any).clause ?? "", bold: true })] }),
      new DocxParagraph(`Risk: ${((c as any).risk ?? "").toUpperCase()}`),
      new DocxParagraph(`Finding: ${(c as any).finding ?? ""}`),
      new DocxParagraph(`Recommendation: ${(c as any).recommendation ?? ""}`),
      new DocxParagraph({ text: "" }),
    ]),
  ];

  // ─── Determine header note ────────────────────────────────────────────────
  const hasRedlines = placedEdits.length > 0;
  const headerNote = hasRedlines
    ? "Red strikethrough = deleted text · Blue underline = inserted text. Use Word's Review tab to accept or reject changes. Comments explain each edit's rationale."
    : "Highlighted clauses carry AI findings as Word comments. Blue underlined text shows suggested revisions.";

  // ─── Build document ────────────────────────────────────────────────────────
  const doc = new Document({
    comments: commentDefs.length > 0 ? { children: commentDefs } : undefined,
    sections: [{
      children: [
        // Cover / title block
        new DocxParagraph({ text: "Contract Review — Contralyn AI", heading: HeadingLevel.TITLE }),
        new DocxParagraph({
          children: [
            new TextRun({ text: "File: ", bold: true }), new TextRun(filename),
            new TextRun("   "),
            new TextRun({ text: "Type: ", bold: true }), new TextRun(formatContractType(contractType)),
            ...(createdAt ? [new TextRun({ text: `   Reviewed: ${formatDate(createdAt)}`, color: "718096" })] : []),
          ],
        }),
        new DocxParagraph({
          children: [
            new TextRun({ text: "Overall Risk: ", bold: true }),
            new TextRun({ text: riskLabel(analysis.riskLevel), color: overallColor, bold: true }),
          ],
        }),
        new DocxParagraph({ text: "" }),

        ...summaryParas,

        // Annotated contract body or table fallback
        ...(hasBody
          ? [
              new DocxParagraph({ text: hasRedlines ? "Contract Redline" : "Contract Text with Annotations", heading: HeadingLevel.HEADING_1 }),
              new DocxParagraph({
                children: [new TextRun({
                  text: headerNote,
                  italics: true, size: 18, color: "718096",
                })],
              }),
              new DocxParagraph({ text: "" }),
              ...bodyChildren,
            ]
          : fallbackChildren),

        ...negSummary,

        new DocxParagraph({ text: "" }),
        new DocxParagraph({
          children: [new TextRun({
            text: "AI-generated insights are for informational purposes only and do not constitute legal advice.",
            italics: true, size: 18, color: "718096",
          })],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
