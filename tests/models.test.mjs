import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ollama-plugin-cc-home-"));
const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_USERPROFILE = process.env.USERPROFILE;

process.env.HOME = TEST_HOME;
process.env.USERPROFILE = TEST_HOME;

process.on("exit", () => {
  if (ORIGINAL_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = ORIGINAL_HOME;

  if (ORIGINAL_USERPROFILE === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = ORIGINAL_USERPROFILE;

  fs.rmSync(TEST_HOME, { recursive: true, force: true });
});

async function loadModelsModule() {
  return import(`../plugins/ollama/scripts/lib/ollama-models.mjs?ts=${Date.now()}-${Math.random()}`);
}

function withEnv(t, patch) {
  const original = new Map();
  for (const [key, value] of Object.entries(patch)) {
    original.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  t.after(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function resetGlobalConfig() {
  fs.rmSync(path.join(TEST_HOME, ".ollama-plugin-cc"), { recursive: true, force: true });
}

test("listCloudModels returns GLM models when ZHIPU_API_KEY is set", async (t) => {
  withEnv(t, {
    ZHIPU_API_KEY: "test-key",
    DASHSCOPE_API_KEY: undefined,
    MM_API_KEY: undefined,
  });

  const { listCloudModels } = await loadModelsModule();
  assert.deepEqual(await listCloudModels(), [
    { name: "glm-4", source: "cloud" },
    { name: "glm-3-turbo", source: "cloud" },
  ]);
});

test("listCloudModels returns empty when no env vars set", async (t) => {
  withEnv(t, {
    ZHIPU_API_KEY: undefined,
    DASHSCOPE_API_KEY: undefined,
    MM_API_KEY: undefined,
  });

  const { listCloudModels } = await loadModelsModule();
  assert.deepEqual(await listCloudModels(), []);
});

test("listLocalModels filters by SUPPORTED_MODELS", async () => {
  const client = {
    async listModels() {
      return {
        models: [
          { name: "mistral:latest", size: 3825819519 },
          { name: "deepseek-coder:latest", size: 776123456 },
          { name: "llama3:latest", size: 123 },
        ],
      };
    },
  };

  const { listLocalModels } = await loadModelsModule();
  const models = await listLocalModels(client);

  assert.deepEqual(
    models.map((model) => model.name),
    ["mistral:latest", "deepseek-coder:latest"],
  );
});

test("setActiveModel saves to global config", async (t) => {
  resetGlobalConfig();
  t.after(() => {
    resetGlobalConfig();
  });

  const { setActiveModel } = await loadModelsModule();

  setActiveModel("deepseek-coder:latest");

  const configPath = path.join(TEST_HOME, ".ollama-plugin-cc", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(config.activeModel, "deepseek-coder:latest");
  assert.equal(typeof config.lastSetupTime, "string");
});

test("getActiveModel returns null when no config", async (t) => {
  resetGlobalConfig();
  t.after(() => {
    resetGlobalConfig();
  });

  const { getActiveModel } = await loadModelsModule();
  assert.equal(getActiveModel(), null);
});

test("getOllamaEndpoint returns default when no env/config", async (t) => {
  resetGlobalConfig();
  t.after(() => {
    resetGlobalConfig();
  });
  withEnv(t, { OLLAMA_ENDPOINT: undefined });

  const { getOllamaEndpoint } = await loadModelsModule();
  assert.equal(getOllamaEndpoint(), "http://localhost:11434");
});

test("getOllamaEndpoint respects OLLAMA_ENDPOINT env var", async (t) => {
  resetGlobalConfig();
  t.after(() => {
    resetGlobalConfig();
  });
  withEnv(t, { OLLAMA_ENDPOINT: "http://localhost:11435" });

  const { getOllamaEndpoint } = await loadModelsModule();
  assert.equal(getOllamaEndpoint(), "http://localhost:11435");
});
