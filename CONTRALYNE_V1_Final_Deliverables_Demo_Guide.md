# CONTRALYNE V1

## Final Deliverables Clarification, Demo Expectations, Acceptance Criteria & Development Alignment Guide

**Prepared for:** Kartik and Pranav  
**Prepared by:** Amit — Founder, CONTRALYNE  
**Purpose:** Single reference document for V1 development discussions and upcoming demos

> **Confidentiality Note:** This document contains product vision, workflow direction, feature expectations, and proprietary planning for CONTRALYNE. It should be treated as confidential and used only for the current development engagement.

---

## Purpose of this Document

This document is intended to clarify the expected functionality for each agreed deliverable under the CONTRALYNE V1 scope and to serve as a reference for future demos, development discussions and acceptance reviews.

The objective is not to add new scope, but to ensure that all parties have a common understanding of what each deliverable means from a product, legal workflow and user experience perspective.

CONTRALYNE should not feel like a basic AI-generated tool. It should move towards a professional enterprise legal SaaS experience with structured workflows, strong UI/UX, contract review intelligence, collaboration, repository logic and future CLM readiness.

---

## How this Document Should Be Used

- Use this as the reference for future demos and development alignment.
- For each module, demonstrate live functionality wherever possible.
- Where functionality is incomplete, mark it as **Pending** or **Phase 2** with explanation.
- Use references such as ContractKen, Ironclad, SpotDraft, Lexzur, Streamline AI and ContractDesk to improve both frontend and backend thinking.
- Do not treat UI/UX as secondary. For enterprise legal customers, product confidence starts with the interface.

---

## Priority Ranking

| Priority | Meaning | Modules |
|---|---|---|
| **P0 - Must Have V1** | Core product cannot be meaningfully tested without this. | Authentication, Upload, AI Review, Risk Analysis, Redlining, Playbooks, Export, Backend |
| **P1 - Important V1/V1.5** | Strongly required for enterprise product feel and meaningful demo. | Repository, Intake, Approvals, Collaboration, Version Comparison |
| **P2 - Phase 2 / Enhancement** | Can be expanded after the core product is stable. | Advanced analytics, advanced institutional memory, full customer branding, deep integrations |

---

## Reference Mapping by Module

