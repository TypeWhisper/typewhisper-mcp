import { describe, expect, it } from "vitest";
import { TypeWhisperClient } from "../src/client.js";
import { TypeWhisperHttpError } from "../src/errors.js";

interface RecordedRequest {
  url: string;
  init: RequestInit;
}

function makeClient(responseBody: unknown, recorder: RecordedRequest[], status = 200): TypeWhisperClient {
  const fetchImpl: typeof fetch = async (input, init) => {
    recorder.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), {
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: { "Content-Type": "application/json" }
    });
  };

  return new TypeWhisperClient({
    connection: {
      baseUrl: "http://127.0.0.1:9876",
      port: 9876,
      apiToken: "test-token",
      dev: false
    },
    fetch: fetchImpl
  });
}

describe("TypeWhisperClient", () => {
  it("sends authorization and reads models", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({ models: [] }, calls);

    await expect(client.models()).resolves.toEqual({ models: [] });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/models");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: "Bearer test-token"
    });
  });

  it("transcribes local files through the local-file endpoint", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({
      text: "Hallo Welt",
      language: "de",
      duration: 1.2,
      processing_time: 0.4,
      engine: "mock",
      model: "tiny"
    }, calls);

    await client.transcribeFile({
      path: "/tmp/audio.wav",
      languageHints: ["de", "en"],
      task: "transcribe",
      targetLanguage: "en",
      engine: "mock",
      model: "tiny",
      awaitDownload: true,
      applyCorrections: false
    });

    expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/transcribe/local-file?await_download=1");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      path: "/tmp/audio.wav",
      language_hints: ["de", "en"],
      task: "transcribe",
      target_language: "en",
      engine: "mock",
      model: "tiny",
      apply_corrections: false
    });
  });

  it("searches history with bounded query parameters", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({ entries: [], total: 0, limit: 10, offset: 5 }, calls);

    await client.searchHistory({ query: "meeting", limit: 10, offset: 5 });

    expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/history?q=meeting&limit=10&offset=5");
    expect(calls[0]?.init.method).toBe("GET");
  });

  it("maps dictionary term bodies to the TypeWhisper API shape", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({ terms: [], term_entries: [], count: 0 }, calls);

    await client.upsertDictionaryTerms({
      termEntries: [{ term: "TypeWhisper", ctc_min_similarity: 0.8 }],
      replace: true
    });

    expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/dictionary/terms");
    expect(calls[0]?.init.method).toBe("PUT");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      replace: true,
      term_entries: [{ term: "TypeWhisper", ctc_min_similarity: 0.8 }]
    });
  });

  it("maps dictionary correction bodies", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({ corrections: [], count: 0 }, calls);

    await client.upsertDictionaryCorrection({
      original: "teh",
      replacement: "the",
      caseSensitive: false
    });

    expect(calls[0]?.url).toBe("http://127.0.0.1:9876/v1/dictionary/corrections");
    expect(calls[0]?.init.method).toBe("PUT");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      original: "teh",
      replacement: "the",
      caseSensitive: false
    });
  });

  it("throws structured HTTP errors", async () => {
    const calls: RecordedRequest[] = [];
    const client = makeClient({
      error: {
        code: "unauthorized",
        message: "Missing or invalid API token"
      }
    }, calls, 401);

    await expect(client.models()).rejects.toMatchObject<TypeWhisperHttpError>({
      status: 401,
      apiCode: "unauthorized",
      message: "Missing or invalid API token"
    });
  });
});
