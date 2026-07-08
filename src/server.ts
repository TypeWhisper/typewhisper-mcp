import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  TypeWhisperClient,
  type DictionaryCorrection,
  type DictionaryTermEntry,
  type TranscribeFileOptions
} from "./client.js";
import { discoverTypeWhisperAPI, type DiscoveryOptions } from "./discovery.js";
import { errorResult, TypeWhisperError } from "./errors.js";
import { VERSION } from "./version.js";

export type TypeWhisperAPI = Pick<
  TypeWhisperClient,
  | "status"
  | "models"
  | "transcribeFile"
  | "searchHistory"
  | "listDictionaryTerms"
  | "upsertDictionaryTerms"
  | "deleteDictionaryTerm"
  | "listDictionaryCorrections"
  | "upsertDictionaryCorrection"
  | "deleteDictionaryCorrection"
>;

export interface CreateTypeWhisperMcpServerOptions {
  client?: TypeWhisperAPI;
  discovery?: DiscoveryOptions;
  fetch?: typeof fetch;
}

const transcribeFileSchema = z.object({
  path: z.string().min(1).describe("Absolute path to an audio or video file on this Mac."),
  language: z.string().min(1).optional().describe("Exact ISO 639-1 source language, for example de or en."),
  languageHints: z.array(z.string().min(1)).optional().describe("Ordered language hints. Do not combine with language."),
  task: z.enum(["transcribe", "translate"]).optional().describe("TypeWhisper task. Defaults to transcribe."),
  targetLanguage: z.string().min(1).optional().describe("Target language for Apple Translate output."),
  engine: z.string().min(1).optional().describe("Optional TypeWhisper engine/provider id override."),
  model: z.string().min(1).optional().describe("Optional model id override."),
  awaitDownload: z.boolean().optional().describe("Wait for model restore/download instead of failing fast."),
  applyCorrections: z.boolean().optional().describe("Apply TypeWhisper Dictionary Corrections. Defaults to true.")
});

const historySchema = z.object({
  query: z.string().min(1).optional().describe("Search query for transcription history."),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum number of entries. Defaults to 10."),
  offset: z.number().int().min(0).optional().describe("Pagination offset. Defaults to 0.")
});

const termEntrySchema = z.object({
  term: z.string().min(1),
  ctcMinSimilarity: z.number().min(0).max(1).optional()
});

const upsertTermsSchema = z.object({
  terms: z.array(z.string().min(1)).optional(),
  termEntries: z.array(termEntrySchema).optional(),
  replace: z.boolean().optional().describe("Replace the full term list instead of merging. Defaults to false.")
});

const deleteTermSchema = z.object({
  term: z.string().min(1)
});

const upsertCorrectionSchema = z.object({
  original: z.string().min(1),
  replacement: z.string(),
  caseSensitive: z.boolean().optional()
});

const deleteCorrectionSchema = z.object({
  original: z.string().min(1)
});