| Module | Primary Reference | What to Study |
|---|---|---|
| Secure User Authentication & Account Management | Ironclad, SpotDraft, enterprise SaaS admin patterns. | This is the entry and access-control layer of CONTRALYNE. It is not only login. It should allow an organization to onboard users, assign roles, and ensure that legal, procurement, sales, finance, admin and external users see only what they are permitted to see. |
| Contract Upload & Document Management Workflows | Lexzur repository, Ironclad contract record, SpotDraft contract workspace. | The upload feature should not behave like a simple file uploader. Each uploaded contract should become a contract record with metadata, status, owner, vendor/counterparty, start date, end date, renewal date, risk level, version history and review status. |
| AI-Assisted Contract Review & Clause Extraction | ContractKen, Luminance Review, Spellbook-style clause review. | The system should read a contract and identify key clauses automatically. It should extract clauses like limitation of liability, indemnity, termination, confidentiality, data protection, IP ownership, governing law and payment terms, then summarize and flag issues. |
| Risk Analysis & Negotiation Suggestions | ContractKen review and negotiation screens. | The product should not merely say 'this is risky'. It should explain why the clause is risky, classify severity, propose fallback language and provide negotiation guidance that a legal user can use directly with a counterparty. |
| Legal Intake & Contextual Review System | Ironclad intake, SpotDraft request flow. | Legal review starts before a contract is uploaded. Business teams usually send requests to legal with missing context. A legal intake form captures key business details so the legal team knows what is being reviewed, why, for whom and how urgent it is. |
| Legal Playbook & Policy-Based Review Logic | ContractKen playbook review, Ironclad playbook concepts. | A playbook is the company's legal rulebook. It defines preferred positions, fallback positions, escalation triggers and unacceptable clauses. AI review should compare contract language against the selected playbook. |
| Workflow Automation & Approval Routing | Ironclad approvals, Lexzur workflows, SpotDraft approvals. | Contracts often need business, finance, legal and executive approvals. Approval routing means the system should identify who must approve based on contract value, risk score, department, jurisdiction or playbook deviation. |
| Matter Tracking & Collaboration Functionality | SpotDraft collaboration, Ironclad activity stream, Google Docs comments. | A contract is a collaborative matter. Legal, procurement, sales, finance and external parties may all comment, assign tasks, ask questions and track status. Matter tracking means the contract has a workspace where all activity is visible. |
| Contract Comparison & Version Analysis | Word tracked changes, ContractKen redline workflow, SpotDraft versioning. | Negotiation creates multiple drafts. Users need to compare versions and see what changed. This should support version uploads and redline comparison between drafts, not only export an AI report. |
| Clause Library & Institutional Legal Memory | ContractKen clause/playbook concepts, legal knowledge management tools. | Clause library is a repository of approved language. Institutional memory means the system gradually captures what the organization usually accepts, rejects or escalates, so legal knowledge is not trapped in individual lawyers' memory. |
| Reporting, Dashboards & Analytics | Streamline AI dashboards, Lexzur reports, Ironclad analytics. | Dashboards and reports give leadership visibility into contract volume, risks, expiry dates, approval bottlenecks and operational performance. |
| Jurisdiction-Aware Legal Workflow | Global CLM configuration patterns, Ironclad/enterprise legal workflows. | Because CONTRALYNE targets global clients, review logic should change based on jurisdiction/governing law. A US SaaS agreement, India vendor agreement and UK NDA may require different risk positions and playbooks. |
| Backend APIs, Database Systems & Infrastructure | Enterprise SaaS best practices. | This is the invisible technical foundation. It should support secure storage, stable performance, clean APIs, future integrations, reliable data model and scalability. |
| Export & Download Functionality | ContractKen export/report workflow, Word legal review workflow. | Legal users need usable outputs outside the platform. Export should include review report, risk summary, suggested language and preferably redlined Word output with comments/tracked changes. |

---

## Module Detail

### 1. Secure User Authentication & Account Management

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Basic demonstrated: Google login working. Team/role management still needs confirmation. |
| **Primary References** | Ironclad, SpotDraft, enterprise SaaS admin patterns. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

This is the entry and access-control layer of CONTRALYNE. It is not only login. It should allow an organization to onboard users, assign roles, and ensure that legal, procurement, sales, finance, admin and external users see only what they are permitted to see.

**What I expect to see in the demo**

- Google login and email login flow.
- Forgot password / reset flow or clear plan for it.
- User profile page.
- Invite team member option.
- Role-based permissions: Admin, Legal, Procurement, Sales/Business, Finance, Executive, External User.
- Show that restricted users cannot access unauthorized pages or contracts.

**Acceptance criteria / definition of done**

- A new user can sign up/login without developer support.
- Admin can invite or manage users.
- Each role has a different permission level.
- API/backend should enforce permissions; not only hide buttons on frontend.
- Session expiry/logout works properly.

**Simple screen/workflow mock**

`Login Page → Google/Email Login → Dashboard. Admin Panel → Users → Invite User → Assign Role → Save.`

**Questions to ask Kartik and Pranav during demo**

- Can we create an Admin user and a Legal user and show different access?
- Where are user roles stored?
- Can a user from one customer/tenant see another customer's data?
- How will this scale when multiple companies subscribe?

---

### 2. Contract Upload & Document Management Workflows

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Partially demonstrated: Upload works. Full lifecycle management, metadata and versions need deeper validation. |
| **Primary References** | Lexzur repository, Ironclad contract record, SpotDraft contract workspace. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

