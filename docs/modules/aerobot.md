# AeroBot v4 — Intelligent Assistant

## Overview

AeroBot v4 is FlowSync's built-in expert engineering agent that understands the application, aerodynamics theory, and CFD fundamentals. It provides context-aware assistance through a deterministic tool API and optional LLM integration.

## Architecture

### Knowledge Compendium

The knowledge base consists of three layers:

1. **GLOSSARY** (39 entries): Technical terms with definitions and FlowSync locations
   - Examples: CL, CD, MAC, static margin, VLM, CFD, Reynolds number
   - Each entry includes: term, keywords, definition, where-to-see reference

2. **PLAYBOOK** (8 entries): Step-by-step operational guides
   - First analysis workflow
   - Named selections
   - Fixing recognition
   - Interpreting stability
   - Validation procedure
   - Panel resolution
   - VLM vs CFD decision
   - Troubleshooting

3. **THEORY** (7 entries): Deeper theoretical explanations
   - VLM mathematics
   - Wake relaxation = vorticity transport
   - Longitudinal static stability
   - General Transport Equation mapping
   - CFD fundamentals
   - Lifting-line reference
   - FlowSync conventions

### Tool API (17 tools)

All tools are deterministic and execute locally:

**State Query Tools:**
- `get_project_state` — Model file, faces, triangles, bbox, orientation
- `get_recognition_state` — Component counts, wing geometry, warnings
- `get_solver_results` — CL slope, coefficients, span efficiency
- `get_stability` — Verdict, static margin, neutral point, trim

**Action Tools:**
- `run_recognition` — Execute auto-recognition
- `run_solver` — Start VLM sweep in worker
- `run_validation` — Run AR=6 validation case
- `set_flight_conditions` — Update velocity, density, AoA sweep
- `set_panel_settings` — Update spanwise/chordwise panels
- `select_component` — Select all faces of a component
- `navigate_tab` — Switch UI tab
- `set_view` — Camera preset (Iso/Top/Front/Side/Reset)
- `set_display_mode` — Shaded/wireframe/shadedEdges
- `open_console` — Toggle analysis console
- `generate_report` — Generate PDF+JSON report

**Knowledge Tools:**
- `explain_term` — Fetch glossary definition + where-to-see
- `how_do_i` — Fetch playbook steps

### Dual Mode Operation

**Local Expert Mode (default, offline):**
- No API key required
- Uses knowledge compendium for answers
- Deterministic retrieval based on keyword matching
- Always available, even without internet

**Agent Mode (opt-in, requires API key):**
- OpenAI-compatible API endpoint
- System prompt includes knowledge index + live app context
- Tool-calling loop (max 6 turns)
- Executes tools deterministically, LLM interprets results
- User controls endpoint, model, and API key

### System Prompt Design

The system prompt uses an **index-style** approach:
- Lists all glossary terms, playbook titles, and theory titles
- LLM fetches specific content via tools (RAG-style)
- Includes live app context (model info, recognition state, solver results)
- Enforces tool-use rules: never guess state, always verify after actions

## Usage

### Opening AeroBot

1. Click the 🤖 button in the bottom-right corner
2. Or use Ctrl+K → "Open AeroBot assistant"
3. Or use Ctrl+K → "Start beginner guided tour"

### Local Expert Mode

Ask questions naturally:
- "what is MAC?"
- "how do I run the solver?"
- "explain static margin"
- "guide me" (starts 7-step tour)
- "research VLM" (provides learning resources)

### Agent Mode

1. Click ⚙️ settings
2. Switch mode to "Agent (LLM, requires API key)"
3. Enter endpoint (default: OpenAI), model, and API key
4. Ask complex questions that require multi-step reasoning:
   - "run the solver and interpret my results"
   - "check if my configuration is stable and suggest improvements"

### Guided Tour

The tour walks through 7 steps:
1. Welcome + Geometry tab overview
2. Recognition & paneling (VLM tab)
3. Flight conditions & solver (Analysis tab)
4. Mass & CG computation
5. Results & charts (Results tab)
6. Visualization features
7. Ready to begin

Tour controls: Back/Next buttons, step counter, exit button.

## Compliance

**Beta Constraints (§3.6, §8.9):**
- ✅ Ships offline-first (local expert mode)
- ✅ No bundled AI service
- ✅ LLM mode requires user-supplied API key
- ✅ All app mutations go through deterministic tool API
- ✅ Same tools used by UI, palette, and agent
- ✅ Transparent: user sees every tool call and result

**Design Principles:**
- Local retrieval is instant and deterministic
- LLM mode is opt-in and user-controlled
- Tool API is the single source of truth for app state
- Knowledge compendium is shipped with the app (no external dependencies)

## Implementation Details

### Files

- `src/modules/aerobot/knowledge.ts` — GLOSSARY, PLAYBOOK, THEORY, searchCompendium
- `src/modules/aerobot/systemPrompt.ts` — buildSystemPrompt with live context
- `src/modules/aerobot/tools.ts` — TOOL_SCHEMAS, executeTool
- `src/modules/aerobot/llmClient.ts` — runAgentLoop (OpenAI-compatible)
- `src/modules/aerobot/localExpert.ts` — localExpertAnswer, TOUR, getTourStep
- `src/modules/aerobot/types.ts` — ToolSchema, ToolCall, AgentEvent
- `src/ui/aerobot/AeroBot.tsx` — Floating panel UI
- `src/commands/aerobotCommands.ts` — aerobot.open, aerobot.tour
- `tests/aerobot.test.ts` — Compendium, tools, local expert, tour tests

### State Management

- `useUIStore.aeroBotOpen` — Panel visibility
- `useUIStore.setAeroBotOpen` — Toggle panel
- Settings persisted in localStorage: `flowsync:aerobot:settings`

### Event System

- `flowsync:aerobot-tour` — Custom event to start guided tour
- Dispatched by `aerobot.tour` command
- Listened by AeroBot component

## Limitations

- **Local Expert**: Keyword-based retrieval, no semantic understanding
- **Agent Mode**: Requires internet + API key, subject to LLM rate limits
- **Knowledge Scope**: Limited to what's in the compendium (39 glossary, 8 playbooks, 7 theory)
- **Tool Execution**: All tools are synchronous except `generate_report` (async PDF generation)
- **No Memory**: Each conversation starts fresh (no persistent chat history)

## Future Enhancements (Post-Beta)

- Persistent conversation history
- Semantic search (embeddings) for knowledge compendium
- Additional playbooks for advanced workflows
- Integration with external documentation (OpenFOAM, ANSYS)
- Voice input/output
- Multi-language support
