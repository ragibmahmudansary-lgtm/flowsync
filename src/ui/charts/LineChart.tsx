interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

interface LineChartProps {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
}

export function LineChart({ title, xLabel, yLabel, series }: LineChartProps) {
  const width = 400;
  const height = 250;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };

  // Compute data bounds
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
  }

  // Add 5% margin
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  xMin -= xRange * 0.05;
  xMax += xRange * 0.05;
  yMin -= yRange * 0.05;
  yMax += yRange * 0.05;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (x: number) => padding.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (y: number) => padding.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

  // Generate grid lines
  const xTicks = 5;
  const yTicks = 5;
  const xStep = (xMax - xMin) / xTicks;
  const yStep = (yMax - yMin) / yTicks;

  return (
    <div className="bg-white border border-[#C3CDD8] rounded p-3">
      <div className="text-xs font-medium text-[#0F172A] mb-2">{title}</div>
      <svg width={width} height={height} className="w-full h-auto">
        {/* Grid */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const x = xMin + i * xStep;
          return (
            <g key={`x${i}`}>
              <line x1={scaleX(x)} y1={padding.top} x2={scaleX(x)} y2={padding.top + plotHeight} stroke="#E5E7EB" strokeWidth={1} />
              <text x={scaleX(x)} y={height - 10} textAnchor="middle" className="text-[9px] fill-[#52606D]">
                {x.toFixed(2)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = yMin + i * yStep;
          return (
            <g key={`y${i}`}>
              <line x1={padding.left} y1={scaleY(y)} x2={padding.left + plotWidth} y2={scaleY(y)} stroke="#E5E7EB" strokeWidth={1} />
              <text x={padding.left - 5} y={scaleY(y) + 3} textAnchor="end" className="text-[9px] fill-[#52606D]">
                {y.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#0F172A" strokeWidth={1.5} />
        <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} stroke="#0F172A" strokeWidth={1.5} />

        {/* Axis labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-[#52606D]">
          {xLabel}
        </text>
        <text x={15} y={height / 2} textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`} className="text-[10px] fill-[#52606D]">
          {yLabel}
        </text>

        {/* Data series */}
        {series.map((s, si) => {
          const path = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} />
              {s.points.map((p, i) => (
                <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r={2} fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* Legend */}
        {series.map((s, i) => (
          <g key={i} transform={`translate(${padding.left + 10}, ${padding.top + 10 + i * 15})`}>
            <rect width={10} height={10} fill={s.color} />
            <text x={15} y={8} className="text-[9px] fill-[#0F172A]">
              {s.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
