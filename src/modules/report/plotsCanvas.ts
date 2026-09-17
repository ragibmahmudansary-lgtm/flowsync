import type { ReportData } from "./reportData";

/**
 * Generate chart images as data URLs for the PDF report.
 * Uses HTML5 Canvas for rendering.
 */
export function generatePlotImages(data: ReportData): Record<string, string> {
  const images: Record<string, string> = {};

  if (data.results.length === 0) return images;

  // CL vs Alpha
  images.cl_vs_alpha = generateLineChart(
    "CL vs α",
    "α (deg)",
    "CL",
    data.results.map((r) => ({ x: r.alpha, y: r.CL })),
    "#4F86C6"
  );

  // Drag polar
  images.drag_polar = generateLineChart(
    "Drag Polar",
    "CD",
    "CL",
    data.results.map((r) => ({ x: r.CD, y: r.CL })),
    "#5FA777"
  );

  // Cm vs Alpha
  images.cm_vs_alpha = generateLineChart(
    "Cm vs α",
    "α (deg)",
    "Cm",
    data.results.map((r) => ({ x: r.alpha, y: r.Cm })),
    "#8E7CC3"
  );

  // Drag breakdown
  images.drag_breakdown = generateMultiLineChart(
    "Drag Breakdown",
    "α (deg)",
    "CD",
    [
      { name: "CDi", color: "#C98A4B", points: data.results.map((r) => ({ x: r.alpha, y: r.CDi })) },
      { name: "CD0", color: "#7A8B99", points: data.results.map((r) => ({ x: r.alpha, y: r.CD0 })) },
      { name: "CD", color: "#E11D48", points: data.results.map((r) => ({ x: r.alpha, y: r.CD })) },
    ]
  );

  return images;
}

function generateLineChart(
  title: string,
  xLabel: string,
  yLabel: string,
  points: { x: number; y: number }[],
  color: string
): string {
  return generateMultiLineChart(title, xLabel, yLabel, [{ name: "", color, points }]);
}

function generateMultiLineChart(
  title: string,
  xLabel: string,
  yLabel: string,
  series: Array<{ name: string; color: string; points: { x: number; y: number }[] }>
): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Margins
  const margin = { top: 40, right: 20, bottom: 50, left: 60 };
  const plotWidth = canvas.width - margin.left - margin.right;
  const plotHeight = canvas.height - margin.top - margin.bottom;

  // Compute bounds
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

  const scaleX = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (y: number) => margin.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

  // Grid
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const x = margin.left + (i / 5) * plotWidth;
    const y = margin.top + (i / 5) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + plotWidth, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotHeight);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#52606D";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(xLabel, margin.left + plotWidth / 2, canvas.height - 10);
  ctx.save();
  ctx.translate(15, margin.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(title, canvas.width / 2, 20);

  // Tick labels
  ctx.fillStyle = "#52606D";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const x = xMin + (i / 5) * (xMax - xMin);
    const y = yMin + (i / 5) * (yMax - yMin);
    ctx.fillText(x.toFixed(2), scaleX(x), margin.top + plotHeight + 15);
    ctx.textAlign = "right";
    ctx.fillText(y.toFixed(3), margin.left - 5, scaleY(y) + 3);
    ctx.textAlign = "center";
  }

  // Data series
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < s.points.length; i++) {
      const p = s.points[i];
      const x = scaleX(p.x);
      const y = scaleY(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Points
    ctx.fillStyle = s.color;
    for (const p of s.points) {
      ctx.beginPath();
      ctx.arc(scaleX(p.x), scaleY(p.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Legend
  if (series.length > 1) {
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      const x = margin.left + 10;
      const y = margin.top + 15 + i * 18;
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y - 8, 12, 12);
      ctx.fillStyle = "#0F172A";
      ctx.fillText(s.name, x + 18, y);
    }
  }

  return canvas.toDataURL("image/png");
}
