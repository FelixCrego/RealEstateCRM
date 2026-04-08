"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDemoCalendarEvents } from "@/lib/investor-demo-content";
import type { Lead, RealtorPortal } from "@/lib/types";

type PipelineStage = "New" | "Pitched" | "Awaiting Approval" | "Payment Pending" | "Closed Won" | "No Show";
type CalendarEventType = "Seller Appointment" | "Investor Call" | "Realtor Walkthrough";

type DemoApiRecord = {
  id?: string;
  lead_id?: string | null;
  lead_name?: string;
  selected_date?: string;
  selected_time?: string;
  meet_link?: string;
};

type LeadApiResponse = {
  leads?: Lead[];
  error?: string;
};

type DemoApiResponse = {
  demos?: DemoApiRecord[];
  error?: string;
};

type CalendarEvent = {
  id: string;
  leadId?: string | null;
  leadName: string;
  scheduledDate: string;
  scheduledTime: string;
  eventType: CalendarEventType;
  meetingUrl?: string | null;
  propertyAddress?: string | null;
  sourceLabel: string;
  isDemo?: boolean;
};

type PersistedBookedDemo = {
  date?: string;
  time?: string;
  meetLink?: string;
};

const CALENDAR_CACHE_KEY = "felix:pending-upcoming-demos";
const PIPELINE_STATUS_CACHE_KEY = "felix:demo-pipeline-stage-overrides";
const LEAD_ID_FOR_NAME_PREFIX = "lead-for-name:";
const pipelineStageOptions: PipelineStage[] = ["New", "Pitched", "Awaiting Approval", "Payment Pending", "Closed Won", "No Show"];

function isPipelineStage(value: string): value is PipelineStage {
  return pipelineStageOptions.includes(value as PipelineStage);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(input: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function parseDateTime(date: string, time: string) {
  const normalized = time.trim().match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i);
  const nextDate = new Date(`${date}T00:00:00`);

  if (!normalized) return nextDate;

  const rawHour = Number(normalized[1]);
  const minutes = Number(normalized[2]);
  const period = normalized[3].toUpperCase();
  const hours24 = rawHour % 12 + (period === "PM" ? 12 : 0);
  nextDate.setHours(hours24, minutes, 0, 0);
  return nextDate;
}

function formatDateTimeLabel(date: string, time: string) {
  const scheduledAt = parseDateTime(date, time);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const isToday = scheduledAt.toDateString() === now.toDateString();
  const isTomorrow = scheduledAt.toDateString() === tomorrow.toDateString();
  const dayLabel = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : scheduledAt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return {
    scheduledAt,
    dateTimeLabel: `${dayLabel} at ${time}`,
    isToday,
  };
}

function normalizeMeetingUrl(value?: string | null) {
  if (!value) return null;
  return value.startsWith("http") ? value : `https://${value}`;
}

function buildEventKey(event: CalendarEvent) {
  return `${event.leadId || event.leadName}::${event.eventType}::${event.scheduledDate}::${event.scheduledTime}`;
}

function normalizeDemoRecord(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const scheduledDate = typeof raw.selected_date === "string" ? raw.selected_date.trim() : "";
  const scheduledTime = typeof raw.selected_time === "string" ? raw.selected_time.trim() : "";
  const meetingUrl = typeof raw.meet_link === "string" ? raw.meet_link.trim() : "";
  const leadName = typeof raw.lead_name === "string" && raw.lead_name.trim() ? raw.lead_name.trim() : "Unknown Lead";
  const leadId = typeof raw.lead_id === "string" && raw.lead_id.trim() ? raw.lead_id.trim() : null;

  if (!scheduledDate || !scheduledTime || !meetingUrl || !isValidDateString(scheduledDate) || scheduledDate < getTodayKey()) return null;

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `calendar-${leadId || leadName}-${scheduledDate}-${scheduledTime}`,
    leadId,
    leadName,
    scheduledDate,
    scheduledTime,
    eventType: "Investor Call",
    meetingUrl: normalizeMeetingUrl(meetingUrl),
    propertyAddress: null,
    sourceLabel: "Calendar API",
  };
}

