import { describe, it, expect } from "vitest";
import { searchCompendium, GLOSSARY, PLAYBOOK, THEORY } from "@/modules/aerobot/knowledge";
import { executeTool } from "@/modules/aerobot/tools";
import { localExpertAnswer, TOUR, getTourStep } from "@/modules/aerobot/localExpert";

describe("AeroBot Knowledge Compendium", () => {
  it("should have comprehensive glossary entries", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(35);
  });

  it("should have playbook entries", () => {
    expect(PLAYBOOK.length).toBeGreaterThanOrEqual(8);
  });

  it("should have theory entries", () => {
    expect(THEORY.length).toBeGreaterThanOrEqual(7);
  });

  it("should search glossary by term", () => {
    const results = searchCompendium("MAC");
    expect(results.glossary.length).toBeGreaterThan(0);
    expect(results.glossary[0].term).toContain("MAC");
  });

  it("should search glossary by keyword", () => {
    const results = searchCompendium("lift coefficient");
    expect(results.glossary.length).toBeGreaterThan(0);
  });

  it("should search playbook by title", () => {
    const results = searchCompendium("first analysis");
    expect(results.playbook.length).toBeGreaterThan(0);
  });

  it("should search theory by keyword", () => {
    const results = searchCompendium("VLM");
    expect(results.theory.length).toBeGreaterThan(0);
  });

  it("should return empty results for unknown terms", () => {
    const results = searchCompendium("xyzunknown123");
    expect(results.glossary.length).toBe(0);
    expect(results.playbook.length).toBe(0);
    expect(results.theory.length).toBe(0);
  });
});

describe("AeroBot Tool Execution", () => {
  it("should execute explain_term tool", async () => {
    const result = await executeTool("explain_term", { topic: "MAC" });
    expect(result).toContain("MAC");
  });

  it("should execute how_do_i tool", async () => {
    const result = await executeTool("how_do_i", { task: "first analysis" });
    expect(result).toContain("Import CAD");
  });

  it("should handle unknown tool gracefully", async () => {
    const result = await executeTool("unknown_tool", {});
    expect(result).toBe("Unknown tool: unknown_tool");
  });

  it("should handle missing parameters gracefully", async () => {
    const result = await executeTool("explain_term", {});
    expect(result).toContain("No glossary entry");
  });
});

describe("AeroBot Local Expert", () => {
  it("should provide local expert answers", () => {
    const answer = localExpertAnswer("what is MAC?");
    expect(answer).toContain("MAC");
  });

  it("should handle tour requests", () => {
    const answer = localExpertAnswer("guide me");
    expect(answer).toContain("Tour");
  });

  it("should handle research requests", () => {
    const answer = localExpertAnswer("research VLM");
    expect(answer).toContain("VLM");
  });

  it("should provide fallback for unknown queries", () => {
    const answer = localExpertAnswer("xyzunknown123");
    expect(answer).toContain("I can help with");
  });
});

describe("AeroBot Tour", () => {
  it("should have tour steps", () => {
    expect(TOUR.length).toBeGreaterThan(0);
  });

  it("should get tour step by index", () => {
    const step = getTourStep(0);
    expect(step).toBeDefined();
    expect(step?.tab).toBeDefined();
    expect(step?.title).toBeDefined();
    expect(step?.text).toBeDefined();
  });

  it("should return null for out-of-bounds index", () => {
    const step = getTourStep(999);
    expect(step).toBeNull();
  });
});
