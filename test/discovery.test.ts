import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverTypeWhisperAPI, typeWhisperAppSupportDirectory } from "../src/discovery.js";

describe("discoverTypeWhisperAPI", () => {
  it("uses api-discovery.json before legacy api-port", () => {
    const root = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    const appDir = join(root, "TypeWhisper");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "api-port"), "9911");
    writeFileSync(join(appDir, "api-discovery.json"), JSON.stringify({
      version: 1,
      port: 9922,
      token: " token-from-discovery "
    }));

    const connection = discoverTypeWhisperAPI({
      appSupportDirectory: root,
      env: {}
    });

    expect(connection.baseUrl).toBe("http://127.0.0.1:9922");
    expect(connection.port).toBe(9922);
    expect(connection.apiToken).toBe("token-from-discovery");
    expect(connection.discoveryFile).toBe(join(appDir, "api-discovery.json"));
  });

  it("falls back to legacy api-port and default port", () => {
    const root = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    const appDir = join(root, "TypeWhisper");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "api-port"), "9911");

    expect(discoverTypeWhisperAPI({ appSupportDirectory: root, env: {} }).baseUrl)
      .toBe("http://127.0.0.1:9911");

    const emptyRoot = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    expect(discoverTypeWhisperAPI({ appSupportDirectory: emptyRoot, env: {} }).baseUrl)
      .toBe("http://127.0.0.1:8978");
  });

  it("uses TypeWhisper-Dev when dev mode is enabled", () => {
    const root = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    const appDir = join(root, "TypeWhisper-Dev");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "api-discovery.json"), JSON.stringify({ port: 9877 }));

    const connection = discoverTypeWhisperAPI({
      appSupportDirectory: root,
      dev: true,
      env: {}
    });

    expect(connection.dev).toBe(true);
    expect(connection.baseUrl).toBe("http://127.0.0.1:9877");
  });

  it("honors explicit base URL without reusing discovery token", () => {
    const root = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    const appDir = join(root, "TypeWhisper");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "api-discovery.json"), JSON.stringify({
      port: 9922,
      token: "local-token"
    }));

    const connection = discoverTypeWhisperAPI({
      baseUrl: "http://127.0.0.1:7777/",
      appSupportDirectory: root,
      env: {}
    });

    expect(connection.baseUrl).toBe("http://127.0.0.1:7777");
    expect(connection.apiToken).toBeUndefined();
  });

  it("uses explicit port with discovered token and env token override", () => {
    const root = mkdtempSync(join(tmpdir(), "typewhisper-mcp-"));
    const appDir = join(root, "TypeWhisper");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "api-discovery.json"), JSON.stringify({
      port: 9922,
      token: "local-token"
    }));

    expect(discoverTypeWhisperAPI({ port: 7777, appSupportDirectory: root, env: {} })).toMatchObject({
      baseUrl: "http://127.0.0.1:7777",
      apiToken: "local-token"
    });

    expect(discoverTypeWhisperAPI({
      port: 7777,
      appSupportDirectory: root,
      env: { TYPEWHISPER_API_TOKEN: "env-token" }
    })).toMatchObject({
      baseUrl: "http://127.0.0.1:7777",
      apiToken: "env-token"
    });
  });
});

describe("typeWhisperAppSupportDirectory", () => {
  it("returns stable production and dev directories", () => {
    expect(typeWhisperAppSupportDirectory(false, "/tmp/Application Support"))
      .toBe("/tmp/Application Support/TypeWhisper");
    expect(typeWhisperAppSupportDirectory(true, "/tmp/Application Support"))
      .toBe("/tmp/Application Support/TypeWhisper-Dev");
  });
});
