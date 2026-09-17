export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AgentEvent {
  type: "tool" | "thinking" | "content";
  content?: string;
  tool?: ToolCall;
  result?: string;
}