function resolveBookedAppointmentFromLead(lead: Lead): CalendarEvent | null {
  if (String(lead.status ?? "").toUpperCase() === "CLOSED") return null;

  const sourcePayload = (lead as Lead & { sourcePayload?: Record<string, unknown>; source_payload?: Record<string, unknown> }) as Lead & {
    sourcePayload?: Record<string, unknown>;
    source_payload?: Record<string, unknown>;
  };
  const rawPayload = (sourcePayload.sourcePayload ?? sourcePayload.source_payload ?? {}) as Record<string, unknown>;
  const demoBooking = (rawPayload.demoBooking ?? rawPayload.demo_booking ?? lead.demoBooking ?? null) as PersistedBookedDemo | null;

  if (!demoBooking) return null;

  const scheduledDate = typeof demoBooking.date === "string" ? demoBooking.date.trim() : "";
  const scheduledTime = typeof demoBooking.time === "string" ? demoBooking.time.trim() : "";
  const meetingUrl = normalizeMeetingUrl(typeof demoBooking.meetLink === "string" ? demoBooking.meetLink.trim() : "");

  if (!scheduledDate || !scheduledTime || !meetingUrl || !isValidDateString(scheduledDate) || scheduledDate < getTodayKey()) return null;

  return {
    id: `lead-booking-${lead.id}-${scheduledDate}-${scheduledTime}`,
    leadId: lead.id,
    leadName: lead.businessName,
    scheduledDate,
    scheduledTime,
    eventType: "Seller Appointment",
    meetingUrl,
    propertyAddress: lead.investorProfile?.propertyAddress ?? lead.realtorPortal?.propertyAddress ?? null,
    sourceLabel: "Lead workspace",
  };
}

function resolveWalkthroughFromLead(lead: Lead): CalendarEvent | null {
  if (String(lead.status ?? "").toUpperCase() === "CLOSED") return null;

  const portal = lead.realtorPortal as RealtorPortal | null | undefined;
  const scheduledAtRaw = portal?.walkthrough?.scheduledAt ?? null;
  if (!scheduledAtRaw) return null;

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) return null;

  const scheduledDate = scheduledAt.toISOString().slice(0, 10);
  if (scheduledDate < getTodayKey()) return null;

  const scheduledTime = scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    id: `walkthrough-${lead.id}-${scheduledAt.toISOString()}`,
    leadId: lead.id,
    leadName: lead.businessName,
    scheduledDate,
    scheduledTime,
    eventType: "Realtor Walkthrough",
    meetingUrl: null,
    propertyAddress: portal?.propertyAddress ?? lead.investorProfile?.propertyAddress ?? null,
    sourceLabel: portal?.brokerage ? `${portal.brokerage} walkthrough` : "Realtor portal",
  };
}

function saveCachedEvents(events: CalendarEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(events));
}

function classifyUrgency(scheduledAt: Date) {
  const now = new Date();
  const diffMs = scheduledAt.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24) return "Today";
  if (diffHours <= 48) return "Next 48 Hours";
  if (diffHours <= 24 * 7) return "This Week";
  return "Later";
}

