# TypeWhisper MCP

`@typewhisper/mcp` exposes the local TypeWhisper API as a Model Context Protocol server for coding agents and other MCP clients.

It connects to a TypeWhisper app running locally or on a remote host and lets agents transcribe files, inspect model status, search transcription history, and manage Dictionary terms and corrections.

## Requirements

- Node.js 20 or newer on the machine running this MCP server
- TypeWhisper on a reachable macOS or Windows host
- TypeWhisper local API server enabled under **Settings > Advanced**

## Install

```bash
npm install -g @typewhisper/mcp
```

For local development from this repo:

```bash
npm install
npm run build
node dist/bin.js --help
```

## MCP Configuration

Most MCP clients can run the server over stdio:

```json
{
  "mcpServers": {
    "typewhisper": {
      "command": "npx",
      "args": ["-y", "@typewhisper/mcp"]
    }
  }
}
```

For a local checkout:

```json
{
  "mcpServers": {
    "typewhisper": {
      "command": "node",
      "args": ["/Users/marco/Projects/typewhisper-mcp/dist/bin.js"]
    }
  }
}
```

## Discovery

By default, the server mirrors the TypeWhisper CLI discovery behavior:

1. `TYPEWHISPER_API_BASE_URL`, `TYPEWHISPER_API_PORT`, and `TYPEWHISPER_API_TOKEN`
2. TypeWhisper discovery files:
   - macOS: `~/Library/Application Support/TypeWhisper/api-discovery.json`
   - Windows: `%LOCALAPPDATA%\\TypeWhisper-UserData\\api-discovery.json`
   - Windows legacy fallback: `%LOCALAPPDATA%\\TypeWhisper\\api-discovery.json`
3. The matching legacy `api-port` file
4. `http://127.0.0.1:8978`

Use `--dev` or `TYPEWHISPER_DEV=1` to read development discovery files (`TypeWhisper-Dev` on macOS and `TypeWhisper-DevUserData` with a `TypeWhisper-Dev` fallback on Windows).

```bash
typewhisper-mcp --dev
typewhisper-mcp --base-url http://127.0.0.1:8978 --api-token "$TYPEWHISPER_API_TOKEN"
```

## Remote TypeWhisper Host

The MCP server itself can run on any Node.js platform. TypeWhisper currently binds its API to the host's loopback interface, so connect remote clients through a private tunnel instead of exposing the API publicly.

For example, forward a local port from the agent machine to the TypeWhisper host:

```bash
ssh -N -L 18978:127.0.0.1:8978 user@typewhisper-host
```

Then start the MCP server with the forwarded URL and the bearer token from the TypeWhisper host's `api-discovery.json`:

```bash
TYPEWHISPER_API_BASE_URL=http://127.0.0.1:18978 \
TYPEWHISPER_API_TOKEN="your-token" \
typewhisper-mcp
```

For `typewhisper_transcribe_file`, the absolute path is resolved by the TypeWhisper host. Remote clients must therefore provide a path that exists on that host, for example through a shared or synchronized directory.

## Tools

- `typewhisper_status`
- `typewhisper_list_models`
- `typewhisper_transcribe_file`
- `typewhisper_search_history`
- `typewhisper_list_dictionary_terms`
- `typewhisper_upsert_dictionary_terms`
- `typewhisper_delete_dictionary_term`
- `typewhisper_list_dictionary_corrections`
- `typewhisper_upsert_dictionary_correction`
- `typewhisper_delete_dictionary_correction`

`typewhisper_transcribe_file` requires an absolute path on the TypeWhisper host because TypeWhisper runs as a separate app process.

Recorder and live dictation controls are intentionally not part of the first release.

## Development

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## License

GPL-3.0-only
