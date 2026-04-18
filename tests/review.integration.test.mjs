import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { after, before, describe, test } from "node:test";
import { startFakeOllama } from "./fake-ollama-fixture.mjs";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const originalSpawnSync = childProcess.spawnSync;
const FIXTURE_PORT = 11438;

let ollamaFixture;
let tempRoot;
let homeDir;
let workspaceDir;

function installFakeGit(workspaceRoot) {
  childProcess.spawnSync = (command, args = [], options = {}) => {
    if (command !== "git") {
      return originalSpawnSync(command, args, options);
    }

    const normalizedArgs = args.join(" ");
    const ok = (stdout = "", stderr = "") => ({
      pid: 0,
      output: [null, stdout, stderr],
      stdout,
      stderr,
      status: 0,
      signal: null,
      error: null,
    });

    const fail = (stderr, status = 1) => ({
      pid: 0,
      output: [null, "", stderr],
      stdout: "",
      stderr,
      status,
      signal: null,
      error: null,
    });

    if (normalizedArgs === "rev-parse --show-toplevel") {
      return ok(`${workspaceRoot}\n`);
    }
    if (normalizedArgs === "branch --show-current") {
      return ok("main\n");
    }
    if (normalizedArgs === "diff --cached --name-only") {
      return ok("");
    }
    if (normalizedArgs === "diff --name-only") {
      return ok("foo.js\n");
    }
    if (normalizedArgs === "ls-files --others --exclude-standard") {
      return ok("");
    }
    if (normalizedArgs === "status --short --untracked-files=all") {
      return ok(" M foo.js\n");
    }
    if (normalizedArgs === "diff --cached --binary --no-ext-diff --submodule=diff") {
      return ok("");
    }
    if (normalizedArgs === "diff --binary --no-ext-diff --submodule=diff") {
      return ok(
        [
          "diff --git a/foo.js b/foo.js",
          "index 1c2a3b4..5d6e7f8 100644",
          "--- a/foo.js",
          "+++ b/foo.js",
          "@@ -1 +1 @@",
          "-export const x = 1;",
          "+export const x = 2;",
          "",
        ].join("\n"),
      );
    }

    return fail(`unsupported fake git command: git ${normalizedArgs}`);
  };

  syncBuiltinESMExports();
}

function restoreSpawnSync() {
  childProcess.spawnSync = originalSpawnSync;
  syncBuiltinESMExports();
}

function writeGlobalConfig() {
  const configDir = path.join(homeDir, ".ollama-plugin-cc");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify({
      activeModel: "mistral:latest",
      ollamaEndpoint: `http://localhost:${FIXTURE_PORT}`,
    }),
  );
}

async function loadCompanion() {
  return import(
    `../plugins/ollama/scripts/ollama-companion.mjs?ts=${Date.now()}-${Math.random()}`
  );
}

async function captureOutput(fn) {
  const originalLog = console.log;
  const originalWrite = process.stdout.write.bind(process.stdout);
  let stdout = "";

  console.log = (...args) => {
    stdout += `${args.join(" ")}\n`;
  };
  process.stdout.write = ((chunk, encoding, callback) => {
    stdout += String(chunk);
    if (typeof callback === "function") callback();
    return true;
  });

  try {
    await fn();
    return { stdout };
  } finally {
    console.log = originalLog;
    process.stdout.write = originalWrite;
  }
}

async function runCompanion(command, extraArgs = []) {
  const { handleReview, handleAdversarialReview } = await loadCompanion();
  const args = ["--cwd", workspaceDir, "--json", ...extraArgs];

  if (command === "review") {
    return captureOutput(() => handleReview(args));
  }
  if (command === "adversarial-review") {
    return captureOutput(() => handleAdversarialReview(args));
  }

  throw new Error(`Unsupported command: ${command}`);
}

before(async () => {
  ollamaFixture = await startFakeOllama(FIXTURE_PORT);

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ollama-review-integration-"));
  homeDir = path.join(tempRoot, "home");
  workspaceDir = path.join(tempRoot, "workspace");
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, "foo.js"), "export const x = 2;\n");

  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  process.env.OLLAMA_ENDPOINT = `http://localhost:${FIXTURE_PORT}`;

  writeGlobalConfig();
  installFakeGit(workspaceDir);
});

after(async () => {
  restoreSpawnSync();
  if (ollamaFixture) await ollamaFixture.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("review integration", () => {
  test("review command returns structured output", async () => {
    const { stdout } = await runCompanion("review", ["--scope", "working-tree"]);
    const jsonMatch = stdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    assert.ok(jsonMatch, "No JSON found in stdout");
    const parsed = JSON.parse(jsonMatch[0]);
    assert.ok(["approve", "needs-attention"].includes(parsed.verdict));
    assert.ok(typeof parsed.summary === "string");
    assert.ok(Array.isArray(parsed.findings));
    assert.ok(Array.isArray(parsed.next_steps));
  });

  test("adversarial-review command returns structured output", async () => {
    const { stdout } = await runCompanion("adversarial-review", ["--target", "working-tree"]);
    const jsonMatch = stdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    assert.ok(jsonMatch, "No JSON found in stdout");
    const parsed = JSON.parse(jsonMatch[0]);
    assert.ok(["approve", "needs-attention"].includes(parsed.verdict));
  });

  test("review output contains stop-gate message", async () => {
    const { stdout } = await runCompanion("review", ["--scope", "working-tree"]);
    assert.ok(
      stdout.includes("STOP") || stdout.includes("stop"),
      "Stop-gate message not found in output",
    );
  });
});
