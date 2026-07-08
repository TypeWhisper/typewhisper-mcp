import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DiscoveryOptions {
  baseUrl?: string;
  port?: number;
  apiToken?: string | null;
  dev?: boolean;
  appSupportDirectory?: string;
  env?: NodeJS.ProcessEnv;
}

export interface TypeWhisperConnection {
  baseUrl: string;
  port?: number;
  apiToken?: string;
  discoveryFile?: string;
  portFile?: string;
  dev: boolean;
}

interface DiscoveryDocument {
  version?: number;
  port?: number;
  token?: string;
}

const DEFAULT_PORT = 8978;

export function discoverTypeWhisperAPI(options: DiscoveryOptions = {}): TypeWhisperConnection {
  const env = options.env ?? process.env;
  const dev = options.dev ?? parseBooleanEnv(env.TYPEWHISPER_DEV) ?? false;
  const appDirectory = typeWhisperAppSupportDirectory(dev, options.appSupportDirectory);
  const discoveryFile = join(appDirectory, "api-discovery.json");
  const portFile = join(appDirectory, "api-port");
  const discovery = readDiscoveryFile(discoveryFile);

  const explicitBaseUrl = options.baseUrl ?? cleanString(env.TYPEWHISPER_API_BASE_URL);
  const explicitPort = options.port ?? parsePort(env.TYPEWHISPER_API_PORT);
  const explicitToken = optionOrEnvToken(options.apiToken, env.TYPEWHISPER_API_TOKEN);

  if (explicitBaseUrl) {
    return {
      baseUrl: normalizeBaseUrl(explicitBaseUrl),
      port: portFromBaseUrl(explicitBaseUrl),
      apiToken: explicitToken ?? undefined,
      discoveryFile: existsSync(discoveryFile) ? discoveryFile : undefined,
      portFile: existsSync(portFile) ? portFile : undefined,
      dev
    };
  }

  const port = explicitPort ?? discovery?.port ?? readPortFile(portFile) ?? DEFAULT_PORT;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    apiToken: explicitToken ?? discovery?.apiToken,
    discoveryFile: discovery ? discoveryFile : undefined,
    portFile: existsSync(portFile) ? portFile : undefined,
    dev
  };
}

export function typeWhisperAppSupportDirectory(dev: boolean, baseDirectory?: string): string {
  const root = baseDirectory ?? join(homedir(), "Library", "Application Support");
  return join(root, dev ? "TypeWhisper-Dev" : "TypeWhisper");
}

function readDiscoveryFile(path: string): Pick<TypeWhisperConnection, "port" | "apiToken"> | undefined {
  try {
    const document = JSON.parse(readFileSync(path, "utf8")) as DiscoveryDocument;
    if (!document.port || document.port <= 0) {
      return undefined;
    }
    return {
      port: document.port,
      apiToken: cleanString(document.token)
    };
  } catch {
    return undefined;
  }
}

function readPortFile(path: string): number | undefined {
  try {
    return parsePort(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function optionOrEnvToken(option: string | null | undefined, envValue: string | undefined): string | undefined {
  if (option !== undefined) {
    return cleanString(option ?? undefined);
  }
  return cleanString(envValue);
}

function cleanString(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function parsePort(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 && value <= 65535 ? value : undefined;
  }

  const cleaned = cleanString(value);
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  switch (value?.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
      return true;
    case "0":
    case "false":
    case "no":
      return false;
    default:
      return undefined;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function portFromBaseUrl(baseUrl: string): number | undefined {
  try {
    const parsed = new URL(baseUrl);
    return parsePort(parsed.port);
  } catch {
    return undefined;
  }
}
