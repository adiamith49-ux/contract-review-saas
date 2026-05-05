# contract-review-saas
AI-powered contract review application designed to assist legal professionals in analyzing agreements efficiently. The tool focuses on generating structured risk summaries, redlines, and negotiation insights for contracts such as NDAs, MSAs, SaaS agreements, SOWs, and vendor contracts.

This project is being built as a lean MVP with a focus on practical legal workflows, especially for Indian and global corporate use cases.

🎯 Objective

To create a lightweight, AI-assisted system that:

Reduces contract review time
Highlights legal risks clearly
Suggests actionable redlines
Provides negotiation positions and fallback options
⚙️ Core Features (Current Scope)
📥 Contract input (text/file upload)
🧠 AI-based contract analysis
⚠️ Risk summary generation
✍️ Suggested redlines with reasoning
🤝 Negotiation points and fallback positions
📄 Structured output for easy review
🚧 Work in Progress

The application scaffold is generated but needs refinement and stabilization.

Immediate Goals:
Make backend fully runnable locally
Fix dependency/configuration issues
Ensure /analyze endpoint works reliably
Connect frontend to backend (basic flow)
🔧 Next Phase: Playbook Integration

We plan to introduce legal playbooks to improve output quality and consistency.

Playbook Features:
Clause-level risk rules (e.g., indemnity, liability, termination)
Predefined redline standards
Jurisdiction-specific (India-focused initially)
Custom negotiation strategies
🧱 Tech Stack (Auto-generated scaffold)
Frontend: Next.js
Backend: Node.js / Express (TypeScript)
Database: PostgreSQL
AI Integration: OpenAI API (with fallback logic)
Storage: Local/S3-compatible
👨‍💻 What is Needed

Looking for support to:

Run and stabilize the application locally
Fix setup/environment issues
Ensure API endpoints work correctly
Assist in implementing playbook integration logic
Improve AI output structure and reliability
🧠 Context

This project is led by a corporate lawyer with 12+ years of experience in contract negotiation and risk assessment. The focus is on combining legal expertise + AI to build a practical, high-impact tool rather than a generic platform.

🚀 Vision

Start with a focused contract review tool and evolve into a decision-support system for legal teams, prioritizing:

Speed
Accuracy
Practical usability
