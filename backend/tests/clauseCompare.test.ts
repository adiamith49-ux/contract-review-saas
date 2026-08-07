import { alignClauses, clauseCounts, type ExtractedClauseRef } from "../src/services/clauseCompare.service.js";

const v1: ExtractedClauseRef[] = [
  { clauseType: "limitation_of_liability", title: "Limitation of Liability", section: "8",
    text: "Each party's aggregate liability shall not exceed the total fees paid in the twelve (12) month period preceding the claim." },
  { clauseType: "confidentiality", title: "Confidentiality", section: "6",
    text: "Each party shall keep the other's Confidential Information confidential for five (5) years." },
  { clauseType: "insurance", title: "Insurance", section: "11",
    text: "Provider shall maintain commercial general liability insurance of at least $1,000,000." },
  { clauseType: "governing_law", title: "Governing Law", section: "20",
    text: "This Agreement is governed by the laws of the State of New York." },
];

const v2: ExtractedClauseRef[] = [
  // reworded → deviation
  { clauseType: "limitation_of_liability", title: "Limitation of Liability", section: "8",
    text: "Each party's aggregate liability shall not exceed two (2) times the total fees paid in the twelve (12) month period preceding the claim." },
  // identical but re-spaced and re-cased by the extractor → must still be identical
  { clauseType: "confidentiality", title: "Confidentiality", section: "6",
    text: "Each party shall keep the other's  Confidential Information confidential for five (5) years ." },
  // Insurance dropped in v2 → missing_in_compared
  // brand new clause → missing_in_base
  { clauseType: "publicity", title: "Publicity", section: "12",
    text: "Provider may use Customer's name and logo in marketing materials." },
  // renumbered but same clause → still matched, identical
  { clauseType: "governing_law", title: "Governing Law", section: "21",
    text: "This Agreement is governed by the laws of the State of New York." },
];

const res = alignClauses(v1, v2);
const counts = clauseCounts(res);
console.log("counts:", counts);
for (const r of res) console.log(`  ${r.status.padEnd(20)} ${r.title} (v1 §${r.baseSection ?? "-"} → v2 §${r.comparedSection ?? "-"})`);

const ok = (l: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${l}`); if (!c) process.exitCode = 1; };
const find = (t: string) => res.find(r => r.title === t)!;

ok("reworded liability cap is a deviation", find("Limitation of Liability").status === "deviation");
ok("whitespace/punctuation-only difference is identical, not a deviation", find("Confidentiality").status === "identical");
ok("clause dropped in v2 is missing_in_compared", find("Insurance").status === "missing_in_compared");
ok("clause new in v2 is missing_in_base", find("Publicity").status === "missing_in_base");
ok("renumbered clause with same text still matches as identical", find("Governing Law").status === "identical");
ok("every clause is accounted for exactly once", counts.total === 5);
ok("counts add up", counts.deviations + counts.identical + counts.missing === counts.total);
ok("deviations sort first", res[0].status === "deviation");
ok("deviation carries both versions' text", !!find("Limitation of Liability").baseText && !!find("Limitation of Liability").comparedText);
