"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function RegistrationTrendChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink/40">
        No registrations recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ededf0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#1d293d99" }} />
        <YAxis tick={{ fontSize: 11, fill: "#1d293d99" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #ededf0", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          name="Registrations"
          stroke="#aa1d3f"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#aa1d3f" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
