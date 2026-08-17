"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function SectorBreakdownChart({
  data,
}: {
  data: { sector: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink/40">
        No applicants registered under any sector yet.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#ededf0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#1d293d99" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="sector"
          width={140}
          tick={{ fontSize: 11, fill: "#1d293d" }}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #ededf0", fontSize: 12 }}
        />
        <Bar dataKey="count" name="Applicants" fill="#aa1d3f" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
