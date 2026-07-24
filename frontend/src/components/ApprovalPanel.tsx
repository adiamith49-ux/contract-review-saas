"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock,
  MessageSquareWarning, MinusCircle, Send, UserCheck, History, Paperclip, Download, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getApprovals, submitForApproval, decideApproval,
  type ApprovalState, type ApprovalStep,
} from "@/lib/api";

interface Props {
  contractId: string;
  contractStatus: string | null | undefined;
  getToken: () => Promise<string | null>;
  onChanged?: () => void; // parent reloads contract (status chip changes)
}

const STEP_STATUS: Record<ApprovalStep["status"], { label: string; icon: React.ReactNode; cls: string }> = {
  pending:            { label: "Pending",           icon: <Clock className="h-3.5 w-3.5" />,               cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved:           { label: "Approved",          icon: <CheckCircle2 className="h-3.5 w-3.5" />,        cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:           { label: "Rejected",          icon: <XCircle className="h-3.5 w-3.5" />,             cls: "bg-red-100 text-red-700 border-red-200" },
  changes_requested:  { label: "Changes Requested", icon: <MessageSquareWarning className="h-3.5 w-3.5" />, cls: "bg-orange-100 text-orange-700 border-orange-200" },
  skipped:            { label: "Skipped",           icon: <MinusCircle className="h-3.5 w-3.5" />,         cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function ApprovalPanel({ contractId, contractStatus, getToken, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ApprovalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null); // decision being saved
  const [comment, setComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      setState(await getApprovals(token, contractId));
    } catch { /* panel stays empty */ } finally {
      setLoading(false);
    }
  }, [contractId, getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const token = await getToken();
      const { steps } = await submitForApproval(token, contractId, {
        note: submissionNote.trim() || undefined,
        file: submissionFile ?? undefined,
      });
      toast.success(`Submitted for approval — pending with ${steps[0]?.approver_name}`);
      setSubmissionNote("");
      setSubmissionFile(null);
      setOpen(true);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit for approval");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecide(step: ApprovalStep, decision: "approved" | "rejected" | "changes_requested") {
    if (decision !== "approved" && !comment.trim()) {
      toast.error("A comment is required when rejecting or requesting changes");
      return;
    }
    setDeciding(decision);
    try {
      const token = await getToken();
      const res = await decideApproval(token, step.id, decision, comment);
      if (res.chain_complete) toast.success("All approvals complete — contract is Approved");
      else if (decision === "approved") toast.success(`${step.approver_name} approved`);
      else toast.info(decision === "rejected" ? "Contract rejected — moved to On Hold" : "Changes requested — moved to In Negotiation");
      setComment("");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setDeciding(null);
    }
  }

  const chain = state?.chain ?? [];
  const pendingWith = state?.pending_with ?? null;
  const submitted = chain.length > 0;
  const priorRounds = (state?.history ?? []).filter(s => s.round !== state?.current_round);

  // Summary chip for the collapsed band
  let chip: { label: string; cls: string } | null = null;
  if (pendingWith) chip = { label: `Pending with ${pendingWith.approver_name}`, cls: "bg-amber-100 text-amber-700 border-amber-200" };
  else if (submitted && chain.every(s => s.status === "approved")) chip = { label: "Fully approved", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  else if (submitted && chain.some(s => s.status === "rejected")) chip = { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" };
  else if (submitted && chain.some(s => s.status === "changes_requested")) chip = { label: "Changes requested", cls: "bg-orange-100 text-orange-700 border-orange-200" };

  return (
    <div className="shrink-0 border-b bg-white">
      {/* Collapsed band */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 md:px-5 py-2 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <UserCheck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-700">Approval Workflow</span>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-gray-300" />
        ) : chip ? (
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", chip.cls)}>
            {chip.label}
          </span>
        ) : (
          <span className="text-[11px] text-gray-400">Not submitted</span>
        )}
        <span className="ml-auto text-gray-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && !loading && (
        <div className="px-3 md:px-5 pb-4 space-y-3">
          {/* Not yet submitted */}
          {!pendingWith && (
            <div className="rounded-lg border border-dashed bg-gray-50/60 px-4 py-3 space-y-3">
              <p className="text-xs text-gray-500">
                {submitted
                  ? "This round is complete. Resubmit to start a new approval round."
                  : <>Route this contract through your firm&apos;s approval chain. Approvers are picked from your <Link href="/approvals" className="text-primary hover:underline font-medium">approval matrix</Link> based on value, risk, department and jurisdiction.</>}
              </p>

              <Textarea
                value={submissionNote}
                onChange={e => setSubmissionNote(e.target.value)}
                placeholder="Optional note for the approver(s)…"
                className="text-xs min-h-[54px] bg-white"
                disabled={submitting}
                maxLength={2000}
              />

              {submissionFile ? (
                <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="flex-1 truncate text-gray-700">{submissionFile.name}</span>
                  <button type="button" onClick={() => setSubmissionFile(null)} disabled={submitting} className="text-gray-400 hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={e => setSubmissionFile(e.target.files?.[0] ?? null)}
                  disabled={submitting}
                  className="w-full text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
              )}

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSubmit} disabled={submitting || contractStatus === "pending_approval"}>
                  {submitting
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Submitting…</>
                    : <><Send className="h-3.5 w-3.5 mr-1.5" />{submitted ? "Resubmit for Approval" : "Submit for Approval"}</>}
                </Button>
              </div>
            </div>
          )}

          {/* Current chain */}
          {submitted && (
            <>
              {(chain[0]?.submission_note || chain[0]?.attachment_url) && (
                <div className="rounded-lg border bg-gray-50/60 px-3.5 py-2.5 space-y-1.5">
                  {chain[0]?.submission_note && (
                    <p className="text-xs text-gray-600 italic">“{chain[0].submission_note}”</p>
                  )}
                  {chain[0]?.attachment_url && (
                    <a
                      href={chain[0].attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {chain[0].attachment_filename ?? "Download attachment"}
                    </a>
                  )}
                </div>
              )}
              <ol className="space-y-2">
              {chain.map(step => {
                const meta = STEP_STATUS[step.status];
                const actionable = pendingWith?.id === step.id;
                return (
                  <li key={step.id} className={cn("rounded-lg border px-3.5 py-2.5", actionable ? "border-amber-300 bg-amber-50/40" : "bg-white")}>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 shrink-0">
                        {step.step_order}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">{step.approver_name}</span>
                      {step.approver_email && <span className="text-[11px] text-gray-400">{step.approver_email}</span>}
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                        {meta.icon}{meta.label}
                      </span>
                      {step.decided_at && (
                        <span className="text-[10px] text-gray-400">{new Date(step.decided_at).toLocaleString()}</span>
                      )}
                    </div>
                    {(step.rule_name || step.matched_reason) && (
                      <p className="mt-1 ml-7 text-[11px] text-gray-400">
                        {step.rule_name}{step.matched_reason ? ` — triggered because ${step.matched_reason}` : ""}
                      </p>
                    )}
                    {step.comment && (
                      <p className="mt-1.5 ml-7 rounded-md bg-gray-50 border px-2.5 py-1.5 text-[11px] text-gray-600 italic">
                        “{step.comment}”
                      </p>
                    )}

                    {/* Decision controls for the step currently pending */}
                    {actionable && (
                      <div className="mt-2.5 ml-7 space-y-2">
                        <Textarea
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          placeholder="Comment (required for reject / request changes)"
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" disabled={!!deciding} onClick={() => handleDecide(step, "approved")}>
                            {deciding === "approved" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50" disabled={!!deciding} onClick={() => handleDecide(step, "changes_requested")}>
                            {deciding === "changes_requested" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MessageSquareWarning className="h-3 w-3 mr-1" />}Request Changes
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={!!deciding} onClick={() => handleDecide(step, "rejected")}>
                            {deciding === "rejected" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              </ol>
            </>
          )}

          {/* Approval history from earlier rounds */}
          {priorRounds.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-700"
              >
                <History className="h-3 w-3" />
                {showHistory ? "Hide" : "Show"} approval history ({priorRounds.length} earlier {priorRounds.length === 1 ? "step" : "steps"})
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1.5">
                  {priorRounds.map(step => {
                    const meta = STEP_STATUS[step.status];
                    return (
                      <li key={step.id} className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 rounded-md border bg-gray-50/60 px-2.5 py-1.5">
                        <span className="font-medium text-gray-400">Round {step.round}</span>
                        <span className="font-semibold text-gray-600">{step.approver_name}</span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", meta.cls)}>
                          {meta.icon}{meta.label}
                        </span>
                        {step.decided_at && <span className="text-gray-400">{new Date(step.decided_at).toLocaleString()}</span>}
                        {step.comment && <span className="italic">“{step.comment}”</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
