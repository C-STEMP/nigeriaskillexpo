export function CompletionGauge({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const radius = 80;
  const stroke = 14;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      {/* SVG ring */}
      <div className="relative flex items-center justify-center" style={{ width: radius * 2, height: radius * 2 }}>
        <svg
          height={radius * 2}
          width={radius * 2}
          className="absolute inset-0 -rotate-90"
        >
          <circle
            stroke="var(--color-ink)"
            strokeOpacity={0.1}
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="var(--color-secondary)"
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.6s ease" }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        {/* Centered score — positioned absolutely inside the SVG container */}
        <div className="relative flex flex-col items-center">
          <span className="font-display text-4xl font-bold text-ink">{Math.round(value)}</span>
          <span className="text-xs text-ink/50">/{max}</span>
        </div>
      </div>
      {/* Label sits clearly BELOW the SVG, no overlap possible */}
      <span className="max-w-[200px] text-center text-sm text-ink/60 leading-snug">{label}</span>
    </div>
  );
}
