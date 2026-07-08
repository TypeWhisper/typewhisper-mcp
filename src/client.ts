import { TypeWhisperConnectionError, TypeWhisperHttpError } from "./errors.js";
import type { TypeWhisperConnection } from "./discovery.js";

export interface TypeWhisperStatus {
  status: "ready" | "no_model" | string;
  engine?: string | null;
  model?: string | null;
  supports_streaming: boolean;
  supports_translation: boolean;
}

export interface TypeWhisperModel {
  id: string;
  engine: string;
  name: string;
  size_description: string;
  language_count: number;
  status: string;
  selected: boolean;
  downloaded?: boolean | null;
  loaded?: boolean | null;
}

export interface TypeWhisperModelsResponse {
  models: TypeWhisperModel[];
}

export interface TranscribeFileOptions {
  path: string;
  language?: string;
  languageHints?: string[];
  task?: "transcribe" | "translate";
  targetLanguage?: string;
  engine?: string;
  model?: string;
  awaitDownload?: boolean;
  applyCorrections?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  language?: string | null;
  duration?: number;
  processing_time?: number;
  engine?: string;
  model?: string | null;
}

export interface HistorySearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface HistoryEntry {
  id: string;
  text: string;
  raw_text: string;
  timestamp: string;
  app_name?: string | null;
  app_bundle_id?: string | null;
  app_url?: string | null;
  duration: number;
  language?: string | null;
  engine: string;
  model?: string | null;
  words_count: number;
}

export interface HistoryResponse {
  entries: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface DictionaryTermEntry {
  term: string;
  ctc_min_similarity?: number | null;
}

export interface DictionaryTermsResponse {
  terms: string[];
  term_entries: DictionaryTermEntry[];
  count: number;
}

export interface UpsertDictionaryTermsOptions {
  terms?: string[];
  termEntries?: DictionaryTermEntry[];
  replace?: boolean;
}

export interface DeleteDictionaryTermResponse {
  deleted: boolean;
  count: number;
}

export interface DictionaryCorrection {
  original: string;
  replacement: string;
  caseSensitive: boolean;
}

export interface DictionaryCorrectionsResponse {
  corrections: DictionaryCorrection[];
  count: number;
}

export interface DeleteDictionaryCorrectionResponse {
  deleted: boolean;
  count: number;
}

type FetchLike = typeof fetch;

export interface TypeWhisperClientOptions {
  connection: TypeWhisperConnection;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export class TypeWhisperClient {
  private readonly connection: TypeWhisperConnection;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: TypeWhisperClientOptions) {
    this.connection = options.connection;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 300_000;
  }

  status(): Promise<TypeWhisperStatus> {
    return this.requestJson<TypeWhisperStatus>("GET", "/v1/status", { timeoutMs: 10_000 });
  }

  models(): Promise<TypeWhisperModelsResponse> {
    return this.requestJson<TypeWhisperModelsResponse>("GET", "/v1/models", { timeoutMs: 10_000 });
  }

  transcribeFile(options: TranscribeFileOptions): Promise<TranscriptionResponse> {
    const query = options.awaitDownload ? { await_download: "1" } : undefined;
    const body: Record<string, unknown> = {
      path: options.path
    };

    if (options.language) body.language = options.language;
    if (options.languageHints?.length) body.language_hints = options.languageHints;
    if (options.task) body.task = options.task;
    if (options.targetLanguage) body.target_language = options.targetLanguage;
    if (options.engine) body.engine = options.engine;
    if (options.model) body.model = options.model;
    if (options.applyCorrections === false) body.apply_corrections = false;

    return this.requestJson<TranscriptionResponse>("POST", "/v1/transcribe/local-file", { body, query });
  }

  searchHistory(options: HistorySearchOptions = {}): Promise<HistoryResponse> {
    const query: Record<string, string> = {};
    if (options.query) query.q = options.query;
    if (options.limit !== undefined) query.limit = String(options.limit);
    if (options.offset !== undefined) query.offset = String(options.offset);
    return this.requestJson<HistoryResponse>("GET", "/v1/history", { query, timeoutMs: 10_000 });
  }

  listDictionaryTerms(): Promise<DictionaryTermsResponse> {
    return this.requestJson<DictionaryTermsResponse>("GET", "/v1/dictionary/terms", { timeoutMs: 10_000 });
  }

  upsertDictionaryTerms(options: UpsertDictionaryTermsOptions): Promise<DictionaryTermsResponse> {
    const body: Record<string, unknown> = {
      replace: options.replace ?? false
    };
    if (options.terms) body.terms = options.terms;
    if (options.termEntries) body.term_entries = options.termEntries;
    return this.requestJson<DictionaryTermsResponse>("PUT", "/v1/dictionary/terms", { body, timeoutMs: 30_000 });
  }

  deleteDictionaryTerm(term: string): Promise<DeleteDictionaryTermResponse> {
    return this.requestJson<DeleteDictionaryTermResponse>("DELETE", "/v1/dictionary/terms", {
      body: { term },
      timeoutMs: 30_000
    });
  }

  listDictionaryCorrections(): Promise<DictionaryCorrectionsResponse> {
    return this.requestJson<DictionaryCorrectionsResponse>("GET", "/v1/dictionary/corrections", { timeoutMs: 10_000 });
  }

  upsertDictionaryCorrection(correction: DictionaryCorrection): Promise<DictionaryCorrectionsResponse> {
    return this.requestJson<DictionaryCorrectionsResponse>("PUT", "/v1/dictionary/corrections", {
      body: correction,
      timeoutMs: 30_000
    });
  }

  deleteDictionaryCorrection(original: string): Promise<DeleteDictionaryCorrectionResponse> {
    return this.requestJson<DeleteDictionaryCorrectionResponse>("DELETE", "/v1/dictionary/corrections", {
      body: { original },
      timeoutMs: 30_000
    });
  }

  private async requestJson<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string>;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);

    try {
      const url = this.url(path, options.query);
      const headers: Record<string, string> = {
        Accept: "application/json"
      };
      let body: string | undefined;

      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
      }

      if (this.connection.apiToken) {
        headers.Authorization = `Bearer ${this.connection.apiToken}`;
      }

      const response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });

      const text = await response.text();
      const parsed = text ? parseJson(text) : undefined;

      if (!response.ok) {
        const errorObject = isRecord(parsed) ? parsed.error : undefined;
        const message = isRecord(errorObject) && typeof errorObject.message === "string"
          ? errorObject.message
          : response.statusText || "Unknown error";
        const apiCode = isRecord(errorObject) && typeof errorObject.code === "string"
          ? errorObject.code
          : undefined;
        throw new TypeWhisperHttpError(response.status, message, apiCode);
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof TypeWhisperHttpError) {
        throw error;
      }
      throw new TypeWhisperConnectionError(undefined, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private url(path: string, query?: Record<string, string>): string {
    const url = new URL(path, `${this.connection.baseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeWhisperConnectionError("TypeWhisper returned invalid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
