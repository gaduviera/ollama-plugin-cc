import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { after, before, describe, test } from "node:test";

import { startFakeOllama } from "./fake-ollama-fixture.mjs";

let ollamaFixture;

const FIXTURE_PORT = 11436;

before(async () => {
  ollamaFixture = await startFakeOllama(FIXTURE_PORT);
});

after(async () => {
  if (ollamaFixture) {
    await ollamaFixture.close();
    ollamaFixture = null;
  }
});

function createTestEnv() {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ollama-plugin-cc-companion-"),
  );
  const homeDir = path.join(tempRoot, "home");
  const pluginDataDir = path.join(tempRoot, "plugin-data");
  const workspaceDir = path.join(tempRoot, "workspace");

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(pluginDataDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });

  return {
    tempRoot,
    homeDir,
    pluginDataDir,
    workspaceDir,
  };
}

async function loadStateHelpers() {
  return import(
    `../plugins/ollama/scripts/lib/state.mjs?ts=${Date.now()}-${Math.random()}`
  );
}

async function loadModelHelpers() {
  return import(
    `../plugins/ollama/scripts/lib/ollama-models.mjs?ts=${Date.now()}-${Math.random()}`
  );
}

async function loadCompanion() {
  return import(
    `../plugins/ollama/scripts/ollama-companion.mjs?ts=${Date.now()}-${Math.random()}`
  );
}

async function runHandler(handler, args) {
  const originalLog = console.log;
  const originalWrite = process.stdout.write.bind(process.stdout);

  console.log = () => {};
  process.stdout.write = ((chunk, encoding, callback) => {
    if (typeof callback === "function") {
      callback();
    }
    return true;
  });

  try {
    return await handler(args);
  } finally {
    console.log = originalLog;
    process.stdout.write = originalWrite;
  }
}

async function withTestEnv(callback) {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const originalPluginData = process.env.CLAUDE_PLUGIN_DATA;
  const originalEndpoint = process.env.OLLAMA_ENDPOINT;
  const dirs = createTestEnv();

  process.env.HOME = dirs.homeDir;
  process.env.USERPROFILE = dirs.homeDir;
  process.env.CLAUDE_PLUGIN_DATA = dirs.pluginDataDir;
  process.env.OLLAMA_ENDPOINT = "http://localhost:11436";

  try {
    await callback({
      ...dirs,
      env: {
        HOME: dirs.homeDir,
        USERPROFILE: dirs.homeDir,
        CLAUDE_PLUGIN_DATA: dirs.pluginDataDir,
        OLLAMA_ENDPOINT: "http://localhost:11436",
      },
    });
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;

    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;

    if (originalPluginData === undefined) delete process.env.CLAUDE_PLUGIN_DATA;
    else process.env.CLAUDE_PLUGIN_DATA = originalPluginData;

    if (originalEndpoint === undefined) delete process.env.OLLAMA_ENDPOINT;
    else process.env.OLLAMA_ENDPOINT = originalEndpoint;

    fs.rmSync(dirs.tempRoot, { recursive: true, force: true });
  }
}

describe("ollama companion handlers", { concurrency: false }, () => {
  test("rescue reports ollamaRunning true when Ollama is up", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleRescue } = await loadCompanion();
      const payload = await runHandler(handleRescue, ["--cwd", workspaceDir, "--json"]);

      assert.equal(payload.ollamaRunning, true);
    });
  });

  test("rescue reports ollamaRunning false when Ollama is down", async () => {
    await ollamaFixture.close();
    ollamaFixture = null;

    try {
      await withTestEnv(async ({ workspaceDir }) => {
        const { handleRescue } = await loadCompanion();
        const payload = await runHandler(handleRescue, ["--cwd", workspaceDir, "--json"]);

        assert.equal(payload.ollamaRunning, false);
      });
    } finally {
      ollamaFixture = await startFakeOllama(FIXTURE_PORT);
    }
  });

  test("list-models returns localModels from the fixture", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleListModels } = await loadCompanion();
      const payload = await runHandler(handleListModels, ["--cwd", workspaceDir, "--json"]);

      assert.deepEqual(
        payload.localModels.map((model) => model.name),
        ["mistral:latest", "deepseek-coder:latest"],
      );
    });
  });

  test("switch succeeds when the model exists", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleSwitch } = await loadCompanion();
      const { getActiveModel } = await loadModelHelpers();
      const payload = await runHandler(
        handleSwitch,
        ["mistral:latest", "--cwd", workspaceDir, "--json"],
      );

      assert.equal(payload.success, true);
      assert.equal(payload.activeModel, "mistral:latest");
      assert.equal(getActiveModel(), "mistral:latest");
    });
  });

  test("switch returns a JSON error when the model does not exist", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleSwitch } = await loadCompanion();
      await assert.rejects(
        () => handleSwitch(["missing:latest", "--cwd", workspaceDir, "--json"]),
        /Model not found in Ollama: missing:latest/,
      );
    });
  });

  test("switch returns a JSON error when the model name is missing", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleSwitch } = await loadCompanion();
      const payload = await runHandler(handleSwitch, ["--cwd", workspaceDir, "--json"]);

      assert.deepEqual(payload, {
        success: false,
        error: "Model name is required. Usage: /ollama:switch <model-name>",
      });
    });
  });

  test("run-model returns a JSON error when the model name is missing", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { handleRunModel } = await loadCompanion();
      const payload = await runHandler(handleRunModel, ["--cwd", workspaceDir, "--json"]);

      assert.deepEqual(payload, {
        success: false,
        error: "Model name is required. Usage: /ollama:run-model <model-name>",
      });
    });
  });

  test("status returns running jobs array and activeModel", async () => {
    await withTestEnv(async ({ workspaceDir }) => {
      const { upsertJob, writeJobFile } = await loadStateHelpers();
      const { setActiveModel } = await loadModelHelpers();
      const { handleStatus } = await loadCompanion();

      setActiveModel("mistral:latest");

      const job = {
        id: "task-test-running",
        kind: "task",
        kindLabel: "task",
        title: "Ollama Task",
        summary: "Generate something",
        prompt: "Generate something",
        model: "mistral:latest",
        status: "running",
        phase: "running",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      writeJobFile(workspaceDir, job.id, job);
      upsertJob(workspaceDir, job);

      const payload = await runHandler(handleStatus, ["--cwd", workspaceDir, "--json"]);

      assert.equal(payload.activeModel, "mistral:latest");
      assert.equal(Array.isArray(payload.running), true);
      assert.equal(Array.isArray(payload.jobs), true);
      assert.equal(payload.running.length, 1);
      assert.equal(payload.jobs.length, 1);
      assert.equal(payload.running[0].id, "task-test-running");
      assert.equal(payload.running[0].model, "mistral:latest");
    });
  });
});
