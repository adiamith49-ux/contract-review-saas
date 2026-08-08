import { processEdits, type RedlineEdit } from "../src/services/redline.service.js";

// Reproduces the live failure on the Acme stress-test agreement, where every
// redline came back "0 placed". The analysis stored `contractText` that STITCHED
// Sections 39.1 and 39.2 into one string with a semicolon and dropped phrases
// from both, so no such text exists in the contract and verbatim matching could
// never succeed.
const contract = [
  "38.4 If Supplier undergoes a change of control involving a competitor of Customer, Customer may terminate this Agreement.",
  "39. Non-Solicitation and Non-Compete",
  "39.1 Supplier shall not provide substantially similar services to any direct competitor of Customer during the term and for five (5) years thereafter without Customer's prior written consent.",
  "39.2 Supplier shall not solicit, hire, contract with, or engage any employee, contractor, consultant, customer, vendor, or strategic partner of Customer during the term and for two (2) years thereafter.",
  "39.3 Supplier acknowledges that these restrictions are reasonable and necessary.",
].join("\n\n");

const base = { clause_ref: "Section 39", edit_type: "replace" as const, risk: "High" as const, playbook_rule: "", rationale: "" };

const stitched: RedlineEdit = {
  ...base,
  // Two clauses joined with "; " and several phrases dropped — exactly what was stored.
  original_text: "Supplier shall not provide substantially similar services to any direct competitor of Customer during the term and for five (5) years thereafter; Supplier shall not solicit, hire, or engage any employee, contractor, or strategic partner of Customer during the term and for two (2) years thereafter.",
  revised_text: "39.1 Supplier shall not solicit Customer's named employees for twelve (12) months post-termination.",
};

const ok = (label: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) process.exitCode = 1; };

const [r] = processEdits(contract, [stitched]);
console.log("stitched quote →", r.matched ? `placed [${r.start}, ${r.end}] confidence ${r.confidence.toFixed(2)}` : `unplaced: ${r.reason}`);
ok("a quote stitching two clauses together is placed", r.matched);
if (r.matched) {
  const span = contract.slice(r.start, r.end);
  ok("the span starts at 39.1's text", /substantially similar services/.test(span));
  ok("the span reaches 39.2's text", /strategic partner of Customer/.test(span));
  ok("the span does NOT swallow the following clause 39.3", !/reasonable and necessary/.test(span));
  ok("the span does NOT reach back into 38.4", !/change of control/.test(span));
}

// A genuinely verbatim quote must still take the exact path at full confidence.
const [v] = processEdits(contract, [{ ...base,
  original_text: "39.3 Supplier acknowledges that these restrictions are reasonable and necessary.",
  revised_text: "39.3 Deleted.",
}]);
ok("a verbatim quote still matches at confidence 1", v.matched && v.confidence === 1);

// Text from another contract entirely must NOT be force-fitted.
const [x] = processEdits(contract, [{ ...base,
  original_text: "The Supplier shall maintain professional indemnity insurance of not less than ten million dollars for the duration of this engagement.",
  revised_text: "Deleted.",
}]);
ok("text absent from the contract is still reported unplaced", !x.matched);

// The widened alignment skip must not turn "similar-looking" into "matched".
// These are the false positives that would silently redline the wrong clause.
const decoys: [string, string][] = [
  ["a different section with shared boilerplate",
   "Customer shall not provide substantially similar goods to any direct supplier of Supplier during the term and for nine (9) years thereafter without written consent."],
  ["a short generic fragment",
   "during the term and for two (2) years thereafter"],
];
const [wrongClause] = processEdits(contract, [{ ...base, original_text: decoys[0][1], revised_text: "x" }]);
ok("a similar-but-different clause is NOT placed", !wrongClause.matched);
// The short fragment IS genuinely present verbatim, so placing it is correct
// behaviour, not a false positive — recorded here so a future change notices
// if it starts being rejected.
const [fragment] = processEdits(contract, [{ ...base, original_text: decoys[1][1], revised_text: "x" }]);
ok("a short but genuinely verbatim fragment still places", fragment.matched);

// Two edits must never claim overlapping spans — tracked changes cannot nest.
const both = processEdits(contract, [
  stitched,
  { ...base, original_text: "39.1 Supplier shall not provide substantially similar services to any direct competitor of Customer during the term and for five (5) years thereafter without Customer's prior written consent.", revised_text: "y" },
]);
const placed = both.filter(e => e.matched);
ok("overlapping edits do not both claim the same text", placed.length <= 1 ||
   !(placed[0].start < placed[1].end && placed[1].start < placed[0].end));