The upload feature should not behave like a simple file uploader. Each uploaded contract should become a contract record with metadata, status, owner, vendor/counterparty, start date, end date, renewal date, risk level, version history and review status.

**What I expect to see in the demo**

- Upload PDF/DOCX.
- Enter contract metadata: title, counterparty, contract type, start/end date, renewal date, governing law, owner, value, status.
- View contract details page.
- Search, filter and categorize contracts.
- Upload multiple negotiated versions under the same contract record.
- Download original and reviewed versions.

**Acceptance criteria / definition of done**

- Each contract has a unique record ID.
- Users can retrieve contracts by vendor, type, status, owner and renewal date.
- Version history is visible for each negotiation round.
- Repository shows active/expired/renewal due status.
- Documents are stored securely and linked to metadata.

**Simple screen/workflow mock**

`Repository → Vendor ABC → MSA 2026 → Details: Status Active | Start Date | End Date | Renewal | Owner | Versions | Review Report.`

**Questions to ask Kartik and Pranav during demo**

- When I upload Version 2 of the same contract, where does it appear?
- Can I see all contracts for one vendor in one place?
- Can I search by vendor and renewal date?
- What metadata is mandatory before review begins?

---

### 3. AI-Assisted Contract Review & Clause Extraction

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Partially demonstrated: AI review exists. Clause extraction depth still needs to be proven. |
| **Primary References** | ContractKen, Luminance Review, Spellbook-style clause review. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

The system should read a contract and identify key clauses automatically. It should extract clauses like limitation of liability, indemnity, termination, confidentiality, data protection, IP ownership, governing law and payment terms, then summarize and flag issues.

**What I expect to see in the demo**

- Upload one NDA/MSA/SaaS agreement.
- Show extracted clause list.
- Show clause summary and contract summary.
- Show missing clauses if any.
- Show clause-specific risk explanations.
- Show metadata extraction: parties, dates, governing law, term, renewal, notice period.

**Acceptance criteria / definition of done**

- AI identifies standard commercial clauses correctly.
- Each extracted clause links back to the relevant contract text.
- AI output is not generic; it must refer to the actual uploaded contract language.
- Review should complete within a reasonable time for a standard 15–25 page contract.
- User can navigate from risk summary to specific clause.

**Simple screen/workflow mock**

`AI Review Workspace: Left panel = Contract Viewer. Right panel = Extracted Clauses + Risk Score + Explanation + Suggested Action.`

**Questions to ask Kartik and Pranav during demo**

- Can the system show the exact clause text that triggered the risk?
- Can it identify missing clauses?
- Can it distinguish indemnity from limitation of liability?
- How is the output grounded in the actual contract text?

---

### 4. Risk Analysis & Negotiation Suggestions

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Mostly working for report/suggestions. Redlining with comments is pending/in progress. |
| **Primary References** | ContractKen review and negotiation screens. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

The product should not merely say 'this is risky'. It should explain why the clause is risky, classify severity, propose fallback language and provide negotiation guidance that a legal user can use directly with a counterparty.

**What I expect to see in the demo**

- Risk rating for each issue: High/Medium/Low/Critical.
- Plain-English risk explanation.
- Suggested fallback clause.
- Negotiation comment/reasoning.
- Accept, reject or edit suggested language.
- Redlining/comments within the document or exportable Word format.

**Acceptance criteria / definition of done**

- Each risk has a clause reference.
- Suggestions must be practical legal language, not generic advice.
- User can convert a suggestion into a redline or comment.
- Final output can be downloaded in Word/PDF.
- Risk report and redline output should be consistent.

**Simple screen/workflow mock**

`Risk Card: 'Unlimited liability - Critical' → Why it matters → Proposed clause → Add comment → Apply redline → Export.`

**Questions to ask Kartik and Pranav during demo**

- Can you show one critical risk becoming a redline?
- Can I edit the suggested fallback before export?
- Does the Word export show comments/tracked changes?
- What happens if I reject a suggestion?

---

### 5. Legal Intake & Contextual Review System

