import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createTypeWhisperMcpServer, type TypeWhisperAPI } from "../src/server.js";

function mockApi(): TypeWhisperAPI {
  return {
    async status() {
      return {
        status: "ready",
        engine: "mock",
        model: "tiny",
        supports_streaming: true,
        supports_translation: false
      };
    },
    async models() {
      return { models: [] };
    },
    async transcribeFile() {
      return { text: "Mock transcript", language: "en", engine: "mock", model: "tiny" };
    },
    async searchHistory() {
      return { entries: [], total: 0, limit: 10, offset: 0 };
    },
    async listDictionaryTerms() {
      return { terms: [], term_entries: [], count: 0 };
    },
    async upsertDictionaryTerms() {
      return { terms: ["TypeWhisper"], term_entries: [{ term: "TypeWhisper" }], count: 1 };
    },
    async deleteDictionaryTerm() {
      return { deleted: true, count: 0 };
    },
    async listDictionaryCorrections() {
      return { corrections: [], count: 0 };
    },
    async upsertDictionaryCorrection() {
      return { corrections: [{ original: "teh", replacement: "the", caseSensitive: false }], count: 1 };
    },
    async deleteDictionaryCorrection() {
      return { deleted: true, count: 0 };
    }
  };
}

describe("createTypeWhisperMcpServer", () => {
  it("lists tools and calls status through an MCP client", async () => {
    const server = createTypeWhisperMcpServer({ client: mockApi() });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "typewhisper_status",
      "typewhisper_list_models",
      "typewhisper_transcribe_file",
      "typewhisper_search_history",
      "typewhisper_list_dictionary_terms",
      "typewhisper_upsert_dictionary_terms",
      "typewhisper_delete_dictionary_term",
      "typewhisper_list_dictionary_corrections",
      "typewhisper_upsert_dictionary_correction",
      "typewhisper_delete_dictionary_correction"
    ]);

    const result = await client.callTool({ name: "typewhisper_status", arguments: {} });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      data: {
        status: "ready",
        engine: "mock",
        model: "tiny",
        supports_streaming: true,
        supports_translation: false
      }
    });

    await client.close();
    await server.close();
  });
});