function eventTone(eventType: CalendarEventType) {
  if (eventType === "Realtor Walkthrough") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (eventType === "Seller Appointment") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export default function DemosPage() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [cachedEvents, setCachedEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pipelineStatusOverrides, setPipelineStatusOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawOverrides = window.localStorage.getItem(PIPELINE_STATUS_CACHE_KEY);
    if (!rawOverrides) return;

    try {
      const parsed = JSON.parse(rawOverrides) as Record<string, unknown>;
      const normalized = Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
      setPipelineStatusOverrides(normalized);
    } catch {
      window.localStorage.removeItem(PIPELINE_STATUS_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawCached = window.localStorage.getItem(CALENDAR_CACHE_KEY);
    if (!rawCached) {
      setCachedEvents([]);
      return;
    }

    try {
      const parsed = JSON.parse(rawCached) as unknown[];
      const normalized = Array.isArray(parsed)
        ? parsed.map(normalizeDemoRecord).filter((event): event is CalendarEvent => Boolean(event))
        : [];
      setCachedEvents(normalized);
      saveCachedEvents(normalized);
    } catch {
      setCachedEvents([]);
      window.localStorage.removeItem(CALENDAR_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const scheduledDate = params.get("date")?.trim() || "";
    const scheduledTime = params.get("time")?.trim() || "";
    const meetingUrl = normalizeMeetingUrl(params.get("meetLink")?.trim() || "");

    if (!scheduledDate || !scheduledTime || !meetingUrl || !isValidDateString(scheduledDate) || scheduledDate < getTodayKey()) return;

    const nextPending: CalendarEvent = {
      id: `pending-${params.get("leadId") || "calendar"}-${scheduledDate}-${scheduledTime}`,
      leadId: params.get("leadId") || null,
      leadName: params.get("leadName")?.trim() || "Unknown Lead",
      scheduledDate,
      scheduledTime,
      eventType: "Seller Appointment",
      meetingUrl,
      propertyAddress: null,
      sourceLabel: "Fresh booking",
    };

    setCachedEvents((previous) => {
      const deduped = new Map(previous.map((event) => [buildEventKey(event), event]));
      deduped.set(buildEventKey(nextPending), nextPending);
      const nextCached = [...deduped.values()];
      saveCachedEvents(nextCached);
      return nextCached;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCalendar() {
      setLoading(true);
      setError("");

      const [demosResult, leadsResult] = await Promise.allSettled([
        fetch("/api/demos", { cache: "no-store" }),
        fetch("/api/leads", { cache: "no-store" }),
      ]);

      let nextEvents: CalendarEvent[] = [];
      let nextError = "";

      if (demosResult.status === "fulfilled") {
        const demosPayload = (await demosResult.value.json().catch(() => null)) as DemoApiResponse | null;
        if (demosResult.value.ok) {
          nextEvents = nextEvents.concat((demosPayload?.demos ?? []).map(normalizeDemoRecord).filter((event): event is CalendarEvent => Boolean(event)));
        } else if (demosPayload?.error) {
          nextError = demosPayload.error;
        }
      }

      if (leadsResult.status === "fulfilled") {
        const leadsPayload = (await leadsResult.value.json().catch(() => null)) as LeadApiResponse | null;
        if (leadsResult.value.ok && Array.isArray(leadsPayload?.leads)) {
          const liveLeadEvents = leadsPayload.leads.flatMap((lead) => {
            const items = [resolveBookedAppointmentFromLead(lead), resolveWalkthroughFromLead(lead)];
            return items.filter((event): event is CalendarEvent => Boolean(event));
          });
          nextEvents = nextEvents.concat(liveLeadEvents);
        } else if (!nextError) {
          nextError = leadsPayload?.error || "Failed to load calendar events.";
        }
      } else if (!nextError) {
        nextError = "Failed to load calendar events.";
      }

      if (!isMounted) return;

      setCalendarEvents(nextEvents);
      setError(nextError);
      setLoading(false);
    }

    void loadCalendar();
    return () => {
      isMounted = false;
    };
  }, []);

  const eventsWithMeta = useMemo(() => {
    const deduped = new Map<string, CalendarEvent>();

    for (const event of [...cachedEvents, ...calendarEvents]) {
      if (event.scheduledDate < getTodayKey()) continue;
      deduped.set(buildEventKey(event), event);
    }

    return [...deduped.values()]
      .map((event) => {
        const { scheduledAt, dateTimeLabel, isToday } = formatDateTimeLabel(event.scheduledDate, event.scheduledTime);
        return {
          ...event,
          scheduledAt,
          dateTimeLabel,
          isToday,
          urgency: classifyUrgency(scheduledAt),
        };
      })
      .sort((firstEvent, secondEvent) => firstEvent.scheduledAt.getTime() - secondEvent.scheduledAt.getTime());
  }, [cachedEvents, calendarEvents]);
  const displayEvents = useMemo(
    () => (eventsWithMeta.length ? eventsWithMeta : buildDemoCalendarEvents().map((event) => ({ ...event, ...formatDateTimeLabel(event.scheduledDate, event.scheduledTime), urgency: classifyUrgency(parseDateTime(event.scheduledDate, event.scheduledTime)), scheduledAt: parseDateTime(event.scheduledDate, event.scheduledTime) }))),
    [eventsWithMeta],
  );
  const showingDemoContent = eventsWithMeta.length === 0;

  const stats = useMemo(() => {
    const today = displayEvents.filter((event) => event.urgency === "Today").length;
    const next48 = displayEvents.filter((event) => event.urgency === "Next 48 Hours").length;
    const thisWeek = displayEvents.filter((event) => event.urgency === "This Week").length;
    const walkthroughs = displayEvents.filter((event) => event.eventType === "Realtor Walkthrough").length;
    return { today, next48, thisWeek, walkthroughs };
  }, [displayEvents]);

  const getSelectedPipelineStage = (event: CalendarEvent) => {
    const normalizedName = event.leadName.trim().toLowerCase();
    const byLeadId = event.leadId ? pipelineStatusOverrides[event.leadId] : undefined;
    const byName = pipelineStatusOverrides[`name:${normalizedName}`];
    if (byLeadId && isPipelineStage(byLeadId)) return byLeadId;
    if (byName && isPipelineStage(byName)) return byName;
    return "New";
  };

  const setLeadPipelineStatus = (leadId: string | null | undefined, leadName: string, stage: PipelineStage) => {
    const normalizedName = leadName.trim().toLowerCase();
    const next = {
      ...pipelineStatusOverrides,
      ...(leadId ? { [leadId]: stage } : {}),
      [`name:${normalizedName}`]: stage,
      ...(leadId ? { [`${LEAD_ID_FOR_NAME_PREFIX}${normalizedName}`]: leadId } : {}),
    };
    setPipelineStatusOverrides(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PIPELINE_STATUS_CACHE_KEY, JSON.stringify(next));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-zinc-100">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Acquisitions Ops</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Acquisitions Calendar</h1>
        <p className="mt-2 text-sm text-zinc-400">Track seller appointments, investor calls, and realtor walkthroughs from one queue.</p>
        {showingDemoContent ? <p className="mt-3 text-xs text-sky-300">Showing built-in demo events because no live appointments or walkthroughs are scheduled yet.</p> : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Today</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.today}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Next 48 Hours</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.next48}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">This Week</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.thisWeek}</p>
        </article>
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Walkthroughs</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats.walkthroughs}</p>
        </article>
      </section>

      {loading ? <p className="text-sm text-zinc-400">Loading acquisitions calendar...</p> : null}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}

      <section className="space-y-3">
        {!loading && displayEvents.length === 0 ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            No upcoming acquisition events found. Book a seller call, sync a walkthrough, or schedule a follow-up from a lead workspace.
          </article>
        ) : null}

        {displayEvents.map((event) => {
          const leadHref = event.leadId ? `/leads/${event.leadId}` : null;
          return (
            <article
              key={event.id}
              className={`rounded-2xl border bg-zinc-900/60 p-4 shadow-[0_8px_35px_rgba(0,0,0,0.25)] backdrop-blur ${
                event.isToday ? "border-emerald-500/60" : "border-zinc-800"
              }`}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px_320px] lg:items-center">
                <div className="flex items-start gap-4">
                  <div className="min-w-40 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{event.dateTimeLabel}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-zinc-100">{event.leadName}</h2>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${eventTone(event.eventType)}`}>{event.eventType}</span>
                      <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300">{event.urgency}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">{event.propertyAddress || event.sourceLabel}</p>
                    {event.isToday ? (
                      <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                        Happening today
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-zinc-950 p-3 shadow-[0_10px_25px_rgba(79,70,229,0.15)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Pipeline Sync</p>
                  <label className="mt-2 block text-left text-xs text-zinc-300">
                    Next Stage
                    <select
                      value={getSelectedPipelineStage(event)}
                      onChange={(update) => setLeadPipelineStatus(event.leadId, event.leadName, update.target.value as PipelineStage)}
                      className="mt-1.5 w-full rounded-lg border border-indigo-400/40 bg-zinc-950/90 px-3 py-2 text-sm font-medium text-zinc-100 outline-none ring-indigo-400/40 transition focus:ring-2"
                    >
                      {pipelineStageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex w-full flex-col items-end gap-2 self-end lg:w-auto lg:self-auto">
                  {leadHref && !showingDemoContent ? (
                    <Link
                      href={leadHref}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      Open Lead
                    </Link>
                  ) : null}
                  {!leadHref && showingDemoContent ? (
                    <Link
                      href="/offer-desk"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-5 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      Open Offer Desk
                    </Link>
                  ) : null}
                  {event.meetingUrl ? (
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      Join Call
                    </a>
                  ) : null}
                  <p className="text-xs text-zinc-400">
                    {event.meetingUrl ? "Launch the live meeting for this scheduled event." : "Update the lead workspace with notes, stage changes, and follow-up actions."}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
