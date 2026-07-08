export { TypeWhisperClient } from "./client.js";
export type {
  DeleteDictionaryCorrectionResponse,
  DeleteDictionaryTermResponse,
  DictionaryCorrection,
  DictionaryCorrectionsResponse,
  DictionaryTermEntry,
  DictionaryTermsResponse,
  HistoryEntry,
  HistoryResponse,
  HistorySearchOptions,
  TranscribeFileOptions,
  TranscriptionResponse,
  TypeWhisperClientOptions,
  TypeWhisperModel,
  TypeWhisperModelsResponse,
  TypeWhisperStatus,
  UpsertDictionaryTermsOptions
} from "./client.js";
export { discoverTypeWhisperAPI, typeWhisperAppSupportDirectory } from "./discovery.js";
export type { DiscoveryOptions, TypeWhisperConnection } from "./discovery.js";
export { createTypeWhisperMcpServer } from "./server.js";
export type { CreateTypeWhisperMcpServerOptions, TypeWhisperAPI } from "./server.js";
export {
  TypeWhisperConnectionError,
  TypeWhisperError,
  TypeWhisperHttpError
} from "./errors.js";
