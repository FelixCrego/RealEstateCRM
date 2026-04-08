"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Copy, ExternalLink, FileBarChart2, Mail, MapPin, Phone, ShieldCheck, Upload } from "lucide-react";
import type { Lead, RealtorPortal } from "@/lib/types";

type RealtorPortalManagerProps = {
  leads: Lead[];
};

type FormState = {
  enabled: boolean;
  realtorName: string;
  realtorEmail: string;
  realtorPhone: string;
  brokerage: string;
  propertyAddress: string;
  portalNote: string;
  walkthroughScheduledAt: string;
  cmaUrl: string;
  cmaFileName: string;
  cmaNote: string;
};

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function buildInitialForm(lead: Lead, portal?: RealtorPortal | null): FormState {
  return {
    enabled: portal?.enabled ?? true,
    realtorName: portal?.realtorName ?? "",
    realtorEmail: portal?.realtorEmail ?? "",
    realtorPhone: portal?.realtorPhone ?? "",
    brokerage: portal?.brokerage ?? "",
    propertyAddress: portal?.propertyAddress ?? lead.investorProfile?.propertyAddress ?? `${lead.businessName}${lead.city ? `, ${lead.city}` : ""}`,
    portalNote: portal?.portalNote ?? "",
    walkthroughScheduledAt: toLocalDateTimeInput(portal?.walkthrough.scheduledAt),
    cmaUrl: portal?.cma.url ?? "",
    cmaFileName: portal?.cma.fileName ?? "",
    cmaNote: portal?.cma.note ?? "",
  };
}

