"use client";

import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/components/role-context";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  Gem,
  Landmark,
  Sparkles,
  Users,
} from "lucide-react";
import {
  acquisitionsQueue,
  aiPlaybooks,
  buildLeadCommandQueue,
  commandCenterAlerts,
  estimateDealSpread,
  formatCurrency,
  investorKpis,
  marketRadar,
  mockLeads,
  simulateCampaignOutcome,
} from "@/lib/mock-investor-crm";

const toneStyles = {
  emerald: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  sky: "text-sky-300 border-sky-400/30 bg-sky-500/10",
  violet: "text-violet-300 border-violet-400/30 bg-violet-500/10",
  amber: "text-amber-300 border-amber-400/30 bg-amber-500/10",
};

function InvestorCommandCenter() {
  const router = useRouter();
  const [claimedLeadCounts, setClaimedLeadCounts] = useState<Array<{ userId: string; userName: string; claimedLeads: number }>>([]);

  useEffect(() => {
    let isActive = true;
    async function loadClaimedLeadCounts() {
      try {
        const response = await fetch("/api/leads/claimed-counts", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as { counts?: Array<{ userId?: string; userName?: string; claimedLeads?: number }> } | null;
        if (!isActive || !Array.isArray(payload?.counts)) return;

        setClaimedLeadCounts(
          payload.counts
            .filter((row) => typeof row?.userId === "string" && typeof row?.userName === "string")
            .map((row) => ({
              userId: row.userId as string,
              userName: row.userName as string,
              claimedLeads: typeof row.claimedLeads === "number" ? row.claimedLeads : 0,
            }))
            .sort((a, b) => b.claimedLeads - a.claimedLeads || a.userName.localeCompare(b.userName)),
        );
      } catch {
        // dashboard remains functional in mock/demo mode
      }
    }

    void loadClaimedLeadCounts();
    return () => {
      isActive = false;
    };
  }, []);

  const projectedProfit = useMemo(() => acquisitionsQueue.reduce((sum, deal) => sum + estimateDealSpread(deal), 0), []);
  const leadCommandQueue = useMemo(() => buildLeadCommandQueue(mockLeads), []);
  const simulatedCampaign = useMemo(() => simulateCampaignOutcome(mockLeads), []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Investor OS • Command Center</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Hyper-Advanced AI Real Estate CRM</h1>
            <p className="mt-1 text-sm text-zinc-400">Mocked live operations: acquisitions, lead triage, next-best-actions, and campaign simulations.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" /> 100x investor mode active
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {investorKpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{kpi.label}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{kpi.value}</h2>
            <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneStyles[kpi.tone]}`}>{kpi.trend}</span>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Acquisitions Deal Intelligence</h3>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><BrainCircuit className="h-3.5 w-3.5" /> Live underwriting model</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Strategy</th>
                  <th className="px-3 py-2">Motivation</th>
                  <th className="px-3 py-2">Win %</th>
                  <th className="px-3 py-2">Projected Spread</th>
                </tr>
              </thead>
              <tbody>
                {acquisitionsQueue.map((deal) => (
                  <tr key={deal.id} className="border-t border-zinc-800 bg-zinc-900/80 text-zinc-200">
                    <td className="px-3 py-2">
                      <button onClick={() => router.push(`/leads/${deal.id}`)} className="text-left transition hover:text-sky-300">
                        <div className="font-medium">{deal.asset}</div>
                        <div className="text-xs text-zinc-400">{deal.market} • {deal.stage}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2">{deal.strategy}</td>
                    <td className="px-3 py-2 text-amber-300">{deal.sellerMotivation}</td>
                    <td className="px-3 py-2 text-emerald-300">{deal.aiWinProbability}%</td>
                    <td className="px-3 py-2 text-sky-300">{formatCurrency(estimateDealSpread(deal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Projected portfolio profit from highlighted opportunities: <span className="font-semibold text-emerald-300">{formatCurrency(projectedProfit)}</span></p>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Command Alerts</h3>
          <div className="space-y-2">
            {commandCenterAlerts.map((alert) => (
              <div key={alert} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">{alert}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Mock Lead Command Queue</h3>
            <span className="text-xs text-zinc-400">Actionable lead intelligence</span>
          </div>
          <div className="space-y-2">
            {leadCommandQueue.slice(0, 5).map((item, index) => (
              <div key={item.lead.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100">#{index + 1} {item.lead.ownerName} • {item.lead.propertyAddress}</p>
                  <span className="text-xs text-sky-300">Conv: {item.conversion}% • Heat: {item.heat}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Signals: {item.lead.motivationSignals.join(", ")} • Timeline: {item.lead.timelineDays}d • Preferred: {item.lead.channelPreference}</p>
                <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200">
                  <span className="font-semibold">{item.nextAction.urgency}</span> — {item.nextAction.action}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Campaign Simulator (Mock)</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase tracking-[0.13em] text-zinc-400">Expected Appointments</p>
              <p className="mt-1 text-3xl font-semibold text-white">{simulatedCampaign.expectedAppointments}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase tracking-[0.13em] text-zinc-400">Expected Contracts</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-300">{simulatedCampaign.expectedContracts}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase tracking-[0.13em] text-zinc-400">Projected Revenue</p>
              <p className="mt-1 text-3xl font-semibold text-sky-300">{formatCurrency(simulatedCampaign.projectedRevenue)}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">AI Automation Playbooks</h3>
          <div className="space-y-3">
            {aiPlaybooks.map((playbook) => (
              <div key={playbook.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-zinc-100">{playbook.title}</p>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">{playbook.impact}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{playbook.channelMix}</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                  {playbook.steps.map((step) => (
                    <li key={step} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />{step}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Market Radar</h3>
          <div className="space-y-3">
            {marketRadar.map((metro) => (
              <div key={metro.metro} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-zinc-100">{metro.metro}</p>
                  <span className="text-sm text-sky-300">{metro.spread}</span>
                </div>
                <p className="text-xs text-zinc-400">{metro.signal}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${metro.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-300">Top Claiming Reps</h3>
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 text-zinc-400">
              <tr>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Claimed Leads</th>
              </tr>
            </thead>
            <tbody>
              {claimedLeadCounts.length === 0 ? (
                <tr className="border-t border-zinc-800 bg-zinc-900/80 text-zinc-400">
                  <td className="px-4 py-3" colSpan={3}>No claimed leads yet.</td>
                </tr>
              ) : (
                claimedLeadCounts.map((rep, idx) => (
                  <tr key={rep.userId} className="border-t border-zinc-800 bg-zinc-900/80 text-zinc-200">
                    <td className="px-4 py-3">#{idx + 1}</td>
                    <td className="px-4 py-3 font-medium">{rep.userName}</td>
                    <td className="px-4 py-3 text-emerald-300">{rep.claimedLeads}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TeamLeadDashboard() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Team Performance AI</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Quota Trajectory: 147% projected attainment</h2>
          </div>
          <Users className="h-6 w-6 text-sky-300" />
        </div>
      </section>
      <InvestorCommandCenter />
    </div>
  );
}

function SuperAdminDashboard() {
  const healthCards = [
    { title: "Automation Runtime", value: "99.992%", detail: "Last 30 days", icon: Activity },
    { title: "AI Lead Scoring Calls", value: "4.1M", detail: "24h throughput", icon: Bot },
    { title: "Infra Cost Efficiency", value: "-27%", detail: "vs previous month", icon: Gauge },
    { title: "Data Integrity", value: "100%", detail: "nightly sync checks", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {healthCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">{card.title}</p>
                <Icon className="h-4 w-4 text-sky-300" />
              </div>
              <h2 className="mt-2 text-3xl font-semibold text-white">{card.value}</h2>
              <p className="text-xs text-zinc-400">{card.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Disposition Engine", status: "Optimal", icon: Gem },
          { title: "Acquisition AI", status: "Learning", icon: BrainCircuit },
          { title: "County Data Streams", status: "Healthy", icon: Landmark },
          { title: "Macro Risk Model", status: "Monitoring", icon: AlertTriangle },
        ].map((module) => {
          const Icon = module.icon;
          return (
            <article key={module.title} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-100">{module.title}</p>
                <Icon className="h-4 w-4 text-violet-300" />
              </div>
              <p className="mt-2 text-xs text-zinc-400">System state</p>
              <p className="text-lg font-semibold text-emerald-300">{module.status}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ManagerDashboard() {
  return <InvestorCommandCenter />;
}

function RepDashboard() {
  return <InvestorCommandCenter />;
}

export default function DashboardPage() {
  const { activeRole } = useRole();

  if (activeRole === "TEAM_LEAD") return <TeamLeadDashboard />;
  if (activeRole === "MANAGER") return <ManagerDashboard />;
  if (activeRole === "SUPER_ADMIN") return <SuperAdminDashboard />;

  return <RepDashboard />;
}
