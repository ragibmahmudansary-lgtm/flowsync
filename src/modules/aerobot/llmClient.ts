import type { AgentEvent, ToolCall } from "./types";
import { TOOL_SCHEMAS, executeTool } from "./tools";
import { buildSystemPrompt } from "./systemPrompt";
import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useSolverStore } from "@/state/useSolverStore";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface LLMConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

/**
 * Build live context JSON for the system prompt.
 */
function buildLiveContext(): string {
  const model = useGeometryStore.getState().model;
  const recognition = useRecognitionStore.getState().result;
  const solver = useSolverStore.getState();

  const ctx: any = {};

  if (model) {
    ctx.model = {
      fileName: model.fileName,
      format: model.format,
      faces: model.faces.length,
      triangles: model.triangleCount,
    };
  }

  if (recognition) {
    ctx.recognition = {
      status: recognition.status,
      wing: recognition.wing ? {
        span: recognition.wing.span.toFixed(2),
        area: recognition.wing.area.toFixed(2),
        ar: recognition.wing.aspectRatio.toFixed(2),
      } : null,
    };
  }

  if (solver.results.length > 0) {
    const last = solver.results[solver.results.length - 1];
    ctx.solver = {
      cases: solver.results.length,
      lastAlpha: last.alphaDeg,
      lastCL: last.CL.toFixed(3),
      lastCD: last.CD.toFixed(4),
    };
  }

  return JSON.stringify(ctx, null, 2);
}

/**
 * Run the agent loop with tool calling.
 * Max 6 turns to prevent infinite loops.
 */
export async function runAgentLoop(
  userMessage: string,
  config: LLMConfig,
  onEvent: (event: AgentEvent) => void
): Promise<string> {
  const messages: Message[] = [
    {
      role: "system",
      content: buildSystemPrompt() + "\n\nLIVE APP CONTEXT:\n" + buildLiveContext(),
    },
    { role: "user", content: userMessage },
  ];

  let finalContent = "";
  let turns = 0;
  const maxTurns = 6;

  while (turns < maxTurns) {
    turns++;
    onEvent({ type: "thinking", content: `Turn ${turns}...` });

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          tools: TOOL_SCHEMAS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error("No response from LLM");
      }

      const assistantMessage = choice.message;

      // Add assistant message to history
      messages.push(assistantMessage);

      // If there's content, emit it
      if (assistantMessage.content) {
        finalContent = assistantMessage.content;
        onEvent({ type: "content", content: assistantMessage.content });
      }

      // If there are tool calls, execute them
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || "{}");

          onEvent({ type: "tool", tool: { id: toolCall.id, name, arguments: args } });

          const result = await executeTool(name, args);

          onEvent({ type: "tool", result });

          // Add tool result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Continue loop to let LLM process tool results
        continue;
      }

      // No tool calls, we're done
      break;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      onEvent({ type: "content", content: `Error: ${errMsg}` });
      return `Agent loop error: ${errMsg}`;
    }
  }

  if (turns >= maxTurns) {
    onEvent({ type: "content", content: "Warning: reached max turns (6). Response may be incomplete." });
  }

  return finalContent;
}