| Field | Value |
|---|---|
| **Priority** | Important - V1/V1.5 depending on feasibility |
| **Current Status** | Not demonstrated. |
| **Primary References** | Ironclad intake, SpotDraft request flow. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Legal review starts before a contract is uploaded. Business teams usually send requests to legal with missing context. A legal intake form captures key business details so the legal team knows what is being reviewed, why, for whom and how urgent it is.

**What I expect to see in the demo**

- New Contract Request button.
- Form fields: counterparty, contract type, deal value, business owner, department, urgency, jurisdiction, start date, end date, renewal, special instructions.
- Attach/upload contract from intake form.
- Request status: Submitted, Under Review, In Negotiation, Pending Approval, Executed.
- Legal reviewer receives the request with context.

**Acceptance criteria / definition of done**

- A contract review can be initiated through an intake form.
- Metadata follows the contract into review and repository.
- Legal user sees business context next to contract review.
- Urgency/status/owner can be tracked.
- No contract should appear as an isolated file without context.

**Simple screen/workflow mock**

`New Contract Request → Intake Form → Upload Contract → Submit → Legal Review Queue → AI Review.`

**Questions to ask Kartik and Pranav during demo**

- Where does a sales/procurement user submit a request?
- Can legal see the deal value and urgency before review?
- Does intake metadata appear in repository?
- Can intake status be tracked?

---

### 6. Legal Playbook & Policy-Based Review Logic

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Basic workflow demonstrated. Needs validation that AI genuinely applies rules. |
| **Primary References** | ContractKen playbook review, Ironclad playbook concepts. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

A playbook is the company's legal rulebook. It defines preferred positions, fallback positions, escalation triggers and unacceptable clauses. AI review should compare contract language against the selected playbook.

**What I expect to see in the demo**

- Create/edit playbook manually.
- Add clause rule: preferred, fallback, unacceptable/walk-away language.
- Select playbook during review.
- Run review with playbook and without playbook to show difference.
- AI flags deviations from selected playbook.

**Acceptance criteria / definition of done**

- Review output changes based on selected playbook.
- At least 5–10 clause rules can be stored and applied.
- Playbook deviations show the rule that was triggered.
- Users can update playbook without developer intervention, at least at a basic level.
- Playbook name/version is stored with review output.

**Simple screen/workflow mock**

`Playbooks → SaaS Vendor Playbook → Clause Rule: Liability Cap → Preferred: 12 months fees → Review Contract → Deviation Flag.`

**Questions to ask Kartik and Pranav during demo**

- Can you show the same contract reviewed with and without a playbook?
- Which playbook rule triggered this risk?
- Can I create one SaaS playbook and one NDA playbook?
- Can playbooks be imported later?

---

### 7. Workflow Automation & Approval Routing

| Field | Value |
|---|---|
| **Priority** | Important - V1/V1.5 |
| **Current Status** | Not demonstrated. |
| **Primary References** | Ironclad approvals, Lexzur workflows, SpotDraft approvals. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Contracts often need business, finance, legal and executive approvals. Approval routing means the system should identify who must approve based on contract value, risk score, department, jurisdiction or playbook deviation.

**What I expect to see in the demo**

- Approval matrix setup: if value > threshold or risk is high, route to approver.
- Submit contract for approval.
- Approver receives task/notification.
- Approve, reject or request changes.
- Approval history visible on contract page.

**Acceptance criteria / definition of done**

- Contract status changes when submitted for approval.
- Approver list is visible.
- Pending approvals are clearly shown.
- Comments are captured when approving/rejecting.
- Approval history is stored for audit.

**Simple screen/workflow mock**

`Contract Review → Submit for Approval → Legal Director → Finance → Approved → Signature Ready.`

**Questions to ask Kartik and Pranav during demo**

- Can you show an approval chain for a high-risk contract?
- Can I see who approval is pending with?
- What happens when an approver rejects?
- Is approval history stored in the repository?

