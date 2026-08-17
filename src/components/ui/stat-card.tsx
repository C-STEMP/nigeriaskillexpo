"use client";

import { Icon, type IconName } from "./icon";

export function StatCard({
  icon,
  value,
  label,
  context,
  highlight = false,
}: {
  icon: IconName;
  value: string;
  label: string;
  context?: string;
  /** Use sparingly — one highlighted card per view, for the metric that matters most. */
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-secondary bg-secondary/5"
          : "border-grey bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-ink/60">
        <span className={highlight ? "text-secondary" : "text-primary"}>
          <Icon name={icon} />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
      {context && <div className="mt-1 text-xs text-ink/50">{context}</div>}
    </div>
  );
}
