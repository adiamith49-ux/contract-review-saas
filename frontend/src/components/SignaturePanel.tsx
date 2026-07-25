"use client";
import { useCallback, useEffect, useState } from "react";
import {
  PenTool, Send, Loader2, Plus, Trash2, RefreshCw, CheckCircle2,
  Clock, XCircle, Mail, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { cn, formatDateTime } from "@/lib/utils";
import {
  getSignatureRequest, submitForSignature,
  type SignatureRequest,
} from "@/lib/api";

interface Props {
  contractId: string;
  contractStatus: string | null | undefined;
  getToken: () => Promise<string | null>;
  /** Render body content only, no collapsible header/border — used when hosted inside a tab strip. */
  embedded?: boolean;
}

const PARTY_STATUS: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  created:       { label: "Created",   icon: <Clock className="h-3.5 w-3.5" />,        cls: "bg-gray-100 text-gray-500 border-gray-200" },
  sent:          { label: "Sent",      icon: <Mail className="h-3.5 w-3.5" />,          cls: "bg-blue-100 text-blue-700 border-blue-200" },
  delivered:     { label: "Delivered", icon: <Mail className="h-3.5 w-3.5" />,          cls: "bg-blue-100 text-blue-700 border-blue-200" },
  completed:     { label: "Signed",    icon: <CheckCircle2 className="h-3.5 w-3.5" />,  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  signed:        { label: "Signed",    icon: <CheckCircle2 className="h-3.5 w-3.5" />,  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined:      { label: "Declined",  icon: <XCircle className="h-3.5 w-3.5" />,       cls: "bg-red-100 text-red-700 border-red-200" },
  autoresponded: { label: "Auto-responded", icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: "bg-amber-100 text-amber-700 border-amber-200" },
};

const ENVELOPE_STATUS: Record<string, { label: string; cls: string }> = {
  created:   { label: "Created",   cls: "bg-gray-100 text-gray-600 border-gray-200" },
  sent:      { label: "Sent — awaiting signatures", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  delivered: { label: "Opened",    cls: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Fully signed", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined:  { label: "Declined",  cls: "bg-red-100 text-red-700 border-red-200" },
  voided:    { label: "Voided",    cls: "bg-gray-100 text-gray-500 border-gray-200" },
  error:     { label: "Error",     cls: "bg-red-100 text-red-700 border-red-200" },
};

interface PartyRow { name: string; email: string }

export function SignaturePanel({ contractId, contractStatus, getToken, embedded }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = embedded || open;

  const [request, setRequest] = useState<SignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rows, setRows] = useState<PartyRow[]>([{ name: "", email: "" }, { name: "", email: "" }]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const token = await getToken();
      const { request } = await getSignatureRequest(token, contractId);
      setRequest(request);
    } catch { /* panel stays empty */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contractId, getToken]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = contractStatus === "approved";

  function openDialog() {
    setRows([{ name: "", email: "" }, { name: "", email: "" }]);
    setDialogOpen(true);
  }

  function updateRow(i: number, field: keyof PartyRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, { name: "", email: "" }]);
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSend() {
    const parties = rows.map(r => ({ name: r.name.trim(), email: r.email.trim() })).filter(r => r.name && r.email);
    if (parties.length < 2) {
      toast.error("Add at least two signing parties with a name and email");
      return;
    }
    setSending(true);
    try {
      const token = await getToken();
      const { request } = await submitForSignature(token, contractId, parties);
      setRequest(request);
      setDialogOpen(false);
      toast.success("Sent for signature — each party will receive a DocuSign email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send for signature");
    } finally {
      setSending(false);
    }
  }

  const envelopeMeta = request ? (ENVELOPE_STATUS[request.status] ?? { label: request.status, cls: "bg-gray-100 text-gray-600 border-gray-200" }) : null;

  return (
    <div className={embedded ? "" : "shrink-0 border-b bg-white"}>
      {!embedded && (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full px-3 md:px-5 py-2 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          <PenTool className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-700">Signature</span>
          {envelopeMeta && (
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", envelopeMeta.cls)}>
              {envelopeMeta.label}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="px-3 md:px-5 pb-4 space-y-3">
          {loading ? (
            <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
          ) : !request ? (
            <div className="rounded-lg border border-dashed bg-gray-50/60 px-4 py-3 space-y-2.5">
              <p className="text-xs text-gray-500">
                {canSubmit
                  ? "This contract has completed its approval chain and is ready for signature. Add each signing party's name and email — DocuSign will email them a signing link."
                  : "This contract must complete its approval chain before it can be sent for signature."}
              </p>
              <Button size="sm" onClick={openDialog} disabled={!canSubmit}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Submit for Signature
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {envelopeMeta && (
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", envelopeMeta.cls)}>
                    {envelopeMeta.label}
                  </span>
                )}
                <span className="text-[11px] text-gray-400">Sent {formatDateTime(request.created_at)}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => load(true)} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh status
                </Button>
              </div>

              <ol className="space-y-2">
                {request.parties.map((p, i) => {
                  const meta = PARTY_STATUS[p.status] ?? { label: p.status, icon: <Clock className="h-3.5 w-3.5" />, cls: "bg-gray-100 text-gray-500 border-gray-200" };
                  return (
                    <li key={i} className="rounded-lg border bg-white px-3.5 py-2.5 flex items-center gap-2.5 flex-wrap">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 shrink-0">
                        {p.routing_order}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">{p.name}</span>
                      <span className="text-[11px] text-gray-400">{p.email}</span>
                      <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.cls)}>
                        {meta.icon}{meta.label}
                      </span>
                      {p.signed_at && <span className="text-[10px] text-gray-400 w-full">{formatDateTime(p.signed_at)}</span>}
                    </li>
                  );
                })}
              </ol>

              {request.error_message && (
                <p className="text-[11px] text-red-500">{request.error_message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit-for-signature dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && !sending && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-primary" />
              Submit for Signature
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Add each signing party. DocuSign sends every party an email with a link straight into the DocuSign signing UI.
            </p>

            <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
              {rows.map((row, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                    {i + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      placeholder={`Party ${i + 1} name`}
                      value={row.name}
                      onChange={e => updateRow(i, "name", e.target.value)}
                      disabled={sending}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={row.email}
                      onChange={e => updateRow(i, "email", e.target.value)}
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={sending || rows.length <= 2}
                    className="mt-2 shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove party"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addRow} disabled={sending} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Party
            </Button>

            <div className="flex justify-end gap-3 pt-1">
              <DialogClose asChild>
                <Button variant="outline" size="sm" disabled={sending}>Cancel</Button>
              </DialogClose>
              <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? "Sending…" : "Send for Signature"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