---

### 8. Matter Tracking & Collaboration Functionality

| Field | Value |
|---|---|
| **Priority** | Important - V1/V1.5 |
| **Current Status** | Not demonstrated. |
| **Primary References** | SpotDraft collaboration, Ironclad activity stream, Google Docs comments. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

A contract is a collaborative matter. Legal, procurement, sales, finance and external parties may all comment, assign tasks, ask questions and track status. Matter tracking means the contract has a workspace where all activity is visible.

**What I expect to see in the demo**

- Contract activity timeline.
- Internal comments.
- User mentions/tags.
- Assign task to user.
- Status updates: Under Review, Waiting for Business, Sent to Counterparty, Pending Approval.
- Team view showing people involved.

**Acceptance criteria / definition of done**

- Users can leave comments without changing the document.
- Tasks and comments are tied to the contract record.
- Activity timeline captures key actions.
- Team members and ownership are visible.
- Collaboration does not expose internal comments to external users unless intended.

**Simple screen/workflow mock**

`Contract Workspace → Comments Tab → @Sales Please confirm commercial position → Task Assigned → Activity Log.`

**Questions to ask Kartik and Pranav during demo**

- Can legal tag procurement on a clause?
- Can I see all activity on this contract?
- Can internal notes be separated from counterparty-visible comments?
- Can tasks be assigned and closed?

---

### 9. Contract Comparison & Version Analysis

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 if redlining/negotiation is core |
| **Current Status** | Not demonstrated; redlining expected next. |
| **Primary References** | Word tracked changes, ContractKen redline workflow, SpotDraft versioning. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Negotiation creates multiple drafts. Users need to compare versions and see what changed. This should support version uploads and redline comparison between drafts, not only export an AI report.

**What I expect to see in the demo**

- Upload Draft 1 and Draft 2.
- Compare versions.
- Show added/deleted/modified clauses.
- Show AI summary of changes.
- Download redline or comparison report.
- Store comparison under contract record.

**Acceptance criteria / definition of done**

- System can maintain version history.
- User can see version date/uploader/status.
- Comparison highlights substantive changes.
- Redlines/comments can be exported.
- No confusion between original, reviewed and latest version.

**Simple screen/workflow mock**

`Versions Tab → V1 Original | V2 Counterparty Redline | V3 Final → Compare V1 vs V2 → Changes Summary.`

**Questions to ask Kartik and Pranav during demo**

- Can I upload a counterparty revised draft and compare it with our prior version?
- Can the system summarize what changed?
- Can I download the comparison?
- Where are old versions stored?

---

### 10. Clause Library & Institutional Legal Memory

| Field | Value |
|---|---|
| **Priority** | Must Have basic version; advanced memory can be V2 |
| **Current Status** | Basic manual clause library shown. Automated extraction/institutional memory not shown. |
| **Primary References** | ContractKen clause/playbook concepts, legal knowledge management tools. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Clause library is a repository of approved language. Institutional memory means the system gradually captures what the organization usually accepts, rejects or escalates, so legal knowledge is not trapped in individual lawyers' memory.

**What I expect to see in the demo**

- Add clause manually.
- Categorize clause by type and contract type.
- Search clause library.
- Copy/insert approved clause into review/redline.
- Tag clauses as preferred/fallback/walk-away.
- Show plan for future automatic extraction from historical agreements.

**Acceptance criteria / definition of done**

- Clause library is searchable.
- Clauses have categories and tags.
- Users can reuse clauses in review/redline workflow.
- Approved clauses are separated from draft/unapproved clauses.
- Clause source/version is visible.

**Simple screen/workflow mock**

`Clause Library → Category: Liability → Preferred Clause → Fallback Clause → Insert into Redline.`

**Questions to ask Kartik and Pranav during demo**

- Can I search for limitation of liability clauses?
- Can I mark one clause as preferred and another as fallback?
- Can clauses be inserted into negotiation suggestions?
- Can bulk extraction from historical contracts be considered later?

