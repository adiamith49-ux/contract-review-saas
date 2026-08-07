import { diffContracts } from "../src/services/compare.service.js";

// Two drafts of the same contract as a PDF extractor yields them: one giant
// block per page, no blank lines, a few clauses reworded between versions.
const page1 = "1. Service. Provider will supply the Cloud Service during the Subscription Period. 1.1 Access and Use. Customer may access the Cloud Service for its internal business purposes. 1.2 Service Level. If there is an SLA and the Cloud Service does not meet it, Provider will provide the remedies outlined in the SLA. 1.3 Support. Provider will provide Technical Support as described in the Cover Page.";
const v1 = page1 + " 8. Limitation of Liability. Each party's aggregate liability shall not exceed the total fees paid in the twelve (12) month period preceding the claim. 11. Insurance. Provider shall maintain commercial general liability insurance of at least $1,000,000.";
const v2 = page1 + " 8. Limitation of Liability. Each party's aggregate liability shall not exceed two (2) times the total fees paid in the twelve (12) month period preceding the claim. 12. Publicity. Provider may use Customer's name and logo.";

const d = diffContracts(v1, v2);
const by = d.blocks.reduce<Record<string, number>>((a, b) => (a[b.type] = (a[b.type] || 0) + 1, a), {});
console.log("counts:", { added: d.added, deleted: d.deleted, modified: d.modified });
console.log("block types:", by);
console.log("total blocks:", d.blocks.length, "| max unit chars:", Math.max(...d.blocks.map(b => (b.base || b.compared || "").length)));

const ok = (label: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) process.exitCode = 1; };
ok("unchanged text is detected (full-doc view has something to show)", (by.unchanged ?? 0) > 0);
ok("the reworded liability clause is 'modified', not delete+add", d.modified >= 1);
ok("the removed Insurance clause is a deletion", d.blocks.some(b => b.type === "deleted" && /Insurance/.test(b.base ?? "")));
ok("the new Publicity clause is an addition", d.blocks.some(b => b.type === "added" && /Publicity/.test(b.compared ?? "")));
ok("units are sentence-sized, not page-sized", Math.max(...d.blocks.map(b => (b.base || b.compared || "").length)) < 400);

const mod = d.blocks.find(b => b.type === "modified");
console.log("\nword-level diff on the modified clause:");
console.log("  base:    ", mod?.baseParts?.map(p => p.c === "del" ? `[-${p.t}-]` : p.t).join(" "));
console.log("  compared:", mod?.comparedParts?.map(p => p.c === "add" ? `[+${p.t}+]` : p.t).join(" "));
ok("word diff isolates the inserted words", !!mod?.comparedParts?.some(p => p.c === "add" && /two \(2\) times/.test(p.t)));

// Paragraph structure must survive sentence-level diffing, or the viewer
// cannot re-flow the text back into the uploaded document's paragraphs.
console.log("\nparagraph reflow:");
const opens = d.blocks.filter(b => b.para).length;
console.log("  units:", d.blocks.length, "| paragraph openers:", opens);
ok("some units open a paragraph", opens > 0);
ok("not every unit opens one (sentences flow together)", opens < d.blocks.length);
