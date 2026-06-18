"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Plus, X, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, type CalEvent,
} from "@/lib/api";

type ViewMode = "Day" | "Week" | "Month" | "Year";

const EVENT_COLORS = [
  "bg-primary/20 border-primary text-primary",
  "bg-teal-100 border-teal-400 text-teal-700",
  "bg-amber-100 border-amber-400 text-amber-700",
  "bg-emerald-100 border-emerald-400 text-emerald-700",
  "bg-pink-100 border-pink-400 text-pink-700",
];

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_FULL    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOURS          = Array.from({ length: 16 }, (_, i) => i + 7);

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(d.getDate() - d.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({ anchor, events, onAddSlot, onEdit, onDelete, deletingId }: {
  anchor: Date;
  events: CalEvent[];
  onAddSlot: (date: string, hour: number) => void;
  onEdit: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const todayStr = toDateStr(new Date());
  const nowHour  = new Date().getHours();
  const nowMin   = new Date().getMinutes();
  const currentTimeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentTimeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-100 bg-white shrink-0">
        <div className="border-r border-gray-100" />
        {days.map((d) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          return (
            <div key={ds} className={cn("text-center py-3 border-r border-gray-100 last:border-r-0", isToday && "bg-yellow-50")}>
              <p className={cn("text-xs font-medium", isToday ? "text-yellow-700" : "text-gray-400")}>
                {WEEKDAYS_SHORT[d.getDay()]}, {MONTHS_FULL[d.getMonth()].slice(0,3)} {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
          {HOURS.map((hour) => {
            const isCurrentHour = toDateStr(new Date()) === todayStr && nowHour === hour;
            return (
              <div key={hour} className="contents">
                <div className="border-r border-b border-gray-100 h-14 flex items-start justify-end pr-2 pt-1">
                  <span className="text-[11px] text-gray-400">{String(hour).padStart(2,"0")}:00</span>
                </div>
                {days.map((d) => {
                  const ds = toDateStr(d);
                  const isToday = ds === todayStr;
                  const cellEvents = events.filter((e) => e.date === ds && e.start_hour === hour);
                  return (
                    <div
                      key={ds + hour}
                      onClick={() => onAddSlot(ds, hour)}
                      className={cn(
                        "relative border-r border-b border-gray-100 h-14 last:border-r-0 cursor-pointer group transition-colors",
                        isToday ? "bg-yellow-50/60 hover:bg-yellow-100/60" : "hover:bg-gray-50"
                      )}
                    >
                      {isToday && isCurrentHour && (
                        <div
                          ref={currentTimeRef}
                          className="absolute left-0 right-0 z-10 pointer-events-none"
                          style={{ top: `${(nowMin / 60) * 100}%` }}
                        >
                          <div className="h-px bg-red-400 w-full relative">
                            <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-400" />
                          </div>
                        </div>
                      )}
                      {cellEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                          className={cn("absolute inset-x-0.5 top-0.5 rounded border-l-2 px-1.5 py-0.5 flex items-center justify-between group/ev cursor-pointer", ev.color)}
                          style={{ minHeight: "calc(100% - 4px)" }}
                        >
                          <span className="text-[11px] font-medium truncate">{ev.title}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/ev:opacity-100 ml-1 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                              className="hover:bg-black/10 rounded p-0.5"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                              disabled={deletingId === ev.id}
                              className="hover:bg-black/10 rounded p-0.5 disabled:opacity-50"
                            >
                              {deletingId === ev.id
                                ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                : <X className="h-2.5 w-2.5" />
                              }
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <Plus className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({ anchor, events, onAddSlot, onEdit, onDelete, deletingId }: {
  anchor: Date;
  events: CalEvent[];
  onAddSlot: (date: string, hour: number) => void;
  onEdit: (ev: CalEvent) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const year     = anchor.getFullYear();
  const month    = anchor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInM  = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(new Date());
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInM }, (_, i) => i + 1)];

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="text-center py-2 text-xs font-semibold text-gray-400 border-r border-gray-100 last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="border-r border-b border-gray-100 min-h-[100px] last:border-r-0 bg-gray-50/30" />;
          const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isToday  = ds === todayStr;
          const dayEvents = events.filter((e) => e.date === ds);
          return (
            <div
              key={ds}
              onClick={() => onAddSlot(ds, 9)}
              className={cn(
                "border-r border-b border-gray-100 last:border-r-0 min-h-[100px] p-2 cursor-pointer group transition-colors",
                isToday ? "bg-yellow-50" : "hover:bg-gray-50"
              )}
            >
              <span className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium",
                isToday ? "bg-primary text-white" : "text-gray-700 group-hover:bg-gray-100"
              )}>{day}</span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div key={ev.id} className={cn("flex items-center justify-between rounded px-1.5 py-0.5 text-[11px] font-medium border-l-2 group/ev cursor-pointer", ev.color)}
                    onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                  >
                    <span className="truncate">{ev.title}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/ev:opacity-100 ml-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(ev); }} className="hover:bg-black/10 rounded p-0.5">
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }}
                        disabled={deletingId === ev.id}
                        className="hover:bg-black/10 rounded p-0.5 disabled:opacity-50"
                      >
                        {deletingId === ev.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  </div>
                ))}
                {dayEvents.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add event modal ──────────────────────────────────────────────────────────

function AddEventModal({ date, hour, saving, onSave, onClose }: {
  date: string; hour: number; saving: boolean;
  onSave: (ev: { title: string; date: string; start_hour: number; end_hour: number; color: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle]    = useState("");
  const [start, setStart]    = useState(hour);
  const [end, setEnd]        = useState(Math.min(hour + 1, 22));
  const [colorIdx, setColor] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Add Event</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-gray-500">{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</p>
        <input
          autoFocus
          type="text"
          placeholder="Event title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              onSave({ title, date, start_hour: start, end_hour: end, color: EVENT_COLORS[colorIdx] });
            }
          }}
          disabled={saving}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start time</label>
            <select value={start} onChange={(e) => setStart(+e.target.value)} disabled={saving} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none">
              {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End time</label>
            <select value={end} onChange={(e) => setEnd(+e.target.value)} disabled={saving} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none">
              {HOURS.filter((h) => h > start).map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Color</label>
          <div className="flex gap-2">
            {EVENT_COLORS.map((c, i) => (
              <button key={i} onClick={() => setColor(i)} disabled={saving}
                className={cn("h-6 w-6 rounded-full border-2 transition-transform disabled:opacity-50", c.split(" ")[0].replace("/20",""), colorIdx === i ? "border-gray-700 scale-110" : "border-transparent")}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim() || saving}
            onClick={() => onSave({ title, date, start_hour: start, end_hour: end, color: EVENT_COLORS[colorIdx] })}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit event modal ─────────────────────────────────────────────────────────

function EditEventModal({ event, saving, onSave, onClose }: {
  event: CalEvent;
  saving: boolean;
  onSave: (id: string, data: { title: string; start_hour: number; end_hour: number; color: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle]    = useState(event.title);
  const [start, setStart]    = useState(event.start_hour);
  const [end, setEnd]        = useState(event.end_hour);
  const [colorIdx, setColor] = useState(Math.max(0, EVENT_COLORS.indexOf(event.color)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Edit Event</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-gray-500">{new Date(event.date + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</p>
        <input
          autoFocus
          type="text"
          placeholder="Event title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start time</label>
            <select value={start} onChange={(e) => setStart(+e.target.value)} disabled={saving} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none">
              {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End time</label>
            <select value={end} onChange={(e) => setEnd(+e.target.value)} disabled={saving} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none">
              {HOURS.filter((h) => h > start).map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Color</label>
          <div className="flex gap-2">
            {EVENT_COLORS.map((c, i) => (
              <button key={i} onClick={() => setColor(i)} disabled={saving}
                className={cn("h-6 w-6 rounded-full border-2 transition-transform disabled:opacity-50", c.split(" ")[0].replace("/20",""), colorIdx === i ? "border-gray-700 scale-110" : "border-transparent")}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim() || saving}
            onClick={() => onSave(event.id, { title, start_hour: start, end_hour: end, color: EVENT_COLORS[colorIdx] })}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar page ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [view, setView]         = useState<ViewMode>("Week");
  const [anchor, setAnchor]     = useState(new Date());
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [modal, setModal]           = useState<{ date: string; hour: number } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [savingEvent, setSavingEvent]   = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const token = await getToken();
      const { events } = await listCalendarEvents(token);
      setEvents(events);
    } catch {
      toast.error("Failed to load calendar events");
    }
  }

  async function addEvent(ev: { title: string; date: string; start_hour: number; end_hour: number; color: string }) {
    setSavingEvent(true);
    try {
      const token = await getToken();
      const { event } = await createCalendarEvent(token, ev);
      setEvents(prev => [...prev, event]);
      setModal(null);
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSavingEvent(false);
    }
  }

  async function editEvent(id: string, data: { title: string; start_hour: number; end_hour: number; color: string }) {
    setSavingEvent(true);
    try {
      const token = await getToken();
      const { event } = await updateCalendarEvent(token, id, data);
      setEvents(prev => prev.map(e => e.id === id ? event : e));
      setEditingEvent(null);
    } catch {
      toast.error("Failed to update event");
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(id: string) {
    setDeletingId(id);
    try {
      const token = await getToken();
      await deleteCalendarEvent(token, id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(anchor);
    if (view === "Week")  d.setDate(d.getDate() + dir * 7);
    if (view === "Month") d.setMonth(d.getMonth() + dir);
    if (view === "Day")   d.setDate(d.getDate() + dir);
    if (view === "Year")  d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  }

  function getDateRange(): string {
    if (view === "Month") return `${MONTHS_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (view === "Year")  return `${anchor.getFullYear()}`;
    if (view === "Day")   return anchor.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
    const ws = startOfWeek(anchor);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    if (ws.getMonth() === we.getMonth()) {
      return `${ws.getDate()} – ${we.getDate()} ${MONTHS_FULL[ws.getMonth()]} ${ws.getFullYear()}`;
    }
    return `${ws.getDate()} ${MONTHS_FULL[ws.getMonth()]} – ${we.getDate()} ${MONTHS_FULL[we.getMonth()]} ${ws.getFullYear()}`;
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 shrink-0 flex-wrap gap-y-2">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["Day","Week","Month","Year"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium border-r border-gray-200 last:border-r-0 transition-colors",
                view === v ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm font-semibold text-gray-900">{getDateRange()}</span>

        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())} className="ml-auto gap-1.5 text-xs">
          <RefreshCw className="h-3 w-3" />
          Today
        </Button>

        <Button size="sm" onClick={() => setModal({ date: toDateStr(anchor), hour: new Date().getHours() })} className="gap-1.5 text-xs">
          <Plus className="h-3 w-3" />
          Add Event
        </Button>
      </div>

      {/* Sidebar + grid */}
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col w-48 shrink-0 border-r border-gray-100 p-4 gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Calendars</p>
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative h-4 w-4 shrink-0">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="h-4 w-4 rounded border-2 border-primary bg-primary peer-checked:bg-primary flex items-center justify-center">
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-700 truncate">{fullName}</span>
          </label>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {view === "Week" && (
            <WeekView
              anchor={anchor}
              events={events}
              onAddSlot={(date, hour) => setModal({ date, hour })}
              onEdit={ev => setEditingEvent(ev)}
              onDelete={deleteEvent}
              deletingId={deletingId}
            />
          )}
          {view === "Month" && (
            <MonthView
              anchor={anchor}
              events={events}
              onAddSlot={(date, hour) => setModal({ date, hour })}
              onEdit={ev => setEditingEvent(ev)}
              onDelete={deleteEvent}
              deletingId={deletingId}
            />
          )}
          {(view === "Day" || view === "Year") && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p>{view} view — switch to Week or Month</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit event modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          saving={savingEvent}
          onSave={editEvent}
          onClose={() => { if (!savingEvent) setEditingEvent(null); }}
        />
      )}

      {/* Add event modal */}
      {modal && (
        <AddEventModal
          date={modal.date}
          hour={modal.hour}
          saving={savingEvent}
          onSave={addEvent}
          onClose={() => { if (!savingEvent) setModal(null); }}
        />
      )}
    </div>
  );
}
