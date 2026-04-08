const COMMISSION_FLOOR = 2500;
const COMMISSION_RATE = 0.1;

const dealLedger = [
  { property: "2147 E Cedar Vista Dr, Phoenix, AZ", date: "2026-03-03", wholesaleValue: 18000, bonus: 0, status: "Cleared" },
  { property: "99 E 127th St, Cleveland, OH", date: "2026-03-08", wholesaleValue: 32000, bonus: 500, status: "Pending" },
  { property: "213 Pine Orchard Dr, Indianapolis, IN", date: "2026-03-14", wholesaleValue: 24000, bonus: 250, status: "Cleared" },
  { property: "41 Timber Crest, San Antonio, TX", date: "2026-03-22", wholesaleValue: 22000, bonus: 0, status: "Cleared" },
] as const;

function calculateCommission(wholesaleValue: number) {
  return Math.max(Math.round(wholesaleValue * COMMISSION_RATE), COMMISSION_FLOOR);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function QuotaRing({
  label,
  progress,
  value,
  accent,
  stats,
}: {
  label: string;
  progress: number;
  value: string;
  accent: string;
  stats: Array<{ label: string; value: string }>;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg viewBox="0 0 96 96" className="h-24 w-24">
          <circle cx="48" cy="48" r={radius} className="fill-none stroke-zinc-800" strokeWidth="9" />
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="fill-none"
            stroke={accent}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dash}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <span className="absolute text-sm font-semibold text-zinc-100 tabular-nums">{progress}%</span>
      </div>

      <div className="flex-1 space-y-2">
        <p className="text-sm text-zinc-400">{label}</p>
        <p className="text-lg font-semibold text-zinc-100 tabular-nums">{value}</p>
        <div className="space-y-1.5 border-l border-zinc-700 pl-3 text-sm">
          {stats.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-zinc-400">
              <span>{item.label}</span>
              <span className="font-medium text-zinc-200 tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommissionsPage() {
  const ledger = dealLedger.map((deal) => ({
    ...deal,
    commission: calculateCommission(deal.wholesaleValue),
  }));

  const availableForWithdrawal = ledger
    .filter((deal) => deal.status === "Cleared")
    .reduce((sum, deal) => sum + deal.commission + deal.bonus, 0);
  const pendingCommission = ledger
    .filter((deal) => deal.status === "Pending")
    .reduce((sum, deal) => sum + deal.commission + deal.bonus, 0);
  const totalWholesaleVolume = ledger.reduce((sum, deal) => sum + deal.wholesaleValue, 0);
  const totalCommission = ledger.reduce((sum, deal) => sum + deal.commission, 0);
  const averageAssignment = Math.round(totalWholesaleVolume / ledger.length);
  const commissionGoal = 12000;
  const commissionProgress = Math.min(100, Math.round((totalCommission / commissionGoal) * 100));
  const volumeGoal = 120000;
  const volumeProgress = Math.min(100, Math.round((totalWholesaleVolume / volumeGoal) * 100));
  const earnings = ledger.map((deal) => Math.round((deal.commission + deal.bonus) / 100));
  const points = earnings
    .map((point, idx) => `${(idx / Math.max(1, earnings.length - 1)) * 100},${100 - (point / 40) * 100}`)
    .join(" ");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Available for Withdrawal</p>
          <h1 className="mt-3 text-4xl font-semibold text-white tabular-nums sm:text-5xl">{formatCurrency(availableForWithdrawal)}</h1>
          <p className="mt-2 text-sm text-zinc-400">Commission rule: 10% of wholesale value or {formatCurrency(COMMISSION_FLOOR)}, whichever is greater.</p>
          <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
            Withdraw Funds
            <span aria-hidden="true">-&gt;</span>
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold">Commission Trend</h2>
          <div className="h-52 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <polygon points={`0,100 ${points} 100,100`} fill="url(#area)" />
              <polyline points={points} fill="none" stroke="#34d399" strokeWidth="2" />
            </svg>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Pending</p>
              <p className="mt-2 text-xl font-semibold text-zinc-100">{formatCurrency(pendingCommission)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Average Assignment</p>
              <p className="mt-2 text-xl font-semibold text-zinc-100">{formatCurrency(averageAssignment)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <QuotaRing
          label="Monthly Commission Goal"
          progress={commissionProgress}
          value={`${formatCurrency(totalCommission)} / ${formatCurrency(commissionGoal)}`}
          accent="#34d399"
          stats={[
            { label: "Floor Rule", value: formatCurrency(COMMISSION_FLOOR) },
            { label: "Commission Rate", value: `${Math.round(COMMISSION_RATE * 100)}%` },
          ]}
        />

        <QuotaRing
          label="Wholesale Volume Goal"
          progress={volumeProgress}
          value={`${formatCurrency(totalWholesaleVolume)} / ${formatCurrency(volumeGoal)}`}
          accent="#60a5fa"
          stats={[
            { label: "Deals Closed", value: String(ledger.length) },
            { label: "Avg Assignment", value: formatCurrency(averageAssignment) },
          ]}
        />
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Wholesale Commission Ledger</h3>
            <p className="mt-1 text-sm text-zinc-400">Every row uses the same payout logic: commission = max(10% of wholesale fee, {formatCurrency(COMMISSION_FLOOR)}).</p>
          </div>
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.16em] text-zinc-300">
            {ledger.length} closed deals
          </span>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400">
            <tr className="border-b border-zinc-800">
              <th className="py-2">Property</th>
              <th className="py-2">Date Closed</th>
              <th className="py-2">Status</th>
              <th className="py-2">Wholesale Value</th>
              <th className="py-2">Commission</th>
              <th className="py-2">Bonus</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((item) => (
              <tr key={`${item.property}-${item.date}`} className="border-b border-zinc-800/70 text-zinc-300 transition hover:bg-zinc-900/50">
                <td className="py-3">{item.property}</td>
                <td className="py-3 tabular-nums">{item.date}</td>
                <td className="py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.status === "Cleared"
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-400/30 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="py-3 font-medium text-zinc-200 tabular-nums">{formatCurrency(item.wholesaleValue)}</td>
                <td className="py-3 font-semibold text-white tabular-nums">{formatCurrency(item.commission)}</td>
                <td className="py-3 text-emerald-300 tabular-nums">{formatCurrency(item.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
