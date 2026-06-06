import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import type { AnalysisResult } from "../types.js";

export async function exportToDocx(
  filename: string,
  contractType: string,
  analysis: AnalysisResult
): Promise<Buffer> {
  const riskColor = { low: "2E7D32", medium: "F57F17", high: "C62828", critical: "4A148C" };
  const color = riskColor[analysis.riskLevel] ?? "000000";

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Contract Review Report",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "File: ", bold: true }),
              new TextRun(filename),
              new TextRun("   "),
              new TextRun({ text: "Type: ", bold: true }),
              new TextRun(contractType.replace("_", " ").toUpperCase()),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Overall Risk: ", bold: true }),
              new TextRun({ text: analysis.riskLevel.toUpperCase(), color, bold: true }),
            ],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "Risk Summary", heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Area", "Risk", "Severity", "Recommendation"].map(
                  (h) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                    })
                ),
              }),
              ...analysis.riskSummary.map(
                (r) =>
                  new TableRow({
                    children: [r.area, r.risk, r.severity, r.recommendation].map(
                      (v) => new TableCell({ children: [new Paragraph(v)] })
                    ),
                  })
              ),
            ],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "Clause Analysis", heading: HeadingLevel.HEADING_1 }),
          ...analysis.clauseAnalysis.flatMap((c) => [
            new Paragraph({ children: [new TextRun({ text: c.clause, bold: true })] }),
            new Paragraph(`Finding: ${c.finding}`),
            new Paragraph(`Risk: ${c.risk.toUpperCase()}`),
            new Paragraph(`Recommendation: ${c.recommendation}`),
            new Paragraph({ text: "" }),
          ]),

          new Paragraph({ text: "Negotiation Points", heading: HeadingLevel.HEADING_1 }),
          ...analysis.negotiationPoints.flatMap((n) => [
            new Paragraph({ children: [new TextRun({ text: n.point, bold: true })] }),
            new Paragraph(`Preferred: ${n.preferredPosition}`),
            new Paragraph(`Fallback: ${n.fallbackPosition}`),
            new Paragraph({ text: "" }),
          ]),

          new Paragraph({
            children: [
              new TextRun({
                text: "AI-generated insights are for informational purposes only and do not constitute legal advice.",
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function exportToPdf(
  filename: string,
  contractType: string,
  analysis: AnalysisResult
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const riskColors: Record<string, string> = {
      low: "#2E7D32",
      medium: "#F57F17",
      high: "#C62828",
      critical: "#4A148C",
    };

    doc.fontSize(22).font("Helvetica-Bold").text("Contract Review Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(`File: ${filename}   Type: ${contractType.replace("_", " ").toUpperCase()}`);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(riskColors[analysis.riskLevel] ?? "#000000")
      .text(`Overall Risk: ${analysis.riskLevel.toUpperCase()}`);
    doc.fillColor("#000000");
    doc.moveDown();

    doc.fontSize(16).font("Helvetica-Bold").text("Risk Summary");
    doc.moveDown(0.3);
    analysis.riskSummary.forEach((r) => {
      doc.fontSize(11).font("Helvetica-Bold").text(r.area, { continued: true });
      doc.font("Helvetica").text(`  [${r.severity.toUpperCase()}]`);
      doc.fontSize(10).text(r.risk);
      doc.text(`→ ${r.recommendation}`);
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.fontSize(16).font("Helvetica-Bold").text("Clause Analysis");
    doc.moveDown(0.3);
    analysis.clauseAnalysis.forEach((c) => {
      doc.fontSize(11).font("Helvetica-Bold").text(c.clause);
      doc.fontSize(10).font("Helvetica").text(c.finding);
      doc
        .fillColor(riskColors[c.risk] ?? "#000000")
        .text(`Risk: ${c.risk.toUpperCase()}`)
        .fillColor("#000000");
      doc.text(`→ ${c.recommendation}`);
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.fontSize(16).font("Helvetica-Bold").text("Negotiation Points");
    doc.moveDown(0.3);
    analysis.negotiationPoints.forEach((n) => {
      doc.fontSize(11).font("Helvetica-Bold").text(n.point);
      doc.fontSize(10).font("Helvetica").text(`Preferred: ${n.preferredPosition}`);
      doc.text(`Fallback: ${n.fallbackPosition}`);
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc
      .fontSize(9)
      .font("Helvetica-Oblique")
      .text(
        "AI-generated insights are for informational purposes only and do not constitute legal advice.",
        { align: "center" }
      );

    doc.end();
  });
}
