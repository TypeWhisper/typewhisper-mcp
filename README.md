# TypeWhisper MCP

`@typewhisper/mcp` exposes the local TypeWhisper API as a Model Context Protocol server for coding agents and other MCP clients.

It connects to the TypeWhisper macOS app running on the same machine and lets agents transcribe local files, inspect model status, search transcription history, and manage Dictionary terms and corrections.

## Requirements

- macOS with TypeWhisper installed
- TypeWhisper local API server enabled in `Settings > Advanced`
- Node.js 20 or newer

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
2. `~/Library/Application Support/TypeWhisper/api-discovery.json`
3. `~/Library/Application Support/TypeWhisper/api-port`
4. `http://127.0.0.1:8978`

Use `--dev` or `TYPEWHISPER_DEV=1` to read `TypeWhisper-Dev` discovery files.

```bash
typewhisper-mcp --dev
typewhisper-mcp --base-url http://127.0.0.1:8978 --api-token "$TYPEWHISPER_API_TOKEN"
```

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

`typewhisper_transcribe_file` requires an absolute file path because TypeWhisper runs as a separate macOS app process.

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
