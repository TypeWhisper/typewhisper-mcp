#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTypeWhisperMcpServer } from "./server.js";
import { VERSION } from "./version.js";
import type { DiscoveryOptions } from "./discovery.js";

interface ParsedArgs {
  help: boolean;
  version: boolean;
  discovery: DiscoveryOptions;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stderr.write(usage());
    return;
  }

  if (args.version) {
    process.stderr.write(`typewhisper-mcp ${VERSION}\n`);
    return;
  }

  const server = createTypeWhisperMcpServer({ discovery: args.discovery });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`TypeWhisper MCP ${VERSION} running on stdio\n`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    help: false,
    version: false,
    discovery: {}
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--version":
        parsed.version = true;
        break;
      case "--base-url":
        parsed.discovery.baseUrl = readValue(argv, ++index, arg);
        break;
      case "--port": {
        const port = Number(readValue(argv, ++index, arg));
        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
          throw new Error("--port must be a valid TCP port.");
        }
        parsed.discovery.port = port;
        break;
      }
      case "--api-token":
        parsed.discovery.apiToken = readValue(argv, ++index, arg);
        break;
      case "--dev":
        parsed.discovery.dev = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function usage(): string {
  return `Usage: typewhisper-mcp [options]

Options:
  --base-url <url>       TypeWhisper API base URL, for example http://127.0.0.1:8978
  --port <port>          TypeWhisper API port. Defaults to discovery or 8978
  --api-token <token>    TypeWhisper API bearer token. Defaults to discovery or TYPEWHISPER_API_TOKEN
  --dev                  Use TypeWhisper-Dev discovery files
  --version              Show version
  --help, -h             Show help

Environment:
  TYPEWHISPER_API_BASE_URL
  TYPEWHISPER_API_PORT
  TYPEWHISPER_API_TOKEN
  TYPEWHISPER_DEV=1
`;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