---

### 11. Reporting, Dashboards & Analytics

| Field | Value |
|---|---|
| **Priority** | Important - V1 basic; advanced analytics V2 |
| **Current Status** | Basic dashboard only. |
| **Primary References** | Streamline AI dashboards, Lexzur reports, Ironclad analytics. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Dashboards and reports give leadership visibility into contract volume, risks, expiry dates, approval bottlenecks and operational performance. This is important for legal operations and enterprise confidence.

**What I expect to see in the demo**

- Dashboard showing total contracts, pending reviews, high-risk contracts, expiring soon, pending approvals.
- Filter by vendor, contract type, status, owner and risk.
- Basic chart or list for risk trends/expiry timeline.
- Export simple report if feasible.

**Acceptance criteria / definition of done**

- Dashboard data comes from actual stored contracts, not static sample data.
- Expiring/renewal contracts are visible.
- High-risk contracts are visible.
- User can click dashboard item and reach filtered contract list.
- Basic reports support operational decision-making.

**Simple screen/workflow mock**

`Dashboard → KPI Cards: Total Contracts | High Risk | Pending Approval | Expiring Soon → Click High Risk → Filtered List.`

**Questions to ask Kartik and Pranav during demo**

- Is dashboard using live repository data?
- Can I filter by vendor and risk?
- Can I see contracts expiring in 30/60/90 days?
- Can this be extended later into analytics?

---

### 12. Jurisdiction-Aware Legal Workflow

| Field | Value |
|---|---|
| **Priority** | Important for global positioning; basic V1 logic acceptable |
| **Current Status** | Not demonstrated. |
| **Primary References** | Global CLM configuration patterns, Ironclad/enterprise legal workflows. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Because CONTRALYNE targets global clients, review logic should change based on jurisdiction/governing law. A US SaaS agreement, India vendor agreement and UK NDA may require different risk positions and playbooks.

**What I expect to see in the demo**

- Governing law/jurisdiction field during intake/upload.
- Select jurisdiction-specific playbook.
- AI review uses selected jurisdiction context.
- Risk explanation mentions jurisdiction context where applicable.

**Acceptance criteria / definition of done**

- User can choose governing law or region.
- Different playbooks can be associated with different jurisdictions.
- The same clause can be reviewed differently depending on jurisdiction/playbook.
- System stores jurisdiction metadata in repository.

**Simple screen/workflow mock**

`Upload Contract → Governing Law: California → Select US SaaS Playbook → AI Review with US-focused risk positions.`

**Questions to ask Kartik and Pranav during demo**

- Where do I select governing law?
- Can I create India, US and UK playbooks?
- Does jurisdiction affect AI review output?
- Can jurisdiction be searched/filterable in repository?

---

### 13. Backend APIs, Database Systems & Infrastructure

| Field | Value |
|---|---|
| **Priority** | Must Have - foundation |
| **Current Status** | Likely in progress; needs architecture walkthrough. |
| **Primary References** | Enterprise SaaS best practices. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

This is the invisible technical foundation. It should support secure storage, stable performance, clean APIs, future integrations, reliable data model and scalability. It should avoid building a fragile demo that cannot grow.

**What I expect to see in the demo**

- Basic architecture overview.
- Database entities: users, organizations, contracts, versions, clauses, playbooks, reviews, approvals.
- Secure file storage approach.
- API structure overview.
- Environment variables/secrets management.
- Deployment pipeline overview.

**Acceptance criteria / definition of done**

- Application is stable and hosted.
- Data is stored in structured tables, not just temporary files.
- Source code is in founder-owned GitHub repository.
- Secrets are not hardcoded.
- Architecture can support future modules without full rebuild.

**Simple screen/workflow mock**

`Frontend → API Layer → Database/Supabase → File Storage/S3 → AI Provider Layer → Export Engine.`

**Questions to ask Kartik and Pranav during demo**

