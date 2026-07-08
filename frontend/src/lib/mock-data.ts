import type { Clause, ReviewRule, AnalyticsData, ContractListItem } from "./api";

// ─── Clause Library ───────────────────────────────────────────────────────────

export const MOCK_CLAUSES: Clause[] = [
  {
    id: "cl-1",
    user_id: "demo",
    title: "Mutual Non-Disclosure",
    clause_type: "approved",
    jurisdiction: "England & Wales",
    content:
      'Each party undertakes that it shall not at any time during this Agreement, and for a period of five years after termination of this Agreement, disclose to any person any confidential information concerning the business, affairs, customers, clients or suppliers of the other party or of any member of the group of companies to which the other party belongs, except as permitted by clause 2.2.',
    tags: ["NDA", "confidentiality", "mutual"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-10T09:00:00Z",
  },
  {
    id: "cl-2",
    user_id: "demo",
    title: "Limitation of Liability Cap",
    clause_type: "approved",
    jurisdiction: "England & Wales",
    content:
      "Each party's total aggregate liability in contract, tort (including negligence or breach of statutory duty), misrepresentation, restitution or otherwise, arising in connection with the performance or contemplated performance of this Agreement shall be limited to the greater of (a) the total fees paid or payable by the Customer in the 12-month period preceding the claim, or (b) £100,000.",
    tags: ["liability", "cap", "indemnity"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-12T11:30:00Z",
  },
  {
    id: "cl-3",
    user_id: "demo",
    title: "Governing Law — New York",
    clause_type: "approved",
    jurisdiction: "New York",
    content:
      "This Agreement and any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with it or its subject matter or formation shall be governed by and construed in accordance with the laws of the State of New York, without giving effect to any choice or conflict of law provision or rule.",
    tags: ["governing law", "New York", "jurisdiction"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-15T14:00:00Z",
  },
  {
    id: "cl-4",
    user_id: "demo",
    title: "Unlimited Liability Fallback",
    clause_type: "fallback",
    jurisdiction: null,
    content:
      "Notwithstanding any other provision of this Agreement, neither party's liability to the other shall be limited in respect of: (a) death or personal injury caused by its negligence; (b) fraud or fraudulent misrepresentation; or (c) any other liability which cannot be limited or excluded by law.",
    tags: ["liability", "unlimited", "carve-out"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-18T16:45:00Z",
  },
  {
    id: "cl-5",
    user_id: "demo",
    title: "Auto-Renewal with 30-Day Notice",
    clause_type: "approved",
    jurisdiction: null,
    content:
      "Unless either party gives the other not less than thirty (30) days' written notice before the end of the then-current term, this Agreement shall automatically renew for successive one-year periods at the pricing in effect at the time of renewal.",
    tags: ["renewal", "auto-renew", "termination"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-20T10:15:00Z",
  },
  {
    id: "cl-6",
    user_id: "demo",
    title: "IP Assignment (Work for Hire)",
    clause_type: "approved",
    jurisdiction: "United States (Federal)",
    content:
      "All work product, deliverables, and intellectual property created by Service Provider in connection with this Agreement are \"works made for hire\" within the meaning of the Copyright Act, 17 U.S.C. § 101, and shall be the sole and exclusive property of Client. To the extent any such materials do not constitute works made for hire, Service Provider hereby irrevocably assigns to Client all rights therein.",
    tags: ["IP", "work-for-hire", "assignment"], contract_types: [], status: "approved", source: null, version: 1,
    created_at: "2026-05-22T08:00:00Z",
  },
];

// ─── Review Rules ─────────────────────────────────────────────────────────────

export const MOCK_RULES: ReviewRule[] = [
  {
    id: "rr-1",
    user_id: "demo",
    name: "Mutual NDA Required",
    description:
      "Flag any NDA that is one-sided (only the counterparty's information is protected). Require mutual confidentiality obligations in all standard engagements.",
    is_active: true,
    created_at: "2026-05-08T09:00:00Z",
  },
  {
    id: "rr-2",
    user_id: "demo",
    name: "Liability Cap Must Be Present",
    description:
      "Every MSA or SaaS agreement must include a limitation of liability cap. Flag contracts where liability is unlimited or where the cap exceeds 12 months of fees.",
    is_active: true,
    created_at: "2026-05-09T10:00:00Z",
  },
  {
    id: "rr-3",
    user_id: "demo",
    name: "Governing Law — England & Wales Preferred",
    description:
      "For UK-based engagements flag any contract that specifies a governing law other than England & Wales unless a specific exemption has been approved in the intake form.",
    is_active: true,
    created_at: "2026-05-11T14:30:00Z",
  },
  {
    id: "rr-4",
    user_id: "demo",
    name: "IP Ownership — Client Must Own Deliverables",
    description:
      "Any SOW or employment agreement must clearly assign all deliverables and IP to the client. Flag contracts that use \"licence\" language instead of outright assignment.",
    is_active: true,
    created_at: "2026-05-13T11:00:00Z",
  },
  {
    id: "rr-5",
    user_id: "demo",
    name: "Auto-Renewal Notice Period ≥ 30 Days",
    description:
      "Flag any auto-renewal clause where the notice period for non-renewal is less than 30 calendar days. Minimum acceptable notice is 30 days.",
    is_active: false,
    created_at: "2026-05-16T09:15:00Z",
  },
  {
    id: "rr-6",
    user_id: "demo",
    name: "No Unilateral Amendment Rights",
    description:
      "Flag any clause that grants one party the right to amend contract terms unilaterally (e.g., SaaS pricing changes with notice only). Require mutual written consent.",
    is_active: true,
    created_at: "2026-05-18T16:00:00Z",
  },
  {
    id: "rr-7",
    user_id: "demo",
    name: "GDPR Data Processing Agreement",
    description:
      "For any contract involving processing of personal data of EU/UK residents, flag the absence of a DPA or GDPR-compliant data processing terms as a critical issue.",
    is_active: false,
    created_at: "2026-05-20T13:00:00Z",
  },
];

// ─── Analytics ────────────────────────────────────────────────────────────────

export const MOCK_ANALYTICS: AnalyticsData = {
  totals: {
    total: 34,
    analyzed: 28,
    high_risk: 9,
    pending: 6,
  },
  by_status: [
    { status: "analyzed", count: 28 },
    { status: "uploaded", count: 4 },
    { status: "processing", count: 2 },
    { status: "failed", count: 0 },
  ],
  by_type: [
    { contract_type: "nda", count: 11 },
    { contract_type: "msa", count: 8 },
    { contract_type: "saas", count: 6 },
    { contract_type: "sow", count: 4 },
    { contract_type: "employment", count: 3 },
    { contract_type: "vendor_agreement", count: 2 },
  ],
  by_risk: [
    { risk_level: "low", count: 9 },
    { risk_level: "medium", count: 12 },
    { risk_level: "high", count: 5 },
    { risk_level: "critical", count: 4 },
  ],
  uploads_per_month: [
    { month: "2025-12", count: 2 },
    { month: "2026-01", count: 3 },
    { month: "2026-02", count: 5 },
    { month: "2026-03", count: 4 },
    { month: "2026-04", count: 8 },
    { month: "2026-05", count: 12 },
  ],
  recent_activity: [
    {
      id: "a1",
      action: "contract_analyzed",
      entity_type: "contract",
      created_at: "2026-06-05T10:30:00Z",
    },
    {
      id: "a2",
      action: "contract_uploaded",
      entity_type: "contract",
      created_at: "2026-06-05T09:45:00Z",
    },
    {
      id: "a3",
      action: "chat_message_sent",
      entity_type: "chat",
      created_at: "2026-06-04T17:20:00Z",
    },
    {
      id: "a4",
      action: "contract_exported",
      entity_type: "export",
      created_at: "2026-06-04T15:10:00Z",
    },
    {
      id: "a5",
      action: "contract_analyzed",
      entity_type: "contract",
      created_at: "2026-06-03T11:05:00Z",
    },
    {
      id: "a6",
      action: "rule_created",
      entity_type: "rule",
      created_at: "2026-06-02T09:00:00Z",
    },
    {
      id: "a7",
      action: "clause_created",
      entity_type: "clause",
      created_at: "2026-06-01T14:30:00Z",
    },
  ],
};

// ─── Dashboard contracts (for the dashboard page) ─────────────────────────────

const nullMeta = {
  title: null, counterparty: null, contract_status: "draft",
  start_date: null, end_date: null, renewal_date: null,
  owner_name: null, contract_value: null,
  version_number: 1, parent_contract_id: null,
};

export const MOCK_CONTRACTS: ContractListItem[] = [
  {
    id: "c1",
    filename: "Acme_Corp_NDA_2026.pdf",
    contract_type: "nda",
    status: "analyzed",
    file_size: 245760,
    created_at: "2026-06-04T10:00:00Z",
    analyses: [{ id: "an1", risk_level: "medium" }],
    ...nullMeta,
    title: "Acme Corp NDA 2026",
    counterparty: "Acme Corporation",
    contract_status: "executed",
    end_date: "2027-06-03",
  },
  {
    id: "c2",
    filename: "DataFlow_MSA_v3_Final.pdf",
    contract_type: "msa",
    status: "analyzed",
    file_size: 819200,
    created_at: "2026-06-03T15:30:00Z",
    analyses: [{ id: "an2", risk_level: "critical" }],
    ...nullMeta,
    title: "DataFlow MSA v3",
    counterparty: "DataFlow Inc.",
    contract_status: "under_review",
  },
  {
    id: "c3",
    filename: "TechVentures_SaaS_Agreement.docx",
    contract_type: "saas",
    status: "analyzed",
    file_size: 512000,
    created_at: "2026-06-02T09:15:00Z",
    analyses: [{ id: "an3", risk_level: "high" }],
    ...nullMeta,
    title: "TechVentures SaaS Agreement",
    counterparty: "TechVentures Ltd",
    contract_status: "executed",
    renewal_date: "2026-09-01",
  },
  {
    id: "c4",
    filename: "Freelance_SOW_June2026.pdf",
    contract_type: "sow",
    status: "uploaded",
    file_size: 102400,
    created_at: "2026-06-05T08:00:00Z",
    analyses: [],
    ...nullMeta,
    contract_status: "draft",
  },
  {
    id: "c5",
    filename: "UK_Vendor_Agreement_Signed.pdf",
    contract_type: "vendor_agreement",
    status: "analyzed",
    file_size: 358400,
    created_at: "2026-05-28T11:00:00Z",
    analyses: [{ id: "an5", risk_level: "low" }],
    ...nullMeta,
    title: "UK Vendor Agreement",
    counterparty: "Global Supplies Ltd",
    contract_status: "executed",
    end_date: "2025-12-31",
  },
];
