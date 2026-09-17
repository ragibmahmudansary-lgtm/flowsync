import { useEffect, useRef, useState, useMemo } from "react";
import { useUIStore } from "@/state/useUIStore";
import { listCommands, runCommand, type CommandDef } from "@/commands/registry";

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 50;
  // fuzzy
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

export function CommandPalette() {
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allCommands = useMemo(() => listCommands(), []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    return allCommands
      .filter((c) => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.category))
      .sort((a, b) => scoreMatch(query, b.label) - scoreMatch(query, a.label));
  }, [query, allCommands]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandDef[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return map;
  }, [filtered]);

  const flatList = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  const execute = (cmd: CommandDef) => {
    setPaletteOpen(false);
    runCommand(cmd.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatList[selectedIdx]) execute(flatList[selectedIdx]);
    }
  };

  if (!paletteOpen) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={() => setPaletteOpen(false)}
    >
      <div
        className="w-[520px] max-h-[60vh] bg-white rounded-lg shadow-2xl border border-[#C3CDD8] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[#C3CDD8]">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 text-sm bg-[#EEF2F6] rounded border border-[#C3CDD8] focus:outline-none focus:border-[#FF6600] focus:ring-1 focus:ring-[#FF6600]/40"
            placeholder="Type a command… (e.g. 'view iso', 'new project')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="flex-1 overflow-auto p-2">
          {flatList.length === 0 && (
            <div className="p-4 text-sm text-[#52606D] text-center">
              No commands match "{query}"
            </div>
          )}
          {Array.from(grouped.entries()).map(([category, cmds]) => (
            <div key={category} className="mb-2">
              <div className="text-[10px] uppercase tracking-widest text-[#52606D] px-2 py-1">
                {category}
              </div>
              {cmds.map((cmd) => {
                const idx = flatIdx++;
                return (
                  <button
                    key={cmd.id}
                    className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center justify-between ${
                      idx === selectedIdx
                        ? "bg-[#FF6600]/10 text-[#C2410C]"
                        : "hover:bg-[#EEF2F6] text-[#0F172A]"
                    }`}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                  >
                    <span>{cmd.label}</span>
                    <span className="text-[10px] text-[#52606D]">
                      {cmd.id}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-[#C3CDD8] text-[10px] text-[#52606D] flex gap-4">
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span>esc close</span>
          <span className="ml-auto">{flatList.length} commands</span>
        </div>
      </div>
    </div>
  );
}