function walkthroughStatusTone(status?: RealtorPortal["walkthrough"]["status"] | null) {
  if (status === "CONFIRMED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "RESCHEDULE_REQUESTED") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function walkthroughStatusLabel(status?: RealtorPortal["walkthrough"]["status"] | null) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "RESCHEDULE_REQUESTED") return "Reschedule Requested";
  return "Pending";
}

function leadAddress(lead: Lead, portal?: RealtorPortal | null) {
  return portal?.propertyAddress ?? lead.investorProfile?.propertyAddress ?? `${lead.businessName}${lead.city ? `, ${lead.city}` : ""}`;
}

export function RealtorPortalManager({ leads }: RealtorPortalManagerProps) {
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id ?? "");
  const [origin, setOrigin] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [portalOverrides, setPortalOverrides] = useState<Record<string, RealtorPortal>>({});
  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedLeadId) ?? null, [leads, selectedLeadId]);
  const selectedPortal = (selectedLead ? portalOverrides[selectedLead.id] : null) ?? selectedLead?.realtorPortal ?? null;
  const [form, setForm] = useState<FormState>(() =>
    selectedLead
      ? buildInitialForm(selectedLead, selectedPortal)
      : {
          enabled: true,
          realtorName: "",
          realtorEmail: "",
          realtorPhone: "",
          brokerage: "",
          propertyAddress: "",
          portalNote: "",
          walkthroughScheduledAt: "",
          cmaUrl: "",
          cmaFileName: "",
          cmaNote: "",
        },
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!selectedLead) return;
    setForm(buildInitialForm(selectedLead, selectedPortal));
    setMessage("");
  }, [selectedLead, selectedPortal]);

  const portalLink = selectedLead && selectedPortal?.token ? `${origin}/realtor-portal/${selectedLead.id}?token=${selectedPortal.token}` : "";
  const portalAddress = selectedLead ? leadAddress(selectedLead, selectedPortal) : "";
  const isDemoPackage = selectedLead?.sourceQuery === "realtor_portal_demo";

  const leadCards = useMemo(
    () =>
      leads.map((lead) => {
        const portal = portalOverrides[lead.id] ?? lead.realtorPortal ?? null;
        return {
          lead,
          portal,
          address: leadAddress(lead, portal),
          cmaReady: Boolean(portal?.cma.url),
        };
      }),
    [leads, portalOverrides],
  );

  const handleSave = async () => {
    if (!selectedLead) return;

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/realtor-portal/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          enabled: form.enabled,
          realtorName: form.realtorName,
          realtorEmail: form.realtorEmail,
          realtorPhone: form.realtorPhone || null,
          brokerage: form.brokerage || null,
          propertyAddress: form.propertyAddress,
          portalNote: form.portalNote || null,
          walkthroughScheduledAt: toIsoOrNull(form.walkthroughScheduledAt),
          cmaUrl: form.cmaUrl || null,
          cmaFileName: form.cmaFileName || null,
          cmaNote: form.cmaNote || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { portal?: RealtorPortal; error?: string } | null;
      if (!response.ok || !payload?.portal) {
        throw new Error(payload?.error || "Unable to save portal.");
      }

      setPortalOverrides((current) => ({ ...current, [selectedLead.id]: payload.portal as RealtorPortal }));
      setMessage("Portal saved and share link updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save portal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!selectedLead) return;

    setIsUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("leadId", selectedLead.id);
      formData.append("target", "cma");

      const response = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to upload CMA.");
      }

      setForm((current) => ({
        ...current,
        cmaUrl: payload.url ?? "",
        cmaFileName: file.name,
      }));
      setMessage("CMA uploaded. Save portal to publish the updated package.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload CMA.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setMessage("Portal link copied.");
  };

  const handleEmailDraft = () => {
    if (!selectedLead || !portalLink || !form.realtorEmail.trim()) return;

    const subject = encodeURIComponent(`Walkthrough package for ${form.propertyAddress || selectedLead.businessName}`);
    const body = encodeURIComponent(
      [
        `Hi ${form.realtorName || "there"},`,
        "",
        "Your walkthrough portal is ready:",
        portalLink,
        "",
        form.cmaUrl ? `CMA package: ${form.cmaUrl}` : "",
        form.walkthroughScheduledAt ? `Walkthrough: ${formatDateTime(toIsoOrNull(form.walkthroughScheduledAt))}` : "",
        "",
        "Use the portal to confirm timing, review the comp package, and send back access or pricing notes.",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    window.location.href = `mailto:${form.realtorEmail}?subject=${subject}&body=${body}`;
  };

  if (!selectedLead) {
    return (
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-8 text-zinc-300">
        No leads available yet. Add a lead first, then create a realtor portal for walkthrough confirmation and CMA delivery.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_32%),linear-gradient(135deg,rgba(9,9,11,0.98),rgba(17,24,39,0.96))] p-6 shadow-2xl shadow-black/30">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Realtor Command Portal</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Walkthrough coordination, CMA delivery, and agent feedback in one shareable workspace.</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Use this portal to hand a property to an agent cleanly: schedule the walkthrough, publish the comp package, and keep confirmation status visible for acquisitions.
            </p>
            {isDemoPackage ? (
              <p className="mt-4 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Demo package loaded and ready to show
              </p>
            ) : null}
          </div>
          <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Portal Status</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{selectedPortal?.enabled ? "Live" : "Draft"}</p>
              <p className="mt-1 text-xs text-zinc-400">{portalLink ? "Secure link generated" : "Save to generate link"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Walkthrough</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{walkthroughStatusLabel(selectedPortal?.walkthrough.status)}</p>
              <p className="mt-1 text-xs text-zinc-400">{formatDateTime(selectedPortal?.walkthrough.scheduledAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">CMA Package</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{selectedPortal?.cma.url ? "Ready" : "Missing"}</p>
              <p className="mt-1 text-xs text-zinc-400">{selectedPortal?.cma.fileName || "Upload or paste a file link"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Last Update</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{formatDateTime(selectedPortal?.updatedAt)}</p>
              <p className="mt-1 text-xs text-zinc-400">{form.realtorName || "Assign an agent to publish"}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Assigned Leads</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-100">Portal lineup</h2>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{leadCards.length} leads</span>
          </div>

          <div className="mt-4 space-y-3">
            {leadCards.map(({ lead, portal, address, cmaReady }) => {
              const selected = lead.id === selectedLeadId;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-sky-500/40 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
                      : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-100">{lead.businessName}</p>
                      <p className="mt-1 text-sm text-zinc-400">{lead.city || "Unknown market"}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${walkthroughStatusTone(portal?.walkthrough.status)}`}>
                      {walkthroughStatusLabel(portal?.walkthrough.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{address}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    <span className="rounded-full border border-zinc-800 px-2.5 py-1">{portal?.enabled ? "Portal live" : "Draft"}</span>
                    <span className="rounded-full border border-zinc-800 px-2.5 py-1">{cmaReady ? "CMA ready" : "CMA missing"}</span>
                    {lead.sourceQuery === "realtor_portal_demo" ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">Demo</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Portal Setup</p>
                  <h2 className="mt-2 text-2xl font-semibold text-zinc-100">{portalAddress}</h2>
                  <p className="mt-2 text-sm text-zinc-400">Configure the agent handoff, schedule window, and the note they see before confirming access.</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  Portal enabled
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Realtor Name</span>
                  <input value={form.realtorName} onChange={(event) => setForm((current) => ({ ...current, realtorName: event.target.value }))} placeholder="Alicia Romero" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Realtor Email</span>
                  <input value={form.realtorEmail} onChange={(event) => setForm((current) => ({ ...current, realtorEmail: event.target.value }))} placeholder="agent@brokerage.com" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Phone</span>
                  <input value={form.realtorPhone} onChange={(event) => setForm((current) => ({ ...current, realtorPhone: event.target.value }))} placeholder="(602) 555-0188" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Brokerage</span>
                  <input value={form.brokerage} onChange={(event) => setForm((current) => ({ ...current, brokerage: event.target.value }))} placeholder="Desert Peak Realty" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 md:col-span-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Property Address</span>
                  <input value={form.propertyAddress} onChange={(event) => setForm((current) => ({ ...current, propertyAddress: event.target.value }))} placeholder="2147 E Cedar Vista Dr, Phoenix, AZ 85032" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Walkthrough Time</span>
                  <input type="datetime-local" value={form.walkthroughScheduledAt} onChange={(event) => setForm((current) => ({ ...current, walkthroughScheduledAt: event.target.value }))} className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 md:col-span-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Portal Brief</span>
                  <textarea value={form.portalNote} onChange={(event) => setForm((current) => ({ ...current, portalNote: event.target.value }))} placeholder="Instructions for the walkthrough, access notes, or pricing expectations." className="mt-3 min-h-28 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Portal Intelligence</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-sky-300" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Secure share link</p>
                      <p className="text-sm text-zinc-400">{portalLink ? "Tokenized access is live." : "Save the portal to generate access."}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-center gap-3">
                    <CalendarClock className="h-5 w-5 text-amber-300" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Walkthrough workflow</p>
                      <p className="text-sm text-zinc-400">{formatDateTime(selectedPortal?.walkthrough.scheduledAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <div className="flex items-center gap-3">
                    <FileBarChart2 className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">CMA delivery</p>
                      <p className="text-sm text-zinc-400">{selectedPortal?.cma.url ? selectedPortal.cma.fileName || "Package attached" : "Awaiting comp package"}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Current agent</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-100">{form.realtorName || "Not assigned"}</p>
                  <p className="mt-1 text-sm text-zinc-400">{form.brokerage || "Brokerage not set"}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-zinc-300"><Mail className="h-4 w-4 text-zinc-500" />{form.realtorEmail || "No email yet"}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-zinc-300"><Phone className="h-4 w-4 text-zinc-500" />{form.realtorPhone || "No phone yet"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Comparable Market Analysis</p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-100">Attach the comp package the agent will review.</h2>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200">
                  <Upload className="h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload CMA"}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Public CMA URL</span>
                  <input value={form.cmaUrl} onChange={(event) => setForm((current) => ({ ...current, cmaUrl: event.target.value }))} placeholder="/demo/realtor-portal-cma.html" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Display File Name</span>
                  <input value={form.cmaFileName} onChange={(event) => setForm((current) => ({ ...current, cmaFileName: event.target.value }))} placeholder="Cedar-Vista-CMA.pdf" className="mt-3 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
                <label className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 md:col-span-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">CMA Summary</span>
                  <textarea value={form.cmaNote} onChange={(event) => setForm((current) => ({ ...current, cmaNote: event.target.value }))} placeholder="Summarize as-is value, repair sensitivity, and list-vs-dispo range for the agent." className="mt-3 min-h-24 w-full bg-transparent text-sm text-zinc-100 outline-none" />
                </label>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Share Console</p>
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                <p className="text-sm font-semibold text-zinc-100">Portal URL</p>
                <p className="mt-2 break-all text-sm text-zinc-400">{portalLink || "Save the portal to generate a secure share link."}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => void handleSave()} disabled={isSaving} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? "Saving..." : "Save portal"}
                </button>
                <button onClick={() => void handleCopyLink()} disabled={!portalLink} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <button onClick={handleEmailDraft} disabled={!portalLink || !form.realtorEmail.trim()} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                  <Mail className="h-4 w-4" />
                  Draft email
                </button>
                {portalLink ? (
                  <a href={portalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200">
                    <ExternalLink className="h-4 w-4" />
                    Open portal
                  </a>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><MapPin className="h-4 w-4 text-zinc-500" />Property</p>
                  <p className="mt-2 text-sm text-zinc-400">{portalAddress}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><Building2 className="h-4 w-4 text-zinc-500" />Brokerage Package</p>
                  <p className="mt-2 text-sm text-zinc-400">{form.brokerage || "Brokerage not assigned"}</p>
                  <p className="mt-1 text-sm text-zinc-500">{form.cmaFileName || "No CMA file name yet"}</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100"><CheckCircle2 className="h-4 w-4 text-zinc-500" />Agent Experience</p>
                  <p className="mt-2 text-sm text-zinc-400">The public portal gives the agent one place to confirm the walkthrough, open the comp package, and send a reschedule request if needed.</p>
                </div>
              </div>

              {message ? <p className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-200">{message}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
