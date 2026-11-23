// Single palette for every canvas colour (dark theme; mirrors the CSS tokens).
const PALETTE = {
  canvas: "#141c25",
  title: "#e8eef4",
  muted: "#9aaabb",
  legend: "#c3cfdb",
  frame: "#3b4a5b",
  grid: "#243140",
  zero: "#6b7f94",
  // Series colours are chosen by the caller (src/app.js) from the light-theme
  // set. They are mapped here to dark-theme equivalents; unknown colours pass
  // through unchanged.
  series: {
    "#2764c4": "#6cb2ff",
    "#087f8c": "#3fd6d0",
    "#b23a48": "#ff8a94",
    "#23704a": "#62d79c",
    "#ad6a00": "#f2b457"
  }
};

function seriesColor(color) {
  return PALETTE.series[color] || color;
}

export function drawPlots(canvas, panels) {
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width * dpr));
  const height = Math.max(180, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = PALETTE.canvas;
  context.fillRect(0, 0, width, height);
  context.save();
  context.scale(dpr, dpr);

  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  const gap = 18;
  const panelHeight = (cssHeight - gap * (panels.length - 1)) / panels.length;
  panels.forEach((panel, index) => {
    drawPanel(context, panel, 0, index * (panelHeight + gap), cssWidth, panelHeight);
  });
  context.restore();
}

function drawPanel(context, panel, x, y, width, height) {
  const margin = { left: 48, right: 14, top: 24, bottom: 30 };
  const plot = {
    x: x + margin.left,
    y: y + margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
  const allPoints = panel.series.flatMap((series) => series.points);
  context.fillStyle = PALETTE.title;
  context.font = "12px Segoe UI, Arial, sans-serif";
  context.fillText(panel.title, plot.x, y + 15);
  if (!allPoints.length) {
    context.fillStyle = PALETTE.muted;
    context.fillText("No data", plot.x, plot.y + 16);
    return;
  }

  const xValues = allPoints.map((point) => point.x);
  const yValues = allPoints.map((point) => point.y);
  const xRange = paddedRange(Math.min(...xValues), Math.max(...xValues), 0.02);
  const yRange = paddedRange(Math.min(...yValues), Math.max(...yValues), 0.12);

  context.strokeStyle = PALETTE.frame;
  context.lineWidth = 1;
  context.strokeRect(plot.x, plot.y, plot.width, plot.height);

  drawGrid(context, plot, xRange, yRange);

  for (const series of panel.series) {
    context.beginPath();
    context.strokeStyle = seriesColor(series.color);
    context.lineWidth = 2;
    series.points.forEach((point, index) => {
      const px = map(point.x, xRange[0], xRange[1], plot.x, plot.x + plot.width);
      const py = map(point.y, yRange[0], yRange[1], plot.y + plot.height, plot.y);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.stroke();
  }

  drawLegend(context, panel.series, plot.x + plot.width - 150, y + 8);
  context.fillStyle = PALETTE.muted;
  context.font = "11px Segoe UI, Arial, sans-serif";
  context.fillText(panel.xLabel, plot.x + plot.width - 52, y + height - 7);
  context.fillText(formatTick(xRange[0]), plot.x - 5, y + height - 7);
  context.fillText(formatTick(xRange[1]), plot.x + plot.width - 20, y + height - 7);
  context.fillText(formatTick(yRange[0]), x + 5, plot.y + plot.height + 3);
  context.fillText(formatTick(yRange[1]), x + 5, plot.y + 4);
}

function drawGrid(context, plot, xRange, yRange) {
  context.strokeStyle = PALETTE.grid;
  context.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const px = plot.x + (plot.width * i) / 5;
    const py = plot.y + (plot.height * i) / 5;
    context.beginPath();
    context.moveTo(px, plot.y);
    context.lineTo(px, plot.y + plot.height);
    context.moveTo(plot.x, py);
    context.lineTo(plot.x + plot.width, py);
    context.stroke();
  }
  const zeroY = map(0, yRange[0], yRange[1], plot.y + plot.height, plot.y);
  if (zeroY >= plot.y && zeroY <= plot.y + plot.height) {
    context.strokeStyle = PALETTE.zero;
    context.beginPath();
    context.moveTo(plot.x, zeroY);
    context.lineTo(plot.x + plot.width, zeroY);
    context.stroke();
  }
}

function drawLegend(context, series, x, y) {
  context.font = "11px Segoe UI, Arial, sans-serif";
  series.forEach((item, index) => {
    const yy = y + index * 14;
    context.strokeStyle = seriesColor(item.color);
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, yy);
    context.lineTo(x + 18, yy);
    context.stroke();
    context.fillStyle = PALETTE.legend;
    context.fillText(item.name, x + 23, yy + 4);
  });
}

function paddedRange(min, max, fraction) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (Math.abs(max - min) < 1e-9) {
    const size = Math.max(Math.abs(max), 1) * 0.1;
    return [min - size, max + size];
  }
  const pad = (max - min) * fraction;
  return [min - pad, max + pad];
}

function map(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function formatTick(value) {
  const abs = Math.abs(value);
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) return value.toExponential(1);
  if (abs >= 10) return value.toFixed(0);
  return value.toFixed(2);
}
