import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class TypeWhisperError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TypeWhisperError";
  }
}

export class TypeWhisperConnectionError extends TypeWhisperError {
  constructor(
    message = "Cannot connect to TypeWhisper. Make sure TypeWhisper is running and the local API server is enabled in Settings > Advanced.",
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "TypeWhisperConnectionError";
  }
}

export class TypeWhisperHttpError extends TypeWhisperError {
  readonly status: number;
  readonly apiCode?: string;

  constructor(status: number, message: string, apiCode?: string) {
    super(message);
    this.name = "TypeWhisperHttpError";
    this.status = status;
    this.apiCode = apiCode;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof TypeWhisperHttpError) {
    if (error.status === 401) {
      return "TypeWhisper API authentication failed. Restart TypeWhisper so the discovery token refreshes, or pass TYPEWHISPER_API_TOKEN.";
    }
    if (error.status === 503) {
      return "TypeWhisper has no transcription model ready. Load or select a model in TypeWhisper first.";
    }
    return `TypeWhisper API returned HTTP ${error.status}: ${error.message}`;
  }

  if (error instanceof TypeWhisperError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown TypeWhisper MCP error.";
}

export function errorResult(error: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: formatError(error) }],
    isError: true
  };
}
