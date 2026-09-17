import { registerCommand } from "./registry";
import { generateReport } from "@/modules/report/pdfReport";

registerCommand({
  id: "report.generate",
  label: "Generate engineering report (PDF + JSON)",
  category: "Report",
  run: () => generateReport(),
});