export function createTypeWhisperMcpServer(options: CreateTypeWhisperMcpServerOptions = {}): McpServer {
  const client = options.client ?? new TypeWhisperClient({
    connection: discoverTypeWhisperAPI(options.discovery),
    fetch: options.fetch
  });

  const server = new McpServer({
    name: "typewhisper-mcp",
    version: VERSION
  });

  server.registerTool(
    "typewhisper_status",
    {
      title: "TypeWhisper Status",
      description: "Check whether the local TypeWhisper API is reachable and has a model ready.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => wrapTool(async () => {
      const status = await client.status();
      return result(
        status.status === "ready"
          ? `TypeWhisper is ready using ${status.engine ?? "unknown engine"} / ${status.model ?? "unknown model"}.`
          : "TypeWhisper is reachable, but no transcription model is ready.",
        status
      );
    })
  );

  server.registerTool(
    "typewhisper_list_models",
    {
      title: "List TypeWhisper Models",
      description: "List available TypeWhisper transcription engines and models.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => wrapTool(async () => {
      const models = await client.models();
      return result(`TypeWhisper returned ${models.models.length} model(s).`, models);
    })
  );

  server.registerTool(
    "typewhisper_transcribe_file",
    {
      title: "Transcribe File with TypeWhisper",
      description: "Transcribe a local audio or video file through the running TypeWhisper app.",
      inputSchema: transcribeFileSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const request = normalizeTranscribeRequest(input);
      const transcript = await client.transcribeFile(request);
      return result(transcript.text || "TypeWhisper returned an empty transcription.", transcript);
    })
  );

  server.registerTool(
    "typewhisper_search_history",
    {
      title: "Search TypeWhisper History",
      description: "Search recent TypeWhisper transcription history.",
      inputSchema: historySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const response = await client.searchHistory({
        query: input.query,
        limit: input.limit ?? 10,
        offset: input.offset ?? 0
      });
      return result(`Found ${response.entries.length} history entr${response.entries.length === 1 ? "y" : "ies"} out of ${response.total}.`, response);
    })
  );

  server.registerTool(
    "typewhisper_list_dictionary_terms",
    {
      title: "List TypeWhisper Dictionary Terms",
      description: "List recognition terms configured in the TypeWhisper dictionary.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => wrapTool(async () => {
      const response = await client.listDictionaryTerms();
      return result(`TypeWhisper has ${response.count} dictionary term(s).`, response);
    })
  );

  server.registerTool(
    "typewhisper_upsert_dictionary_terms",
    {
      title: "Upsert TypeWhisper Dictionary Terms",
      description: "Merge or replace TypeWhisper recognition terms.",
      inputSchema: upsertTermsSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const response = await client.upsertDictionaryTerms(normalizeTermUpsert(input));
      return result(`TypeWhisper now has ${response.count} dictionary term(s).`, response);
    })
  );

  server.registerTool(
    "typewhisper_delete_dictionary_term",
    {
      title: "Delete TypeWhisper Dictionary Term",
      description: "Delete one recognition term from the TypeWhisper dictionary.",
      inputSchema: deleteTermSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const response = await client.deleteDictionaryTerm(input.term);
      return result(response.deleted ? `Deleted dictionary term "${input.term}".` : `Dictionary term "${input.term}" was not present.`, response);
    })
  );

  server.registerTool(
    "typewhisper_list_dictionary_corrections",
    {
      title: "List TypeWhisper Dictionary Corrections",
      description: "List post-transcription corrections configured in the TypeWhisper dictionary.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => wrapTool(async () => {
      const response = await client.listDictionaryCorrections();
      return result(`TypeWhisper has ${response.count} dictionary correction(s).`, response);
    })
  );

  server.registerTool(
    "typewhisper_upsert_dictionary_correction",
    {
      title: "Upsert TypeWhisper Dictionary Correction",
      description: "Add or update one post-transcription correction in the TypeWhisper dictionary.",
      inputSchema: upsertCorrectionSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const correction: DictionaryCorrection = {
        original: input.original,
        replacement: input.replacement,
        caseSensitive: input.caseSensitive ?? false
      };
      const response = await client.upsertDictionaryCorrection(correction);
      return result(`Upserted dictionary correction for "${input.original}".`, response);
    })
  );

  server.registerTool(
    "typewhisper_delete_dictionary_correction",
    {
      title: "Delete TypeWhisper Dictionary Correction",
      description: "Delete one post-transcription correction from the TypeWhisper dictionary.",
      inputSchema: deleteCorrectionSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (input) => wrapTool(async () => {
      const response = await client.deleteDictionaryCorrection(input.original);
      return result(response.deleted ? `Deleted dictionary correction for "${input.original}".` : `Dictionary correction for "${input.original}" was not present.`, response);
    })
  );

  return server;
}

function normalizeTranscribeRequest(input: z.infer<typeof transcribeFileSchema>): TranscribeFileOptions {
  if (!isAbsolute(input.path)) {
    throw new TypeWhisperError("typewhisper_transcribe_file requires an absolute file path.");
  }
  if (!existsSync(input.path)) {
    throw new TypeWhisperError(`File not found: ${input.path}`);
  }
  if (input.language && input.languageHints?.length) {
    throw new TypeWhisperError("Use either language or languageHints, not both.");
  }

  return {
    path: input.path,
    language: input.language,
    languageHints: input.languageHints,
    task: input.task,
    targetLanguage: input.targetLanguage,
    engine: input.engine,
    model: input.model,
    awaitDownload: input.awaitDownload ?? false,
    applyCorrections: input.applyCorrections ?? true
  };
}

function normalizeTermUpsert(input: z.infer<typeof upsertTermsSchema>): {
  terms?: string[];
  termEntries?: DictionaryTermEntry[];
  replace?: boolean;
} {
  const hasTerms = Boolean(input.terms?.length);
  const hasTermEntries = Boolean(input.termEntries?.length);

  if (hasTerms === hasTermEntries) {
    throw new TypeWhisperError("Provide exactly one of terms or termEntries.");
  }

  return {
    terms: input.terms,
    termEntries: input.termEntries?.map((entry) => ({
      term: entry.term,
      ctc_min_similarity: entry.ctcMinSimilarity
    })),
    replace: input.replace ?? false
  };
}

async function wrapTool(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    return errorResult(error);
  }
}

function result(summary: string, payload: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: {
      data: payload
    }
  };
}
