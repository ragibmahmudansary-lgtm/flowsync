import { searchCompendium, GLOSSARY, PLAYBOOK, THEORY } from "./knowledge";

export const TOUR = [
  {
    tab: "geometry" as const,
    title: "Welcome to FlowSync!",
    text: "This is the Geometry tab. Import a CAD file (STEP/IGES/BREP/STL) to begin. The 3D viewport shows your model with automatic segmentation and orientation.",
  },
  {
    tab: "vlm" as const,
    title: "Recognition & Paneling",
    text: "After import, run Auto-Recognition to classify faces into Wing, Htail, Vtail, Fuselage. Check the Pipeline Health checklist — all rows should be green before proceeding.",
  },
  {
    tab: "analysis" as const,
    title: "Flight Conditions & Solver",
    text: "Set velocity, density, AoA sweep, and panel resolution. Click 'Run VLM Analysis' to solve. The worker runs in the background — UI stays responsive.",
  },
  {
    tab: "analysis" as const,
    title: "Mass & CG",
    text: "Compute CG using the Mass & CG box. Editable densities for each component. CG appears as a green marker in the 3D viewport.",
  },
  {
    tab: "results" as const,
    title: "Results & Charts",
    text: "View CL, CD, Cm curves, drag polar, spanwise circulation. The Stability Box shows static margin, neutral point, and verdict (STABLE/UNSTABLE).",
  },
  {
    tab: "results" as const,
    title: "Visualization",
    text: "Toggle 'Panel color map' to see circulation magnitude (blue→red). Toggle 'Flow pathlines' for animated particles. Generate PDF+JSON report when ready.",
  },
  {
    tab: "geometry" as const,
    title: "You're ready!",
    text: "Import a CAD file and follow the workflow. Use Ctrl+K for the command palette. Ask me anything — I understand FlowSync, aerodynamics, and CFD theory.",
  },
];

/**
 * Local expert answer using knowledge compendium.
 * No LLM required — deterministic retrieval.
 */
export function localExpertAnswer(query: string): string {
  const lower = query.toLowerCase();

  // Tour request
  if (lower.includes("tour") || lower.includes("guide me") || lower.includes("tutorial")) {
    return `**Guided Tour**\n\nI'll walk you through FlowSync in 7 steps. Click "Start Tour" to begin, or ask me about any specific topic.\n\n**Quick Start:**\n1. Import CAD (Toolbar → Import CAD)\n2. Tab 2 → Run Auto-Recognition\n3. Tab 3 → Set flight conditions → Run VLM Analysis\n4. Tab 3 → Compute CG\n5. Tab 4 → Read results + Generate Report\n\nNeed help with a specific step?`;
  }

  // Research request
  if (lower.includes("research") || lower.includes("learn more") || lower.includes("read about")) {
    const topic = query.replace(/research|learn more|read about/gi, "").trim();
    return `**Research: ${topic}**\n\nFor deeper learning, I recommend:\n• **VLM theory:** Katz & Plotkin "Low-Speed Aerodynamics"\n• **CFD fundamentals:** Blazek "Computational Fluid Dynamics"\n• **Aircraft stability:** Etkin & Reid "Dynamics of Flight"\n• **OpenFOAM tutorials:** https://openfoam.org/wiki/\n\nWant me to explain a specific concept from the knowledge base?`;
  }

  // Search compendium
  const results = searchCompendium(query);

  const parts: string[] = [];

  // Glossary hits
  if (results.glossary.length > 0) {
    parts.push("**Definitions:**");
    for (const g of results.glossary) {
      parts.push(`• **${g.term}**: ${g.def} *(See: ${g.where})*`);
    }
  }

  // Playbook hits
  if (results.playbook.length > 0) {
    parts.push("\n**How-to:**");
    for (const p of results.playbook) {
      parts.push(`**${p.title}**`);
      for (const step of p.steps) {
        parts.push(`  ${step}`);
      }
    }
  }

  // Theory hits
  if (results.theory.length > 0) {
    parts.push("\n**Theory:**");
    for (const t of results.theory) {
      parts.push(`**${t.title}**: ${t.text}`);
    }
  }

  // Fallback
  if (parts.length === 0) {
    return `I can help with:\n• **Definitions**: CL, CD, MAC, static margin, VLM, CFD, etc.\n• **How-to guides**: first analysis, name faces, fix recognition, interpret stability, validate solver, choose panels, VLM vs CFD, troubleshoot\n• **Theory**: VLM math, wake relaxation, stability theory, transport equation, CFD basics, lifting-line, conventions\n\nTry asking: "what is MAC?", "how do I run the solver?", or "explain static margin".`;
  }

  return parts.join("\n");
}

/**
 * Get tour step by index.
 */
export function getTourStep(index: number) {
  if (index < 0 || index >= TOUR.length) return null;
  return TOUR[index];
}
