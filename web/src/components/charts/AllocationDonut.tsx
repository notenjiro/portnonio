type AllocationItem = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

type Props = {
  items: AllocationItem[];
  totalValue: number;
};

const SEGMENT_COLORS = [
  "#0f172a",
  "#10b981",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#ef4444",
];

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export default function AllocationDonut({ items, totalValue }: Props) {
  const size = 220;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  let currentAngle = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:items-center">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />

          {items.map((item, index) => {
            const sweep = (item.percent / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sweep;
            currentAngle += sweep;

            if (sweep <= 0) return null;

            return (
              <path
                key={item.key}
                d={describeArc(center, center, radius, startAngle, endAngle)}
                fill="none"
                stroke={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Tracked Value
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {totalValue.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                }}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500">
                  {item.value.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <p className="ml-4 shrink-0 text-sm font-semibold text-slate-900">
              {item.percent.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
              %
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}