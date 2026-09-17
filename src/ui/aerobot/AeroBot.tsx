import { useState, useRef, useEffect } from "react";
import { useUIStore } from "@/state/useUIStore";
import { runAgentLoop } from "@/modules/aerobot/llmClient";
import { localExpertAnswer, TOUR, getTourStep } from "@/modules/aerobot/localExpert";
import type { AgentEvent } from "@/modules/aerobot/types";

interface TranscriptEntry {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export function AeroBot() {
  const isOpen = useUIStore((s) => s.aeroBotOpen);
  const setOpen = useUIStore((s) => s.setAeroBotOpen);

  const [mode, setMode] = useState<"local" | "agent">("local");
  const [showSettings, setShowSettings] = useState(false);
  const [endpoint, setEndpoint] = useState("https://api.openai.com/v1/chat/completions");
  const [model, setModel] = useState("gpt-4");
  const [apiKey, setApiKey] = useState("");
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tourIndex, setTourIndex] = useState(-1);

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("flowsync:aerobot:settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.endpoint) setEndpoint(s.endpoint);
        if (s.model) setModel(s.model);
        if (s.apiKey) setApiKey(s.apiKey);
        if (s.mode) setMode(s.mode);
      } catch {}
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem(
      "flowsync:aerobot:settings",
      JSON.stringify({ endpoint, model, apiKey, mode })
    );
  }, [endpoint, model, apiKey, mode]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Tour event listener
  useEffect(() => {
    const handler = () => {
      setTourIndex(0);
      const step = getTourStep(0);
      if (step) {
        useUIStore.getState().setActiveTab(step.tab);
        setTranscript((prev) => [
          ...prev,
          { role: "assistant", content: `**${step.title}**\n\n${step.text}` },
        ]);
      }
    };
    window.addEventListener("flowsync:aerobot-tour", handler);
    return () => window.removeEventListener("flowsync:aerobot-tour", handler);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setTranscript((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      if (mode === "agent" && apiKey) {
        // Agent mode with LLM
        const events: AgentEvent[] = [];
        const finalContent = await runAgentLoop(
          userMsg,
          { endpoint, model, apiKey },
          (event) => {
            events.push(event);
            if (event.type === "tool" && event.tool) {
              setTranscript((prev) => [
                ...prev,
                { role: "tool", content: event.result || "", toolName: event.tool!.name },
              ]);
            }
          }
        );
        setTranscript((prev) => [...prev, { role: "assistant", content: finalContent }]);
      } else {
        // Local expert mode
        const answer = localExpertAnswer(userMsg);
        setTranscript((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setTranscript((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errMsg}\n\nFalling back to local expert mode.` },
      ]);
      const answer = localExpertAnswer(userMsg);
      setTranscript((prev) => [...prev, { role: "assistant", content: answer }]);
    } finally {
      setLoading(false);
    }
  };

  const handleTourNext = () => {
    const nextIndex = tourIndex + 1;
    const step = getTourStep(nextIndex);
    if (step) {
      setTourIndex(nextIndex);
      useUIStore.getState().setActiveTab(step.tab);
      setTranscript((prev) => [
        ...prev,
        { role: "assistant", content: `**${step.title}**\n\n${step.text}` },
      ]);
    }
  };

  const handleTourBack = () => {
    if (tourIndex > 0) {
      const prevIndex = tourIndex - 1;
      const step = getTourStep(prevIndex);
      if (step) {
        setTourIndex(prevIndex);
        useUIStore.getState().setActiveTab(step.tab);
        setTranscript((prev) => [
          ...prev,
          { role: "assistant", content: `**${step.title}**\n\n${step.text}` },
        ]);
      }
    }
  };

  const quickChips = [
    "guide me",
    "what is MAC?",
    "explain static margin",
    "how do I name selected faces?",
    "run the solver and interpret my results",
    "research VLM",
  ];

  if (!isOpen) {
    return (
      <button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#FF6600] text-white shadow-lg hover:bg-[#C2410C] transition-colors flex items-center justify-center text-2xl z-50"
        onClick={() => setOpen(true)}
        title="Open AeroBot"
      >
        🤖
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white border border-[#C3CDD8] rounded-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="h-12 px-4 border-b border-[#C3CDD8] flex items-center gap-2">
        <div className="text-xl">🤖</div>
        <div className="flex-1">
          <div className="font-semibold text-sm">AeroBot v4</div>
          <div className="text-[10px] text-[#52606D]">
            {mode === "agent" ? "AGENT (LLM)" : "LOCAL EXPERT"}
          </div>
        </div>
        <button
          className="text-[#52606D] hover:text-[#FF6600]"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙️
        </button>
        <button
          className="text-[#52606D] hover:text-[#FF6600]"
          onClick={() => setOpen(false)}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <div className="p-3 border-b border-[#C3CDD8] bg-[#EEF2F6] space-y-2">
          <div>
            <label className="text-[10px] text-[#52606D]">Mode</label>
            <select
              className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
              value={mode}
              onChange={(e) => setMode(e.target.value as "local" | "agent")}
            >
              <option value="local">Local Expert (offline)</option>
              <option value="agent">Agent (LLM, requires API key)</option>
            </select>
          </div>
          {mode === "agent" && (
            <>
              <div>
                <label className="text-[10px] text-[#52606D]">Endpoint</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-[#52606D]">Model</label>
                <input
                  type="text"
                  className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-[#52606D]">API Key</label>
                <input
                  type="password"
                  className="w-full px-2 py-1 text-xs border border-[#C3CDD8] rounded"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-auto p-3 space-y-3">
        {transcript.length === 0 && (
          <div className="text-center text-[#52606D] text-xs py-8">
            <div className="text-3xl mb-2">🤖</div>
            <div className="font-medium mb-1">AeroBot v4</div>
            <div className="text-[10px]">
              I understand FlowSync, aerodynamics, and CFD theory.
              <br />
              Ask me anything or start the guided tour.
            </div>
          </div>
        )}
        {transcript.map((entry, i) => (
          <div key={i} className={entry.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-xs ${
                entry.role === "user"
                  ? "bg-[#FF6600] text-white"
                  : entry.role === "tool"
                  ? "bg-[#EEF2F6] border border-[#C3CDD8] font-mono text-[10px]"
                  : "bg-[#EEF2F6] border border-[#C3CDD8]"
              }`}
            >
              {entry.role === "tool" && entry.toolName && (
                <div className="text-[9px] text-[#52606D] mb-1">🔧 {entry.toolName}</div>
              )}
              <div className="whitespace-pre-wrap">{entry.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-center text-[#52606D] text-xs">
            <div className="inline-block animate-pulse">Thinking...</div>
          </div>
        )}
      </div>

      {/* Tour controls */}
      {tourIndex >= 0 && (
        <div className="px-3 py-2 border-t border-[#C3CDD8] bg-[#EEF2F6] flex items-center gap-2">
          <button
            className="px-2 py-1 text-xs border border-[#C3CDD8] rounded hover:border-[#FF6600]"
            onClick={handleTourBack}
            disabled={tourIndex === 0}
          >
            ← Back
          </button>
          <div className="flex-1 text-center text-[10px] text-[#52606D]">
            Step {tourIndex + 1} of {TOUR.length}
          </div>
          <button
            className="px-2 py-1 text-xs border border-[#C3CDD8] rounded hover:border-[#FF6600]"
            onClick={handleTourNext}
            disabled={tourIndex === TOUR.length - 1}
          >
            Next →
          </button>
          <button
            className="px-2 py-1 text-xs border border-[#C3CDD8] rounded hover:border-red-400 hover:text-red-600"
            onClick={() => setTourIndex(-1)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick chips */}
      <div className="px-3 py-2 border-t border-[#C3CDD8] flex flex-wrap gap-1">
        {quickChips.map((chip) => (
          <button
            key={chip}
            className="px-2 py-1 text-[10px] border border-[#C3CDD8] rounded hover:border-[#FF6600] hover:text-[#C2410C]"
            onClick={() => {
              setInput(chip);
              setTimeout(handleSend, 0);
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#C3CDD8]">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 text-xs border border-[#C3CDD8] rounded focus:outline-none focus:border-[#FF6600]"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <button
            className="px-4 py-2 bg-[#FF6600] text-white rounded hover:bg-[#C2410C] text-xs font-medium disabled:opacity-50"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
