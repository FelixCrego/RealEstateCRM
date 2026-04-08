"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Mail, Upload } from "lucide-react";
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
    propertyAddress: portal?.propertyAddress ?? `${lead.businessName}${lead.city ? `, ${lead.city}` : ""}`,
    portalNote: portal?.portalNote ?? "",
    walkthroughScheduledAt: toLocalDateTimeInput(portal?.walkthrough.scheduledAt),
    cmaUrl: portal?.cma.url ?? "",
    cmaFileName: portal?.cma.fileName ?? "",
    cmaNote: portal?.cma.note ?? "",
  };
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
  const [form, setForm] = useState<FormState>(() => (selectedLead ? buildInitialForm(selectedLead, selectedPortal) : {
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
  }));

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!selectedLead) return;
    setForm(buildInitialForm(selectedLead, selectedPortal));
    setMessage("");
  }, [selectedLead, selectedPortal]);

  const portalLink = selectedLead && selectedPortal?.token
    ? `${origin}/realtor-portal/${selectedLead.id}?token=${selectedPortal.token}`
    : "";

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

      const payload = await response.json().catch(() => null) as { portal?: RealtorPortal; error?: string } | null;
      if (!response.ok || !payload?.portal) {
        throw new Error(payload?.error || "Unable to save portal.");
      }

      setPortalOverrides((current) => ({ ...current, [selectedLead.id]: payload.portal as RealtorPortal }));
      setMessage("Portal saved.");
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

      const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Unable to upload CMA.");
      }

      setForm((current) => ({
        ...current,
        cmaUrl: payload.url ?? "",
        cmaFileName: file.name,
      }));
      setMessage("CMA uploaded. Save the portal to publish it.");
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

    const subject = encodeURIComponent(`Walkthrough and CMA for ${form.propertyAddress || selectedLead.businessName}`);
    const body = encodeURIComponent(
      [
        `Hi ${form.realtorName || "there"},`,
        "",
        "Here is your portal to confirm the walkthrough and review the CMA:",
        portalLink,
        "",
        form.cmaUrl ? `Direct CMA link: ${form.cmaUrl}` : "",
        form.walkthroughScheduledAt ? `Scheduled walkthrough: ${formatDateTime(toIsoOrNull(form.walkthroughScheduledAt))}` : "",
      ].filter(Boolean).join("\n"),
    );

    window.location.href = `mailto:${form.realtorEmail}?subject=${subject}&body=${body}`;
  };

  if (!selectedLead) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-zinc-300">
        No leads available yet. Add a lead first, then create a realtor portal for walkthrough confirmation and CMA delivery.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Lead</p>
          <select
            value={selectedLeadId}
            onChange={(event) => setSelectedLeadId(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none"
          >
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} {lead.city ? `(${lead.city})` : ""}
              </option>
            ))}
          </select>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-sm font-semibold text-zinc-100">{selectedLead.businessName}</p>
            <p className="mt-1 text-sm text-zinc-400">{selectedLead.city || "Unknown city"}</p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-zinc-500">Walkthrough</p>
                <p className="text-zinc-100">{formatDateTime(selectedPortal?.walkthrough.scheduledAt)}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-sky-300">{selectedPortal?.walkthrough.status ?? "Not configured"}</p>
              </div>
              <div>
                <p className="text-zinc-500">CMA</p>
                <p className="text-zinc-100">{selectedPortal?.cma.url ? (selectedPortal.cma.fileName || "Published") : "Not sent"}</p>
                <p className="text-xs text-zinc-500">
                  {selectedPortal?.cma.viewedAt ? `Viewed ${formatDateTime(selectedPortal.cma.viewedAt)}` : selectedPortal?.cma.sentAt ? `Sent ${formatDateTime(selectedPortal.cma.sentAt)}` : "Waiting for upload"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Realtor Portal</p>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Walkthrough confirmation and CMA delivery</h1>
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
            <input value={form.realtorName} onChange={(event) => setForm((current) => ({ ...current, realtorName: event.target.value }))} placeholder="Realtor name" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <input value={form.realtorEmail} onChange={(event) => setForm((current) => ({ ...current, realtorEmail: event.target.value }))} placeholder="Realtor email" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <input value={form.realtorPhone} onChange={(event) => setForm((current) => ({ ...current, realtorPhone: event.target.value }))} placeholder="Realtor phone" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <input value={form.brokerage} onChange={(event) => setForm((current) => ({ ...current, brokerage: event.target.value }))} placeholder="Brokerage" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <input value={form.propertyAddress} onChange={(event) => setForm((current) => ({ ...current, propertyAddress: event.target.value }))} placeholder="Property address" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2" />
            <input type="datetime-local" value={form.walkthroughScheduledAt} onChange={(event) => setForm((current) => ({ ...current, walkthroughScheduledAt: event.target.value }))} className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
            <textarea value={form.portalNote} onChange={(event) => setForm((current) => ({ ...current, portalNote: event.target.value }))} placeholder="Instructions for the walkthrough or handoff notes" className="min-h-28 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2" />
          </div>

          <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Comparable Market Analysis</p>
                <p className="text-sm text-zinc-500">Paste a public URL or upload a PDF/image into Supabase storage.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200">
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
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input value={form.cmaUrl} onChange={(event) => setForm((current) => ({ ...current, cmaUrl: event.target.value }))} placeholder="Public CMA URL" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
              <input value={form.cmaFileName} onChange={(event) => setForm((current) => ({ ...current, cmaFileName: event.target.value }))} placeholder="Display file name" className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none" />
              <textarea value={form.cmaNote} onChange={(event) => setForm((current) => ({ ...current, cmaNote: event.target.value }))} placeholder="CMA summary or delivery note" className="min-h-24 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none md:col-span-2" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => void handleSave()} disabled={isSaving} className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? "Saving..." : "Save portal"}
            </button>
            <button onClick={() => void handleCopyLink()} disabled={!portalLink} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              <Copy className="h-4 w-4" />
              Copy portal link
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

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">Portal link</p>
            <p className="mt-1 break-all">{portalLink || "Save the portal to generate a secure share link."}</p>
          </div>

          {message ? <p className="mt-4 text-sm text-zinc-300">{message}</p> : null}
        </section>
      </div>
    </div>
  );
}
