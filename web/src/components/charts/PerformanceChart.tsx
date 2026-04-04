type PerformancePoint = {
  date: string;
  totalValue: number;
};

type Props = {
  points: PerformancePoint[];
};

function formatCompactMoney(value: number) {
  if (!Number.isFinite(value)) return "$0";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export default function PerformanceChart({ points }: Props) {
  const width = 760;
  const height = 260;
  const paddingX = 24;
  const paddingTop = 16;
  const paddingBottom = 36;

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500">
        No performance history yet
      </div>
    );
  }

  const values = points.map((point) => point.totalValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const polylinePoints = points
    .map((point, index) => {
      const x =
        paddingX +
        (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y =
        paddingTop +
        (1 - (point.totalValue - minValue) / range) * chartHeight;

      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = [
    `${paddingX},${height - paddingBottom}`,
    ...points.map((point, index) => {
      const x =
        paddingX +
        (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y =
        paddingTop +
        (1 - (point.totalValue - minValue) / range) * chartHeight;

      return `${x},${y}`;
    }),
    `${paddingX + chartWidth},${height - paddingBottom}`,
  ].join(" ");

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const value = maxValue - range * ratio;
    const y = paddingTop + chartHeight * ratio;

    return { value, y };
  });

  const xLabels = [
    points[0],
    points[Math.floor((points.length - 1) / 2)],
    points[points.length - 1],
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="performanceArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(14,165,233,0.28)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0.03)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, index) => (
          <g key={index}>
            <line
              x1={paddingX}
              x2={paddingX + chartWidth}
              y1={tick.y}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text
              x={paddingX}
              y={tick.y - 6}
              fontSize="11"
              fill="#64748b"
            >
              {formatCompactMoney(tick.value)}
            </text>
          </g>
        ))}

        <polygon points={areaPoints} fill="url(#performanceArea)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => {
          const x =
            paddingX +
            (index / Math.max(points.length - 1, 1)) * chartWidth;
          const y =
            paddingTop +
            (1 - (point.totalValue - minValue) / range) * chartHeight;

          if (
            index !== 0 &&
            index !== points.length - 1 &&
            index !== Math.floor((points.length - 1) / 2)
          ) {
            return null;
          }

          return (
            <g key={point.date}>
              <circle cx={x} cy={y} r="4" fill="#0ea5e9" />
              <circle cx={x} cy={y} r="7" fill="rgba(14,165,233,0.14)" />
            </g>
          );
        })}

        {xLabels.map((point, index) => {
          const pointIndex = points.findIndex((item) => item.date === point.date);
          const x =
            paddingX +
            (pointIndex / Math.max(points.length - 1, 1)) * chartWidth;

          return (
            <text
              key={`${point.date}-${index}`}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {new Date(point.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}