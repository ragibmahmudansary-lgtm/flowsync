import { jsPDF } from "jspdf";
import { collectReportData } from "./reportData";
import { generatePlotImages } from "./plotsCanvas";
import { buildInterpretation } from "./interpretation";
import { useConsoleStore } from "@/state/useConsoleStore";

/**
 * Generate PDF report with all analysis results.
 * 10-section fixed template per FS-07-005.
 */
export async function generateReport() {
  const log = useConsoleStore.getState().log;

  try {
    log("info", "Generating report...");

    const data = collectReportData();
    const plots = generatePlotImages(data);
    const interpretation = buildInterpretation(data);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // Helper functions
    const addTitle = (text: string, size: number = 16) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", "bold");
      doc.text(text, margin, y);
      y += size * 0.5;
    };

    const addSubtitle = (text: string) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(text, margin, y);
      y += 6;
    };

    const addText = (text: string, size: number = 10) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      doc.text(lines, margin, y);
      y += lines.length * size * 0.4;
    };

    const addImage = (dataUrl: string, width: number = 160) => {
      const height = (width * 2) / 3; // 3:2 aspect ratio
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.addImage(dataUrl, "PNG", margin, y, width, height);
      y += height + 5;
    };

    const checkPageBreak = (required: number) => {
      if (y + required > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // ===== SECTION 1: TITLE PAGE =====
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FlowSync Aerodynamic Analysis Report", pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(data.project.name, pageWidth / 2, 80, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(data.generatedAt).toLocaleString()}`, pageWidth / 2, 100, { align: "center" });
    doc.text(`Config Hash: ${data.configHash}`, pageWidth / 2, 110, { align: "center" });

    if (data.viewport) {
      doc.addImage(data.viewport, "PNG", 40, 130, 130, 80);
    }

    // ===== SECTION 2: PROJECT SUMMARY =====
    doc.addPage();
    y = margin;
    addTitle("1. Project Summary");
    addText(`File: ${data.project.fileName}`);
    addText(`Format: ${data.project.format.toUpperCase()}`);
    addText(`Units: ${data.project.unit}`);
    y += 5;

    // ===== SECTION 3: GEOMETRY =====
    addTitle("2. Geometry");
    addText(`Faces: ${data.geometry.faces}`);
    addText(`Triangles: ${data.geometry.triangles.toLocaleString()}`);
    addText(`Vertices: ${data.geometry.vertices.toLocaleString()}`);
    addText(`Bounding Box: [${data.geometry.bbox.min.map((v) => v.toFixed(2)).join(", ")}] to [${data.geometry.bbox.max.map((v) => v.toFixed(2)).join(", ")}]`);
    addText(`Orientation: ${data.geometry.orientation}`);
    y += 5;

    // ===== SECTION 4: RECOGNITION =====
    addTitle("3. Component Recognition");
    if (data.recognition.wing) {
      addSubtitle("Wing");
      addText(`Span: ${data.recognition.wing.span.toFixed(2)} m`);
      addText(`Area: ${data.recognition.wing.area.toFixed(2)} m²`);
      addText(`MAC: ${data.recognition.wing.mac.toFixed(3)} m`);
      addText(`Aspect Ratio: ${data.recognition.wing.aspectRatio.toFixed(2)}`);
      addText(`Sweep (¼-chord): ${data.recognition.wing.sweep.toFixed(1)}°`);
      addText(`Dihedral: ${data.recognition.wing.dihedral.toFixed(1)}°`);
      y += 3;
    }
    if (data.recognition.htail) {
      addSubtitle("Horizontal Tail");
      addText(`Span: ${data.recognition.htail.span.toFixed(2)} m`);
      addText(`Area: ${data.recognition.htail.area.toFixed(2)} m²`);
      y += 3;
    }
    if (data.recognition.vtail) {
      addSubtitle("Vertical Tail");
      addText(`Area: ${data.recognition.vtail.area.toFixed(2)} m²`);
      addText(`Height: ${data.recognition.vtail.height.toFixed(2)} m`);
      y += 3;
    }
    if (data.recognition.fuselage) {
      addSubtitle("Fuselage");
      addText(`Length: ${data.recognition.fuselage.length.toFixed(2)} m`);
      addText(`Width: ${data.recognition.fuselage.width.toFixed(2)} m`);
      y += 3;
    }

    // ===== SECTION 5: FLIGHT CONDITIONS =====
    checkPageBreak(40);
    addTitle("4. Flight Conditions");
    addText(`Velocity: ${data.flightConditions.velocity} m/s`);
    addText(`Density: ${data.flightConditions.density} kg/m³`);
    addText(`Viscosity: ${data.flightConditions.viscosity} Pa·s`);
    addText(`AoA Range: ${data.flightConditions.aoaRange[0]}° to ${data.flightConditions.aoaRange[1]}° (step ${data.flightConditions.aoaRange[2]}°)`);
    addText(`Panels: ${data.flightConditions.panels.spanwise} spanwise × ${data.flightConditions.panels.chordwise} chordwise`);
    y += 5;

    // ===== SECTION 6: RESULTS TABLE =====
    checkPageBreak(60);
    addTitle("5. Aerodynamic Results");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("α (deg)", margin, y);
    doc.text("CL", margin + 20, y);
    doc.text("CDi", margin + 40, y);
    doc.text("CD0", margin + 60, y);
    doc.text("CD", margin + 80, y);
    doc.text("Cm", margin + 100, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    for (const r of data.results) {
      checkPageBreak(5);
      doc.text(r.alpha.toFixed(1), margin, y);
      doc.text(r.CL.toFixed(4), margin + 20, y);
      doc.text(r.CDi.toFixed(5), margin + 40, y);
      doc.text(r.CD0.toFixed(5), margin + 60, y);
      doc.text(r.CD.toFixed(5), margin + 80, y);
      doc.text(r.Cm.toFixed(4), margin + 100, y);
      y += 4;
    }
    y += 5;

    // ===== SECTION 7: PLOTS =====
    checkPageBreak(80);
    addTitle("6. Results Plots");
    if (plots.cl_vs_alpha) addImage(plots.cl_vs_alpha);
    if (plots.drag_polar) addImage(plots.drag_polar);
    if (plots.cm_vs_alpha) addImage(plots.cm_vs_alpha);
    if (plots.drag_breakdown) addImage(plots.drag_breakdown);

    // ===== SECTION 8: STABILITY =====
    checkPageBreak(40);
    addTitle("7. Static Stability");
    if (data.stability) {
      addText(`Verdict: ${data.stability.verdict}`);
      addText(`Static Margin: ${(data.stability.staticMargin * 100).toFixed(1)}% MAC`);
      addText(`Neutral Point X: ${data.stability.neutralPointX.toFixed(3)} m`);
      addText(`CG X: ${data.stability.cgX.toFixed(3)} m`);
      if (data.stability.trimAlpha !== null) {
        addText(`Trim α: ${data.stability.trimAlpha.toFixed(1)}°`);
      }
    } else {
      addText("Stability analysis not available (requires solver results and CG computation).");
    }
    y += 5;

    // ===== SECTION 9: MASS PROPERTIES =====
    checkPageBreak(30);
    addTitle("8. Mass Properties");
    if (data.mass) {
      addText(`Total Mass: ${data.mass.totalMass.toFixed(1)} kg`);
      addText(`CG X: ${data.mass.cgX.toFixed(3)} m`);
      addText(`CG Z: ${data.mass.cgZ.toFixed(3)} m`);
    } else {
      addText("Mass properties not computed.");
    }
    y += 5;

    // ===== SECTION 10: INTERPRETATION =====
    checkPageBreak(60);
    addTitle("9. Engineering Interpretation");
    for (const line of interpretation) {
      checkPageBreak(10);
      if (line === "") {
        y += 3;
      } else if (line.startsWith("•")) {
        addText(line, 9);
      } else if (line === "Method limitations:") {
        addSubtitle(line);
      } else {
        addText(line);
      }
    }

    // ===== FOOTER ON ALL PAGES =====
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(
        `FlowSync v1.0.0-beta · ${data.configHash} · Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    // Save PDF
    const filename = `FlowSync_Report_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);

    // Also save JSON
    const jsonFilename = filename.replace(".pdf", ".json");
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement("a");
    a.href = jsonUrl;
    a.download = jsonFilename;
    a.click();
    URL.revokeObjectURL(jsonUrl);

    log("success", `Report generated: ${filename}`);
  } catch (err) {
    log("error", `Report generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
