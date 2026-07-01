import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function detectUserId(): Promise<string> {
  for (const table of ["contracts", "activity_logs", "clause_library", "review_rules"] as const) {
    const { data } = await db.from(table).select("user_id").limit(1).single();
    if (data?.user_id) return data.user_id;
  }
  throw new Error("No user found. Log into the app at least once, then re-run this seed.");
}

async function seed() {
  console.log("Connecting to Supabase…");
  const uid = await detectUserId();
  console.log(`Detected user_id: ${uid}`);

  // ── Wipe previous seed data ────────────────────────────────────────────────
  console.log("Wiping previous seed data…");
  await db.from("contracts").delete().eq("user_id", uid);
  await db.from("clause_library").delete().eq("user_id", uid);
  await db.from("review_rules").delete().eq("user_id", uid);
  await db.from("clients").delete().eq("user_id", uid);

  // ── Clients ────────────────────────────────────────────────────────────────
  console.log("Inserting clients…");
  const { data: clients, error: cErr } = await db.from("clients").insert([
    { user_id: uid, name: "Nexus Technologies", industry: "Technology",
      notes: "Primary SaaS client. Active since 2024. High volume of vendor agreements and NDAs. Point of contact: Sarah Lin (General Counsel).",
      status: "active" },
    { user_id: uid, name: "Meridian Capital", industry: "Finance",
      notes: "Investment fund. Requires strict data protection clauses and Delaware governing law on all agreements. Review urgency is always high.",
      status: "active" },
    { user_id: uid, name: "BluePeak Health", industry: "Healthcare",
      notes: "Former client. Engagement ended Q1 2026 after contract dispute over liability terms.",
      status: "inactive" },
  ]).select("id, name");
  if (cErr) throw cErr;
  const c1 = clients![0].id, c2 = clients![1].id, c3 = clients![2].id;
  console.log(`  Created clients: ${clients!.map((c: any) => c.name).join(", ")}`);

  // ── Contracts ──────────────────────────────────────────────────────────────
  console.log("Inserting contracts…");
  const { data: contracts, error: kErr } = await db.from("contracts").insert([
    {
      user_id: uid, client_id: c1,
      filename: "Nexus_NDA_2026.pdf",
      s3_key: `seed/${uid}/nexus-nda-2026.pdf`,
      file_size: 245760, mime_type: "application/pdf",
      contract_type: "nda", status: "analyzed",
      extracted_text: `NON-DISCLOSURE AGREEMENT\n\nThis Non-Disclosure Agreement ("Agreement") is entered into as of January 15, 2026, between Nexus Technologies Inc. ("Company") and the Recipient.\n\n1. CONFIDENTIAL INFORMATION\nRecipient agrees to keep confidential all proprietary information disclosed by Company, including trade secrets, business plans, financial data, and technical specifications.\n\n2. OBLIGATIONS\nRecipient shall not disclose Confidential Information to any third party without prior written consent. Recipient shall use Confidential Information solely for evaluation purposes.\n\n3. TERM\nThis Agreement shall remain in effect for a period of three (3) years from the date of execution.\n\n4. GOVERNING LAW\nThis Agreement shall be governed by the laws of the State of California.\n\n5. REMEDIES\nBreach of this Agreement may cause irreparable harm for which monetary damages would be inadequate. Company may seek injunctive relief without bond requirement.\n\n6. RETURN OF INFORMATION\nUpon request, Recipient shall promptly return or destroy all Confidential Information.`,
    },
    {
      user_id: uid, client_id: c1,
      filename: "Nexus_SaaS_Agreement_v2.docx",
      s3_key: `seed/${uid}/nexus-saas-v2.docx`,
      file_size: 512000,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      contract_type: "saas", status: "analyzed",
      extracted_text: `SAAS SUBSCRIPTION AGREEMENT\n\nThis SaaS Subscription Agreement is made between Nexus Technologies Inc. ("Customer") and Provider as of March 1, 2026.\n\n1. SERVICES\nProvider will make the platform available to Customer on a subscription basis. Uptime SLA of 99.5% is guaranteed excluding scheduled maintenance.\n\n2. LIMITATION OF LIABILITY\nIN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES. PROVIDER'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER IN THE TWELVE MONTHS PRECEDING THE CLAIM.\n\n3. DATA PROTECTION\nProvider shall implement reasonable security measures. Provider shall notify Customer of any data breach within 72 hours of discovery. Provider may use anonymized aggregate data for product improvement.\n\n4. TERMINATION\nEither party may terminate upon 30 days written notice. Customer may terminate immediately for material breach uncured within 15 days.\n\n5. INTELLECTUAL PROPERTY\nAll Customer data remains Customer's property. Provider retains ownership of all platform software and improvements, including improvements derived from usage patterns.\n\n6. AUTO-RENEWAL\nThis Agreement shall automatically renew for successive one-year terms unless either party provides 60 days notice of non-renewal.`,
    },
    {
      user_id: uid, client_id: c2,
      filename: "Meridian_MSA_Draft.pdf",
      s3_key: `seed/${uid}/meridian-msa-draft.pdf`,
      file_size: 890000, mime_type: "application/pdf",
      contract_type: "msa", status: "analyzed",
      extracted_text: `MASTER SERVICES AGREEMENT\n\nThis Master Services Agreement is entered into between Meridian Capital Management LLC ("Client") and Service Provider as of February 10, 2026.\n\n1. INDEMNIFICATION\nService Provider shall indemnify, defend, and hold harmless Client and its officers, directors, employees, agents, and successors from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys fees) arising out of or relating to: (a) any breach of this Agreement; (b) negligence or willful misconduct; (c) any third-party claims arising from Service Provider's services.\n\n2. LIABILITY\nNotwithstanding any other provision, Service Provider's liability under this Agreement shall be unlimited and shall include all direct, indirect, consequential, punitive, and special damages.\n\n3. GOVERNING LAW\nThis Agreement shall be governed by the laws of Delaware. Disputes shall be resolved through binding arbitration in New York with no right of appeal.\n\n4. PAYMENT TERMS\nClient shall pay all invoices within 7 days of receipt. Late payments shall accrue interest at 18% per annum compounded monthly.\n\n5. TERM\nThis Agreement shall continue for a period of 3 years and shall automatically renew for additional 2-year terms unless terminated with 180 days written notice.`,
    },
    {
      user_id: uid, client_id: c2,
      filename: "Meridian_Vendor_Agreement_Draft.pdf",
      s3_key: `seed/${uid}/meridian-vendor-draft.pdf`,
      file_size: 180000, mime_type: "application/pdf",
      contract_type: "vendor_agreement", status: "uploaded",
      extracted_text: null,
    },
    {
      user_id: uid, client_id: c3,
      filename: "BluePeak_Employment_Contract.pdf",
      s3_key: `seed/${uid}/bluepeak-employment.pdf`,
      file_size: 320000, mime_type: "application/pdf",
      contract_type: "employment", status: "uploaded",
      extracted_text: null,
    },
  ]).select("id, filename");
  if (kErr) throw kErr;
  const [k1, k2, k3] = contracts!.map((c: any) => c.id);
  console.log(`  Created contracts: ${contracts!.map((c: any) => c.filename).join(", ")}`);

  // ── Analyses ───────────────────────────────────────────────────────────────
  console.log("Inserting analyses…");
  const { error: aErr } = await db.from("analyses").insert([
    {
      contract_id: k1, user_id: uid, risk_level: "high",
      risk_summary: [
        { area: "Injunctive Relief", risk: "No-bond injunction clause heavily favors disclosing party — they can seek emergency court orders at any time with no financial guarantee", severity: "high", recommendation: "Negotiate a mutual notice period before injunctive relief is sought, or require a bond amount tied to claimed damages" },
        { area: "Term Length", risk: "3-year confidentiality period is above industry standard (12–18 months for technology NDAs)", severity: "medium", recommendation: "Propose reducing to 18 months with option to extend by mutual agreement" },
        { area: "Governing Law", risk: "California governing law with no dispute resolution mechanism specified", severity: "low", recommendation: "Add explicit dispute resolution clause — mediation before litigation" },
      ],
      clause_analysis: [
        { clause: "Confidentiality Obligation", finding: "One-sided — only Recipient is bound. No mutual NDA protection for Recipient's information shared during evaluation.", risk: "high", recommendation: "Propose mutual confidentiality obligations covering both parties" },
        { clause: "Remedies — Injunctive Relief", finding: "Waives bond requirement for injunctions. Extremely favorable to disclosing party — allows seeking court orders with no financial skin in the game.", risk: "high", recommendation: "Remove bond waiver or cap to a reasonable bond amount (e.g. $50,000)" },
        { clause: "Term", finding: "3-year term is above market standard for a technology NDA. Creates long-term obligation for information that may become public.", risk: "medium", recommendation: "Negotiate to 18 months with mutual extension option" },
        { clause: "Return of Information", finding: "Vague 'promptly return or destroy' with no certification requirement or timeline.", risk: "low", recommendation: "Add 10-business-day deadline and written certification of destruction" },
      ],
      negotiation_points: [
        { point: "Mutual vs. one-sided NDA", preferredPosition: "Mutual obligations binding both parties equally", fallbackPosition: "Retain one-sided but add standard exclusions for public domain, independently developed, and third-party received information" },
        { point: "Injunction bond waiver", preferredPosition: "Remove waiver entirely — require bond tied to claimed damages", fallbackPosition: "Cap bond waiver to emergency situations only, with 48-hour notice requirement" },
      ],
      ambiguity_flags: [
        { term: "proprietary information", location: "Section 1", issue: "Overly broad — no exclusions listed for publicly available or independently developed information", suggestion: "Add standard exclusions: (a) publicly available; (b) independently developed; (c) received from third parties without restriction; (d) required by law to disclose" },
      ],
      model: "claude-sonnet-4-6",
    },
    {
      contract_id: k2, user_id: uid, risk_level: "medium",
      risk_summary: [
        { area: "Auto-Renewal Notice", risk: "60-day non-renewal notice is double the industry standard — creates material risk of unwanted renewal", severity: "medium", recommendation: "Negotiate down to 30 days. Add calendar reminder obligation to mitigate risk." },
        { area: "Data Usage", risk: "Clause allows use of anonymized data for product improvement — this should be explicitly prohibited for any identifiable data", severity: "medium", recommendation: "Add explicit prohibition on using Customer data or derivatives to train AI models or for competitive benchmarking" },
        { area: "Breach Notification", risk: "72-hour breach notification meets GDPR minimum but may not meet stricter US state laws (e.g. NY SHIELD Act requires 'expedient' notice)", severity: "low", recommendation: "Specify 48 hours for all breach notifications to meet stricter standards" },
      ],
      clause_analysis: [
        { clause: "Limitation of Liability", finding: "Cap at 12-month fees is market standard. However, data breach scenarios are not carved out — cap applies even to catastrophic data loss.", risk: "medium", recommendation: "Add carve-out: data breach liability is uncapped or capped at higher of 24 months fees or $500K" },
        { clause: "Auto-Renewal", finding: "60-day notice period for non-renewal is unfavorable. Risk of accidental renewal if reminder is missed.", risk: "medium", recommendation: "Reduce to 30 days. Add obligation for Provider to send renewal reminder 90 days in advance." },
        { clause: "Data Protection — AI Training", finding: "'Anonymized aggregate data for product improvement' is ambiguous — could include training AI models on your data patterns.", risk: "medium", recommendation: "Add: Provider shall not use Customer Data or any derivative thereof to train machine learning models." },
        { clause: "Intellectual Property", finding: "'Improvements derived from usage patterns' is concerning — suggests Provider may claim IP rights to features built using Customer behavior data.", risk: "high", recommendation: "Delete 'improvements derived from usage patterns' — all platform IP owned solely by Provider without reference to Customer data" },
      ],
      negotiation_points: [
        { point: "Auto-renewal notice period", preferredPosition: "30 days notice with Provider reminder obligation at 90 days", fallbackPosition: "45 days notice — absolute maximum acceptable" },
        { point: "Data breach liability carve-out", preferredPosition: "Uncapped liability for data breaches, with mandatory cyber insurance", fallbackPosition: "Cap at 24 months fees or $500K, whichever is higher" },
      ],
      ambiguity_flags: [],
      model: "claude-sonnet-4-6",
    },
    {
      contract_id: k3, user_id: uid, risk_level: "critical",
      risk_summary: [
        { area: "Unlimited Liability", risk: "CRITICAL: Service Provider accepts unlimited liability including punitive and consequential damages. This is commercially unacceptable and creates existential financial risk.", severity: "high", recommendation: "STOP — Do not sign. Negotiate mutual liability cap tied to contract value before proceeding." },
        { area: "Indemnification Scope", risk: "Extremely broad — covers all third-party claims with no materiality threshold or carve-out for Client's own negligence", severity: "high", recommendation: "Add mutual indemnification, limit to direct losses from proven breach, and add contributory negligence carve-out" },
        { area: "Payment Terms", risk: "7-day payment with 18% annual interest compounded monthly. Interest rate may exceed legal usury limits in several US states.", severity: "high", recommendation: "Revise to Net-30, 6% simple annual interest. Check usury limits for applicable jurisdiction." },
        { area: "Auto-Renewal", risk: "180-day termination notice for a 3+2 year agreement is extremely unusual and creates multi-year lock-in with virtually no exit", severity: "medium", recommendation: "Reduce to 90-day notice and include termination for convenience with 6-month pro-rated refund" },
      ],
      clause_analysis: [
        { clause: "Unlimited Liability", finding: "CRITICAL: No cap on liability — Service Provider exposed to unlimited direct, indirect, consequential, AND punitive damages. This is highly unusual and commercially unacceptable in any standard services agreement.", risk: "critical", recommendation: "Must add mutual liability cap. Propose: each party's total liability capped at 1x total contract value or $1M, whichever is lower. Walk-away clause if counterparty refuses any cap." },
        { clause: "Indemnification", finding: "Covers Service Provider's negligence, wilful misconduct, AND all third-party claims with no contributory negligence carve-out. Client has no indemnification obligation at all.", risk: "critical", recommendation: "Replace with mutual, balanced indemnification. Add: (a) mutual obligations; (b) limit to proven breach causing direct damages; (c) add contributory negligence exception; (d) cap indemnification at contract value" },
        { clause: "Payment Terms — Interest Rate", finding: "18% per annum compounded monthly equals ~19.6% effective annual rate. This exceeds usury limits in California (10%), New York (16% for commercial), and other states.", risk: "high", recommendation: "Revise to Net-30. Maximum 6% simple annual interest. Add 15-business-day cure period before interest accrues." },
        { clause: "Auto-Renewal & Termination", finding: "180-day termination notice for auto-renewing 2-year terms creates effectively permanent lock-in. Combined with unlimited liability, this is an extreme position.", risk: "high", recommendation: "Reduce to 90-day notice. Add termination for convenience right at any time with 90 days notice and pro-rated refund." },
        { clause: "Arbitration — No Appeal", finding: "Mandatory New York arbitration with no right of appeal for any amount. Extremely unfavorable — removes all legal recourse for erroneous decisions.", risk: "medium", recommendation: "Allow appeal for awards exceeding $250K. Add mediation as mandatory first step before arbitration." },
      ],
      negotiation_points: [
        { point: "Liability cap", preferredPosition: "Mutual cap at 1x annual contract value with walk-away if counterparty refuses any cap", fallbackPosition: "Cap at 2x contract value with specific carve-out for gross negligence only" },
        { point: "Payment terms", preferredPosition: "Net-30, 6% simple annual interest, 15-day cure period", fallbackPosition: "Net-15, 10% interest, 10-day cure period — absolute minimum" },
        { point: "Termination notice", preferredPosition: "90-day notice with termination for convenience right", fallbackPosition: "120-day notice with 50% refund on pro-rated unused term" },
      ],
      ambiguity_flags: [
        { term: "material breach", location: "Section 1(a)", issue: "Undefined — any breach including minor administrative failures could trigger full indemnification obligation", suggestion: "Define: 'material breach means a breach that causes actual financial harm exceeding $10,000 and remains uncured for 30 days after written notice'" },
        { term: "reasonable", location: "Section 1(b)", issue: "'Reasonable attorneys fees' with no cap — could include fees from multi-year litigation", suggestion: "Add: 'reasonable attorneys fees not to exceed $50,000 per claim without prior written approval'" },
      ],
      model: "claude-sonnet-4-6",
    },
  ]);
  if (aErr) throw aErr;
  console.log("  Created 3 analyses");

  // ── Legal Intake ────────────────────────────────────────────────────────────
  console.log("Inserting legal intake…");
  const { error: iErr } = await db.from("legal_intake").insert([
    { contract_id: k1, user_id: uid, counterparty_name: "Nexus Technologies Inc.", department: "Legal", urgency: "medium", deal_value: null, jurisdiction: "us", business_owner: "Kartik J.", notes: "Standard mutual NDA for technology partnership evaluation. No financial exposure." },
    { contract_id: k2, user_id: uid, counterparty_name: "Nexus Technologies Inc.", department: "Sales", urgency: "high", deal_value: 120000, jurisdiction: "us", business_owner: "Kartik J.", notes: "Annual SaaS renewal. Q3 deadline. Watch auto-renewal notice — 60-day window opens in 45 days." },
    { contract_id: k3, user_id: uid, counterparty_name: "Meridian Capital Management LLC", department: "Finance", urgency: "critical", deal_value: 500000, jurisdiction: "us", business_owner: "Kartik J.", notes: "DO NOT SIGN. Counterparty draft contains unlimited liability and usurious interest rates. Escalate immediately." },
  ]);
  if (iErr) throw iErr;
  console.log("  Created 3 legal intake records");

  // ── Clause Library ──────────────────────────────────────────────────────────
  console.log("Inserting clause library…");
  const { error: clErr } = await db.from("clause_library").insert([
    {
      user_id: uid, title: "Standard Limitation of Liability (Mutual)", clause_type: "approved",
      content: `IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, EVEN IF SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY'S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT, WHETHER IN CONTRACT, TORT, OR OTHERWISE, SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS PAID OR PAYABLE BY CUSTOMER IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM, OR (B) ONE HUNDRED THOUSAND DOLLARS (USD $100,000).`,
      notes: "Market standard mutual cap. Use for SaaS and MSA agreements. Preferred position — mutual and symmetric.",
    },
    {
      user_id: uid, title: "Mutual Indemnification (Balanced)", clause_type: "approved",
      content: `Each party ("Indemnifying Party") shall defend, indemnify, and hold harmless the other party and its officers, directors, employees, and agents from and against any third-party claims, damages, losses, and expenses (including reasonable attorneys' fees, not to exceed $50,000 per claim without prior written approval) arising directly from the Indemnifying Party's: (a) material breach of this Agreement; (b) gross negligence or willful misconduct; or (c) infringement of any third-party intellectual property right. The Indemnifying Party's obligation is contingent upon the Indemnified Party providing prompt written notice within 30 days of any claim and granting the Indemnifying Party sole control of defense.`,
      notes: "Balanced mutual indemnity. Avoids one-sided indemnification. Fee cap included. Preferred for all vendor agreements.",
    },
    {
      user_id: uid, title: "Data Breach Notification (48-Hour / GDPR+)", clause_type: "approved",
      content: `In the event of a confirmed or reasonably suspected Personal Data Breach, Data Processor shall notify Data Controller without undue delay and in any event no later than forty-eight (48) hours after becoming aware of the breach. Notification shall include: (a) description of the nature of the breach including categories and approximate number of data subjects and records affected; (b) contact details of the data protection officer or designated privacy contact; (c) likely consequences of the breach; and (d) measures taken or proposed to address the breach and mitigate its effects. Where full notification within 48 hours is not possible, an initial notification shall be provided within 24 hours with a commitment to provide complete details within 5 business days.`,
      notes: "Stricter than GDPR 72-hour minimum. 48-hour standard. Use for all agreements involving personal data or EU-facing contracts.",
    },
    {
      user_id: uid, title: "Auto-Renewal — 30-Day Notice", clause_type: "approved",
      content: `This Agreement shall automatically renew for successive one (1) year terms unless either party provides written notice of non-renewal to the other party at least thirty (30) days prior to the end of the then-current term. Provider shall send a written renewal reminder to Customer at least ninety (90) days before the end of each term. Either party may terminate this Agreement for convenience upon thirty (30) days prior written notice. Termination shall not relieve Customer of payment obligations accrued prior to the termination effective date.`,
      notes: "Preferred auto-renewal with 30-day notice and mandatory provider reminder at 90 days. Use to replace 60-day or longer notice provisions.",
    },
    {
      user_id: uid, title: "IP Ownership — Customer Data (AI Prohibition)", clause_type: "approved",
      content: `As between the parties, Customer retains all right, title, and interest in and to Customer Data, including all intellectual property rights therein. Provider acquires no rights in Customer Data except the limited, non-exclusive, non-transferable right to access and process Customer Data solely as necessary to provide the Services described in this Agreement. Provider shall not: (a) use Customer Data for any purpose other than providing the Services; (b) sell, license, or otherwise commercialize Customer Data; (c) use Customer Data or any derivative, anonymized, or aggregated version thereof to train, fine-tune, or improve any machine learning model, artificial intelligence system, or algorithm; or (d) use Customer Data for competitive benchmarking or product development purposes, without Customer's explicit prior written consent.`,
      notes: "Critical for AI/SaaS products. Explicitly prohibits training AI models on customer data. Use in all technology agreements.",
    },
    {
      user_id: uid, title: "Governing Law — Delaware (US)", clause_type: "approved",
      content: `This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions. The parties agree that the United Nations Convention on Contracts for the International Sale of Goods shall not apply to this Agreement. Any legal action or proceeding arising under or relating to this Agreement shall be brought exclusively in the federal or state courts located in New Castle County, Delaware, and the parties hereby irrevocably consent to the personal jurisdiction and venue therein. In any action to enforce this Agreement, the prevailing party shall be entitled to recover reasonable attorneys' fees and costs.`,
      notes: "Standard Delaware governing law. Preferred for US-incorporated entities. Includes CISG exclusion and fee-shifting.",
    },
    {
      user_id: uid, title: "Force Majeure (60-Day Exit)", clause_type: "fallback",
      content: `Neither party shall be liable for any failure or delay in performance under this Agreement (other than payment obligations) to the extent such failure or delay is caused by circumstances beyond such party's reasonable control, including but not limited to acts of God, natural disasters, epidemics or pandemics, war, terrorism, government actions, civil unrest, or failure of third-party telecommunications or cloud infrastructure providers ("Force Majeure Event"). The party experiencing the Force Majeure Event shall: (a) provide written notice to the other party within five (5) business days of the onset of the event, specifying the nature and anticipated duration; (b) use commercially reasonable efforts to resume performance and mitigate the impact; and (c) provide weekly status updates to the other party. If a Force Majeure Event continues for more than sixty (60) consecutive days, either party may terminate this Agreement upon ten (10) days written notice without penalty or further liability.`,
      notes: "Use as fallback when client insists on force majeure clause. Excludes payment obligations. 60-day termination trigger.",
    },
  ]);
  if (clErr) throw clErr;
  console.log("  Created 7 clause library entries");

  // ── Review Rules / Playbooks ────────────────────────────────────────────────
  console.log("Inserting review rules / playbooks…");
  const { error: rErr } = await db.from("review_rules").insert([
    {
      user_id: uid,
      title: "SaaS Vendor Playbook",
      description: "Standard positions for reviewing inbound SaaS subscription and software licensing agreements. Covers liability, data protection, auto-renewal, IP, and termination.",
      is_active: true,
      rules: [],
      playbook_text: `CONTRALYNE — SAAS VENDOR PLAYBOOK v1.0\n\nPURPOSE: Governs review of inbound SaaS subscription agreements and software licensing contracts.\n\n────────────────────────────────────────────\n1. LIABILITY CAP\n────────────────────────────────────────────\nPreferred:  Mutual cap at 12 months fees paid in the preceding year\nFallback:   6 months fees; must carve out data breach and IP infringement\nWalk-away:  Any clause imposing unlimited liability on us in any scenario\n\n────────────────────────────────────────────\n2. DATA PROTECTION\n────────────────────────────────────────────\nRequired:   Vendor holds SOC 2 Type II or ISO 27001 certification\nRequired:   48-hour breach notification (not 72-hour GDPR minimum)\nRequired:   Explicit prohibition on using our data to train AI/ML models\nRequired:   Prohibition on selling or sharing data with third parties\nWalk-away:  Any clause permitting use of our data for any purpose beyond service delivery\n\n────────────────────────────────────────────\n3. AUTO-RENEWAL\n────────────────────────────────────────────\nPreferred:  30-day non-renewal notice with vendor reminder at 90 days\nFallback:   45-day notice — absolute maximum acceptable\nWalk-away:  Notice period exceeding 60 days\n\n────────────────────────────────────────────\n4. INTELLECTUAL PROPERTY\n────────────────────────────────────────────\nRequired:   Customer retains all rights to their data and outputs\nRequired:   No license granted to vendor beyond service delivery\nRequired:   Prohibition on AI/ML training using customer data or derivatives\nWalk-away:  Any IP assignment or work-for-hire clause affecting customer content\n\n────────────────────────────────────────────\n5. TERMINATION\n────────────────────────────────────────────\nPreferred:  For convenience with 30 days notice, no penalty, pro-rated refund\nFallback:   60-day notice with pro-rated refund\nWalk-away:  Lock-in exceeding 12 months without an exit clause\n\n────────────────────────────────────────────\n6. GOVERNING LAW\n────────────────────────────────────────────\nPreferred:  Delaware or New York law\nAcceptable: Any US state\nWalk-away:  Non-US jurisdiction for domestic US contracts`,
    },
    {
      user_id: uid,
      title: "NDA Standard Playbook",
      description: "Standard positions for reviewing mutual and one-sided non-disclosure agreements. Covers mutuality, term length, exclusions, and remedies.",
      is_active: true,
      rules: [],
      playbook_text: `CONTRALYNE — NDA PLAYBOOK v1.0\n\nPURPOSE: Governs review of all inbound and outbound non-disclosure agreements.\n\n────────────────────────────────────────────\n1. MUTUALITY\n────────────────────────────────────────────\nPreferred:  Mutual NDA — both parties equally bound\nFallback:   One-sided acceptable only where we are solely the Recipient\nWalk-away:  One-sided NDA where we are the disclosing party with no protection\n\n────────────────────────────────────────────\n2. TERM\n────────────────────────────────────────────\nPreferred:  12 months from execution date\nFallback:   18 months acceptable\nWalk-away:  Any term exceeding 24 months or perpetual confidentiality obligations\n\n────────────────────────────────────────────\n3. EXCLUSIONS (REQUIRED IN ALL NDAs)\n────────────────────────────────────────────\nRequired:   (a) Information already in public domain through no fault of Recipient\nRequired:   (b) Information independently developed by Recipient without reference to Confidential Information\nRequired:   (c) Information received from a third party without restriction\nRequired:   (d) Information required to be disclosed by law, regulation, or court order (with notice to disclosing party)\nWalk-away:  Any NDA without all four standard exclusions\n\n────────────────────────────────────────────\n4. REMEDIES\n────────────────────────────────────────────\nPreferred:  Mutual right to seek equitable relief with 48-hour notice and bond requirement\nFallback:   Injunctive relief permitted but with bond requirement tied to claimed damages\nWalk-away:  Waiver of bond requirement for injunctions\n\n────────────────────────────────────────────\n5. SCOPE\n────────────────────────────────────────────\nRequired:   Clear, specific definition of Confidential Information\nRequired:   Explicit purpose limitation — information used only for stated evaluation purpose\nRequired:   Return or certified destruction within 10 business days upon request\nWalk-away:  Undefined or overreaching definition of confidential information`,
    },
    {
      user_id: uid,
      title: "MSA / Professional Services Playbook",
      description: "Positions for master services agreements and professional services contracts. Focuses on liability, indemnification, IP ownership of work product, and payment.",
      is_active: true,
      rules: [],
      playbook_text: `CONTRALYNE — MSA / PROFESSIONAL SERVICES PLAYBOOK v1.0\n\nPURPOSE: Governs review of master services agreements and professional services contracts.\n\n────────────────────────────────────────────\n1. LIABILITY CAP\n────────────────────────────────────────────\nPreferred:  Mutual cap at 1x total contract value, with floor of $250,000\nFallback:   Cap at 2x contract value for gross negligence scenarios only\nWalk-away:  Unlimited liability in any form — immediate escalation required\n\n────────────────────────────────────────────\n2. INDEMNIFICATION\n────────────────────────────────────────────\nPreferred:  Mutual, symmetric indemnification for proven breach only\nFallback:   One-sided acceptable if capped and limited to direct losses from material breach\nWalk-away:  Indemnification covering third-party claims or consequential losses without cap\n\n────────────────────────────────────────────\n3. PAYMENT TERMS\n────────────────────────────────────────────\nPreferred:  Net-30 from invoice date, 6% simple annual interest on late payments\nFallback:   Net-15 with 10% interest and 10-business-day cure period\nWalk-away:  Payment terms shorter than 7 days or interest rate above 12% per annum\n\n────────────────────────────────────────────\n4. WORK PRODUCT IP\n────────────────────────────────────────────\nPreferred:  All custom work product owned by Client upon full payment\nFallback:   License to work product — perpetual, irrevocable, royalty-free\nWalk-away:  Service Provider retains ownership of work product paid for by Client\n\n────────────────────────────────────────────\n5. TERMINATION\n────────────────────────────────────────────\nPreferred:  Termination for convenience with 30 days notice, payment for work completed\nFallback:   60-day notice with milestone-based payment on termination\nWalk-away:  No termination for convenience right, or termination fees exceeding 3 months value`,
    },
  ]);
  if (rErr) throw rErr;
  console.log("  Created 3 playbooks");

  console.log(`\nSeed complete. User: ${uid}`);
  console.log("  Clients: 3 | Contracts: 5 (3 analyzed) | Clauses: 7 | Playbooks: 3");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
