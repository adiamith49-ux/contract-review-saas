"use client";
import { useEffect, useState } from "react";
import { Receipt, Download, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listAdminBilling, downloadAdminBillingReport, type AdminBillingUser } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";

export default function AdminBillingPage() {
  const [users, setUsers]     = useState<AdminBillingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingAll, setDownloadingAll]     = useState(false);
  const [downloadingUser, setDownloadingUser]   = useState<string | null>(null);

  useEffect(() => {
    listAdminBilling()
      .then(res => setUsers(res.users))
      .catch((err: any) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(userId?: string) {
    if (userId) setDownloadingUser(userId); else setDownloadingAll(true);
    try {
      await downloadAdminBillingReport(userId);
      toast.success("Report downloaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (userId) setDownloadingUser(null); else setDownloadingAll(false);
    }
  }

  const totalHours = users.reduce((sum, u) => sum + u.total_hours, 0);
  const totalEntries = users.reduce((sum, u) => sum + u.entries, 0);

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Download billable work as a formatted Excel report — per user or for everyone at once.</p>
        </div>
        <Button size="sm" onClick={() => handleDownload()} disabled={loading || users.length === 0 || downloadingAll} className="gap-1.5">
          {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download All Users
        </Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Users with billable work", value: users.length },
          { label: "Billable entries",         value: totalEntries },
          { label: "Total hours",              value: totalHours.toFixed(1) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-4 text-center">
            {loading ? <Skeleton className="h-8 w-12 mx-auto" /> : <p className="text-2xl font-bold text-gray-900">{s.value}</p>}
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-user table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b last:border-b-0 flex items-center gap-3">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <Receipt className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No billable work logged yet</p>
            <p className="text-xs text-gray-400 mt-1">Once users log billable time entries, they&apos;ll appear here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Entries</th>
                <th className="px-5 py-3">Total Hours</th>
                <th className="px-5 py-3">Last Entry</th>
                <th className="px-5 py-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isDownloading = downloadingUser === u.user_id;
                return (
                  <tr key={u.user_id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{u.user_email}</td>
                    <td className="px-5 py-3.5 text-gray-600">{u.entries}</td>
                    <td className="px-5 py-3.5 text-gray-600">{u.total_hours.toFixed(1)}h</td>
                    <td className="px-5 py-3.5 text-gray-400">
                      {u.last_entry_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(u.last_entry_at)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(u.user_id)}
                        disabled={isDownloading}
                        className="gap-1.5"
                      >
                        {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Download
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
