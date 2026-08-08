"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, UserCheck, GitCompare, MessagesSquare, PenTool, CalendarClock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IntakePanel } from "@/components/IntakePanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { VersionComparePanel } from "@/components/VersionComparePanel";
import { MatterWorkspace } from "@/components/MatterWorkspace";
import { SignaturePanel } from "@/components/SignaturePanel";
import { ObligationsPanel } from "@/components/ObligationsPanel";

interface Props {
  contractId: string;
  contractStatus: string | null | undefined;
  getToken: () => Promise<string | null>;
  onChanged: () => void;
}

const TITLES: Record<string, { label: string; icon: React.ElementType }> = {
  intake:      { label: "Legal Intake",         icon: ClipboardList },
  approval:    { label: "Approval Workflow",    icon: UserCheck },
  versions:    { label: "Versions & Comparison", icon: GitCompare },
  workspace:   { label: "Matter Workspace",      icon: MessagesSquare },
  signature:   { label: "Signature",            icon: PenTool },
  obligations: { label: "Obligations",          icon: CalendarClock },
};

// Which of the five contract side-panels (if any) is shown is chosen from the
// left sidebar's contract-context nav (see Sidebar.tsx) via the ?panel= query
// param. Rendered as a popup dialog over the document/AI-review view — that
// view stays mounted underneath and is never replaced.
export function ContractDetailTabs({ contractId, contractStatus, getToken, onChanged }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("panel");

  function close() {
    router.push(`/contracts/${contractId}`, { scroll: false });
  }

  if (!active || !TITLES[active]) return null;
  const { label, icon: Icon } = TITLES[active];

  // Comparing two drafts is a read-heavy, full-attention task — two columns of
  // contract text do not fit a 3xl dialog. It gets the whole screen.
  const fullScreen = active === "versions";

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className={fullScreen
        ? "max-w-none w-screen h-screen sm:rounded-none border-0 p-0 gap-0 flex flex-col overflow-hidden"
        : "max-w-3xl w-[calc(100vw-2rem)] h-[75vh] p-0 gap-0 flex flex-col overflow-hidden"}>
        <DialogHeader className="shrink-0 px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </DialogTitle>
        </DialogHeader>

        {/* The comparison view manages its own scrolling: the two text columns
            scroll independently while the controls stay pinned. */}
        <div className={fullScreen ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto"}>
          {active === "intake" && (
            <IntakePanel embedded contractId={contractId} getToken={getToken} onSaved={onChanged} />
          )}
          {active === "approval" && (
            <ApprovalPanel embedded contractId={contractId} contractStatus={contractStatus} getToken={getToken} onChanged={onChanged} />
          )}
          {active === "versions" && (
            <VersionComparePanel embedded fullScreen contractId={contractId} getToken={getToken} />
          )}
          {active === "workspace" && (
            <MatterWorkspace embedded contractId={contractId} getToken={getToken} />
          )}
          {active === "signature" && (
            <SignaturePanel embedded contractId={contractId} contractStatus={contractStatus} getToken={getToken} />
          )}
          {active === "obligations" && (
            <ObligationsPanel embedded contractId={contractId} getToken={getToken} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
