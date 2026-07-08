"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  ChevronDown, ChevronUp, Loader2, MessagesSquare, ListTodo, History, Users,
  Send, Trash2, Lock, Globe, CheckCircle2, Circle, Plus, AtSign,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime } from "@/lib/utils";
import {
  listComments, addComment, deleteComment, getContractTeam,
  listContractTasks, createContractTask, updateTask, getContractActivity,
  type ContractComment, type TeamMember, type ContractTask, type ActivityEntry,
} from "@/lib/api";

interface Props {
  contractId: string;
  getToken: () => Promise<string | null>;
}

type Tab = "comments" | "tasks" | "activity" | "team";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "comments", label: "Comments", icon: MessagesSquare },
  { id: "tasks",    label: "Tasks",    icon: ListTodo },
  { id: "activity", label: "Activity", icon: History },
  { id: "team",     label: "Team",     icon: Users },
];

const ACTION_LABELS: Record<string, string> = {
  "contract.uploaded": "Contract uploaded",
  "contract.analyzed": "AI analysis completed",
  "contract.summarized": "Summary generated",
  "contract.exported": "Exported",
  "contract.redlined": "Redlines generated",
  "contract.updated": "Metadata updated",
  "contract.intake_saved": "Legal intake saved",
  "comment.added": "Comment added",
  "comment.deleted": "Comment deleted",
  "task.created": "Task created",
  "task.completed": "Task completed",
  "approval.submitted": "Submitted for approval",
  "approval.approved": "Approval granted",
  "approval.rejected": "Approval rejected",
  "approval.changes_requested": "Changes requested by approver",
};

// Render @mentions in a highlighted chip style
function CommentBody({ body, mentions }: { body: string; mentions: string[] }) {
  const parts = useMemo(() => {
    if (mentions.length === 0) return [body];
    const escaped = mentions.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`@(${escaped.join("|")})`, "g");
    return body.split(re);
  }, [body, mentions]);
  return (
    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) =>
        mentions.includes(p)
          ? <span key={i} className="inline-flex items-center rounded bg-blue-100 text-blue-700 px-1 py-px font-medium">@{p}</span>
          : <span key={i}>{p}</span>
      )}
    </p>
  );
}