- What are the core database tables?
- How are uploaded documents stored?
- How are AI outputs stored?
- Can DocuSign/OpenAI/Anthropic be swapped or extended later?
- Are secrets stored securely?

---

### 14. Export & Download Functionality

| Field | Value |
|---|---|
| **Priority** | Must Have - V1 |
| **Current Status** | Demonstrated: PDF/Word export working. Needs redline/comment validation. |
| **Primary References** | ContractKen export/report workflow, Word legal review workflow. |
| **V1 Acceptance** | Demonstrable in live product, not just verbally explained. |

**What this deliverable means**

Legal users need usable outputs outside the platform. Export should include review report, risk summary, suggested language and preferably redlined Word output with comments/tracked changes.

**What I expect to see in the demo**

- Export review report as PDF.
- Export reviewed contract as Word.
- Export redline/comments once available.
- Download original contract.
- Download final reviewed version.

**Acceptance criteria / definition of done**

- Downloaded files are readable and professionally formatted.
- Word export preserves legal usability.
- Risk report matches UI findings.
- Exported documents can be shared with business/counterparty.
- File naming/versioning is clear.

**Simple screen/workflow mock**

`Review Complete → Export Options: PDF Risk Report | Word Redline | Original Contract | Final Reviewed Contract.`

**Questions to ask Kartik and Pranav during demo**

- Can the Word output show comments and suggested edits?
- Can I export only the risk report?
- Can I download original and reviewed versions separately?
- Will export work after multiple negotiation rounds?

---

## Overall Demo Acceptance Checklist

For upcoming demos, the product should be reviewed against the following end-to-end flow. This is the most important test because it shows whether CONTRALYNE works as a product and not just as disconnected screens.

- [ ] Create/login as a user.
- [ ] Create or upload a contract request with business context.
- [ ] Upload a contract and add metadata such as vendor, contract type, value, start date, end date, renewal date and governing law.
- [ ] Run AI review with and without a playbook.
- [ ] Show clause extraction, risk analysis and negotiation suggestions.
- [ ] Apply redlines/comments and export to Word/PDF.
- [ ] Store the reviewed contract in repository with versions and metadata.
- [ ] Show approval status or planned approval routing.
- [ ] Show collaboration/comments or planned collaboration workflow.
- [ ] Show where DocuSign integration will sit in the workflow.
- [ ] Show dashboard/repository view reflecting real stored contract data.

---

## Questions to Ask During Every Review Call

- What was completed since the last call?
- What is in progress?
- What is blocked?
- Which deliverables are Completed, In Progress or Pending?
- Which items are V1 and which are proposed for Phase 2?
- Is this functionality working with real data or sample/static data?
- Can you demonstrate it live end-to-end?
- What is the expected completion date for pending items?
- What do you need from me to unblock development?

---

## Founder Note

Additional features can be evaluated for future versions where appropriate. However, I would request that the team periodically revisit the development agreement, SOPs, workflow documents, screenshots, demo videos, and product references previously shared. The objective is to ensure that the final V1 demonstration reflects the originally intended vision of CONTRALYNE as a professional enterprise-grade legal technology platform rather than a basic contract review application.

My concern is not about adding new requirements every week. My concern is that the originally discussed V1 vision, workflows, deliverables and user experience should be clearly understood and demonstrated. If any item is not feasible in V1, please identify it clearly, explain why, and propose whether it should be handled in Phase 2. This will help avoid misunderstanding and keep the development process structured.

---

## Short Note to Send with this Document

Hi Kartik and Pranav, sharing this final deliverables clarification document as the single reference point for CONTRALYNE V1. The purpose is not to add scope, but to ensure we have a common understanding of the intended functionality, workflows, priorities, demo expectations and acceptance criteria. Please review this in detail along with the SOPs, screenshots, videos and product references shared earlier. Going forward, I would like us to use this document to align weekly demos and clearly mark what is completed, in progress and pending.
