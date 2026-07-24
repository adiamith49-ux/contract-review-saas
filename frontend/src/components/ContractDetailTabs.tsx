"use client";
import { useSearchParams } from "next/navigation";
import { IntakePanel } from "@/components/IntakePanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { VersionComparePanel } from "@/components/VersionComparePanel";
import { MatterWorkspace } from "@/components/MatterWorkspace";

interface Props {
  contractId: string;
  contractStatus: string | null | undefined;
  getToken: () => Promise<string | null>;
  onChanged: () => void;
}

// Which of the four contract side-panels (if any) is shown is chosen from the
// left sidebar's contract-context nav (see Sidebar.tsx) via the ?panel= query
// param — this component just renders the active one's body.
export function ContractDetailTabs({ contractId, contractStatus, getToken, onChanged }: Props) {
  const searchParams = useSearchParams();
  const active = searchParams.get("panel");

  if (!active) return null;

  return (
    <div className="shrink-0 border-b bg-white">
      {active === "intake" && (
        <IntakePanel embedded contractId={contractId} getToken={getToken} onSaved={onChanged} />
      )}
      {active === "approval" && (
        <ApprovalPanel embedded contractId={contractId} contractStatus={contractStatus} getToken={getToken} onChanged={onChanged} />
      )}
      {active === "versions" && (
        <VersionComparePanel embedded contractId={contractId} getToken={getToken} />
      )}
      {active === "workspace" && (
        <MatterWorkspace embedded contractId={contractId} getToken={getToken} />
      )}
    </div>
  );
}