export function MatterWorkspace({ contractId, getToken }: Props) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("comments");

  const [comments, setComments] = useState<ContractComment[]>([]);
  const [tasks, setTasks] = useState<ContractTask[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [c, t, a, tm] = await Promise.all([
        listComments(token, contractId),
        listContractTasks(token, contractId),
        getContractActivity(token, contractId),
        getContractTeam(token, contractId),
      ]);
      setComments(c.comments);
      setTasks(t.tasks);
      setActivity(a.activity);
      setTeam(tm.team);
    } catch {
      toast.error("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [contractId, getToken]);

  useEffect(() => {
    if (open && !loadedRef.current) { loadedRef.current = true; load(); }
  }, [open, load]);

  const authorName = user?.fullName || user?.primaryEmailAddress?.emailAddress || undefined;
  const teamNames = useMemo(() => team.map(t => t.name), [team]);
  const openTasks = tasks.filter(t => !t.done).length;

  return (
    <div className="shrink-0 border-b bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 md:px-5 py-2 flex items-center gap-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <MessagesSquare className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-700">Matter Workspace</span>
        {(comments.length > 0 || openTasks > 0) && (
          <span className="text-[10px] text-gray-400">
            {comments.length > 0 && `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
            {comments.length > 0 && openTasks > 0 && " · "}
            {openTasks > 0 && `${openTasks} open task${openTasks === 1 ? "" : "s"}`}
          </span>
        )}
        <span className="ml-auto text-gray-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-3 md:px-5 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b mb-3">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === "comments" && comments.length > 0 && <span className="text-[10px] text-gray-400">({comments.length})</span>}
                {t.id === "tasks" && openTasks > 0 && <span className="text-[10px] text-gray-400">({openTasks})</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
          ) : (
            <>
              {tab === "comments" && (
                <CommentsTab
                  contractId={contractId} getToken={getToken} comments={comments}
                  teamNames={teamNames} authorName={authorName} onChanged={load}
                />
              )}
              {tab === "tasks" && (
                <TasksTab contractId={contractId} getToken={getToken} tasks={tasks} teamNames={teamNames} onChanged={load} />
              )}
              {tab === "activity" && <ActivityTab activity={activity} />}
              {tab === "team" && <TeamTab team={team} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comments ─────────────────────────────────────────────────────────────────

function CommentsTab({
  contractId, getToken, comments, teamNames, authorName, onChanged,
}: {
  contractId: string;
  getToken: () => Promise<string | null>;
  comments: ContractComment[];
  teamNames: string[];
  authorName?: string;
  onChanged: () => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "shared">("internal");
  const [posting, setPosting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleBodyChange(v: string) {
    setBody(v);
    const m = /@([\w ]*)$/.exec(v);
    if (m && teamNames.length > 0) {
      const q = m[1].toLowerCase();
      setSuggestions(teamNames.filter(n => n.toLowerCase().startsWith(q)).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }

  function insertMention(name: string) {
    setBody(b => b.replace(/@[\w ]*$/, `@${name} `));
    setSuggestions([]);
    textareaRef.current?.focus();
  }

  async function handlePost() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const token = await getToken();
      await addComment(token, contractId, { body: body.trim(), visibility, author_name: authorName });
      setBody("");
      await onChanged();
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = await getToken();
      await deleteComment(token, contractId, id);
      await onChanged();
    } catch {
      toast.error("Failed to delete comment");
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && (
        <p className="text-xs text-gray-400 py-4 text-center">
          No comments yet. Use <span className="font-medium">@name</span> to tag a team member — e.g. “@Sales please confirm commercial position”.
        </p>
      )}
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {comments.map(c => (
          <li key={c.id} className="rounded-lg border bg-gray-50/50 px-3 py-2 group">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary uppercase">
                {c.author_name.slice(0, 2)}
              </span>
              <span className="text-[11px] font-semibold text-gray-700">{c.author_name}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                c.visibility === "internal" ? "bg-gray-200 text-gray-600" : "bg-blue-100 text-blue-700",
              )}>
                {c.visibility === "internal" ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                {c.visibility === "internal" ? "Internal only" : "Counterparty-visible"}
              </span>
              <span className="text-[10px] text-gray-400">{formatDateTime(c.created_at)}</span>
              <button
                onClick={() => handleDelete(c.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                title="Delete comment"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1.5 ml-7">
              <CommentBody body={c.body} mentions={c.mentions} />
            </div>
          </li>
        ))}
      </ul>

      {/* Composer */}
      <div className="relative">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-10 rounded-lg border bg-white shadow-lg py-1 min-w-48">
            {suggestions.map(n => (
              <button
                key={n}
                onClick={() => insertMention(n)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 text-left"
              >
                <AtSign className="h-3 w-3 text-gray-400" />{n}
              </button>
            ))}
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={e => handleBodyChange(e.target.value)}
          placeholder="Add a comment… use @name to tag someone (does not change the document)"
          className="text-xs min-h-[64px]"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setVisibility(v => v === "internal" ? "shared" : "internal")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
              visibility === "internal" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700 border-blue-200",
            )}
            title="Toggle whether this comment could be shared with the counterparty"
          >
            {visibility === "internal" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {visibility === "internal" ? "Internal only" : "Counterparty-visible"}
          </button>
          <Button size="sm" className="h-7 text-xs" onClick={handlePost} disabled={posting || !body.trim()}>
            {posting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}Post
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

function TasksTab({
  contractId, getToken, tasks, teamNames, onChanged,
}: {
  contractId: string;
  getToken: () => Promise<string | null>;
  tasks: ContractTask[];
  teamNames: string[];
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      await createContractTask(token, {
        title: title.trim(),
        contract_id: contractId,
        assignee: assignee.trim() || null,
      });
      setTitle(""); setAssignee("");
      await onChanged();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(task: ContractTask) {
    try {
      const token = await getToken();
      await updateTask(token, task.id, { done: !task.done });
      await onChanged();
    } catch {
      toast.error("Failed to update task");
    }
  }

  return (
    <div className="space-y-3">
      {/* Create */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task, e.g. Confirm commercial position on cap"
          className="h-8 text-xs flex-1 min-w-40"
          onKeyDown={e => e.key === "Enter" && handleCreate()}
        />
        <Input
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          placeholder="Assignee"
          className="h-8 text-xs w-36"
          list="workspace-team-names"
        />
        <datalist id="workspace-team-names">
          {teamNames.map(n => <option key={n} value={n} />)}
        </datalist>
        <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={creating || !title.trim()}>
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">No tasks on this matter yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {tasks.map(t => (
            <li key={t.id} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", t.done && "opacity-50")}>
              <button onClick={() => handleToggle(t)} className="shrink-0" title={t.done ? "Reopen" : "Mark done"}>
                {t.done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <Circle className="h-4 w-4 text-gray-300 hover:text-gray-500" />}
              </button>
              <span className={cn("text-xs text-gray-800 flex-1 min-w-0 truncate", t.done && "line-through")}>{t.title}</span>
              {t.assignee && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-medium shrink-0">
                  {t.assignee}
                </span>
              )}
              {t.due_date && <span className="text-[10px] text-gray-400 shrink-0">{t.due_date}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Activity timeline ────────────────────────────────────────────────────────

function ActivityTab({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) return <p className="text-xs text-gray-400 py-3 text-center">No activity recorded yet.</p>;
  return (
    <ol className="relative ml-2 border-l max-h-80 overflow-y-auto pr-1">
      {activity.map(a => {
        const meta = a.metadata ?? {};
        const detail = [
          meta.approver && `by ${meta.approver}`,
          meta.format && `(${String(meta.format).toUpperCase()})`,
          Array.isArray(meta.mentions) && meta.mentions.length > 0 && `mentioned ${(meta.mentions as string[]).join(", ")}`,
          Array.isArray(meta.approvers) && `chain: ${(meta.approvers as string[]).join(" → ")}`,
          meta.comment && `“${meta.comment}”`,
        ].filter(Boolean).join(" ");
        return (
          <li key={a.id} className="ml-4 pb-3 relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary/30 border-2 border-white" />
            <p className="text-xs text-gray-700 font-medium">{ACTION_LABELS[a.action] ?? a.action}</p>
            {detail && <p className="text-[11px] text-gray-500 mt-0.5">{detail}</p>}
            <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(a.created_at)}</p>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function TeamTab({ team }: { team: TeamMember[] }) {
  if (team.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-3 text-center">
        No people identified yet — set a contract owner, fill the intake, add approvers, or @mention someone in a comment.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {team.map(m => (
        <li key={m.name} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary uppercase shrink-0">
            {m.name.split(/\s+/).map(w => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{m.name}</p>
            {m.email && <p className="text-[10px] text-gray-400 truncate">{m.email}</p>}
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {m.roles.map(r => (
                <span key={r} className="rounded-full bg-gray-100 text-gray-500 px-1.5 py-px text-[9px] font-medium">{r}</span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
