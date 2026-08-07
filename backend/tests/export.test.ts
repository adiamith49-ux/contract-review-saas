// Verifies the two fixes that are observable from the export services alone:
//   1. a partial selection exports only the applied findings (not all of them)
//   2. the reviewer name/designation is attributed on comments + tracked changes
import PizZip from "pizzip";
import { exportToDocx, exportToPdf } from "../src/services/export.service.js";

const analysis: any = {
  riskLevel: "critical",
  riskSummary: [
    { area: "Liability & Indemnity", risk: "Unlimited supplier liability.", severity: "critical", recommendation: "Mutual 12-month caps.", clauseRef: "Sections 22, 23, 24" },
    { area: "Data Protection", risk: "No breach notification window.", severity: "high", recommendation: "Add 72-hour notice.", clauseRef: "Section 19" },
  ],
  clauseAnalysis: [
    { clause: "Section 24.1", finding: "Uncapped liability.", risk: "critical", recommendation: "Cap at 12 months.",
      contractText: "Supplier's liability under this Agreement shall be unlimited for all claims.",
      suggestedLanguage: "Each party's aggregate liability shall not exceed twelve (12) months' fees." },
    { clause: "Section 19.3", finding: "No breach notice window.", risk: "high", recommendation: "Add 72 hours.",
      contractText: "Supplier shall notify Customer of any data breach.",
      suggestedLanguage: "Supplier shall notify Customer within seventy-two (72) hours of any data breach." },
    { clause: "Section 31.2", finding: "One-sided audit rights.", risk: "medium", recommendation: "Make mutual.",
      contractText: "Customer may audit Supplier at any time without notice.",
      suggestedLanguage: "Either party may audit the other on thirty (30) days' written notice." },
  ],
  negotiationPoints: [
    { point: "Liability cap multiple", preferredPosition: "12 months", fallbackPosition: "24 months" },
  ],
  ambiguityFlags: [
    { term: "material", location: "Section 12.4", issue: "Undefined.", suggestion: "Define materiality." },
  ],
};

const extractedText = [
  "24. Limitation of Liability",
  "24.1 Supplier's liability under this Agreement shall be unlimited for all claims.",
  "19. Data Protection",
  "19.3 Supplier shall notify Customer of any data breach.",
  "31. Audit",
  "31.2 Customer may audit Supplier at any time without notice.",
].join("\n\n");

const REVIEWER = "Pranav Raja, Legal Counsel";
// The user applied ONE clause finding (Section 24.1) — nothing else.
const applied = new Set(["c-0"]);

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

const docx = await exportToDocx(
  "Tcmel_Global_Subscription_Services_Agreement.docx", "saas",
  analysis, undefined, new Date().toISOString(), extractedText, applied, undefined, REVIEWER,
);
const zip = new PizZip(docx);
const docXml = zip.file("word/document.xml")!.asText();
const commentsXml = zip.file("word/comments.xml")?.asText() ?? "";
const allDocx = docXml + commentsXml;

console.log("── DOCX (applied = c-0 only) ──");
check("includes the applied finding (Section 24.1 / uncapped liability)", /Uncapped liability|Cap at 12 months/.test(allDocx));
check("excludes unapplied clause finding Section 19.3", !/breach notice window|seventy-two/.test(allDocx));
check("excludes unapplied clause finding Section 31.2", !/One-sided audit|thirty \(30\) days/.test(allDocx));
check("excludes unapplied risk-summary item (Data Protection)", !/No breach notification window/.test(allDocx));
check("excludes unapplied ambiguity flag (material)", !/Undefined\./.test(allDocx));
check("attributes comments to the reviewer, not Contralyne AI", allDocx.includes(REVIEWER));
check("no leftover 'Contralyn AI' author", !/Contralyn AI/.test(allDocx));
const cAuthors = [...new Set([...commentsXml.matchAll(/w:author="([^"]*)"/g)].map(m => m[1]))];
console.log("   comment authors:", JSON.stringify(cAuthors));
check("Word comments carry the reviewer as author", cAuthors.length > 0 && cAuthors.every(a => a === REVIEWER));

const pdf = await exportToPdf(
  "Tcmel_Global_Subscription_Services_Agreement.docx", "saas",
  analysis, undefined, new Date().toISOString(), extractedText, applied, REVIEWER,
);
const { default: pdfParse } = await import("pdf-parse");
const pdfText = (await pdfParse(pdf)).text;
console.log("── PDF (applied = c-0 only) ──");
check("includes the applied finding", /Uncapped|Cap at 12/.test(pdfText));
check("excludes unapplied Section 31.2 finding", !/One-sided audit/.test(pdfText));
check("shows REVIEWED BY reviewer name", pdfText.includes("REVIEWED BY") && /Pranav Raja/.test(pdfText));
check("annotation cards are attributed to the reviewer, not CONTRALYN AI", !/CONTRALYN AI/.test(pdfText) && /PRANAV RAJA/.test(pdfText));
check("no 'CONTRALYN' brand typo left in the PDF", !/CONTRALYN\b(?!E)/.test(pdfText));

// And the all-findings case still exports everything when nothing is filtered.
const full = await exportToDocx(
  "x.docx", "saas", analysis, undefined, new Date().toISOString(), extractedText, undefined, undefined, REVIEWER,
);
const fullXml = new PizZip(full).file("word/document.xml")!.asText()
  + (new PizZip(full).file("word/comments.xml")?.asText() ?? "");
console.log("── DOCX (no selection = export all) ──");
check("unfiltered export still includes Section 31.2", /One-sided audit|thirty \(30\) days/.test(fullXml));
check("unfiltered export still includes Section 19.3", /breach notice window|seventy-two/.test(fullXml));
