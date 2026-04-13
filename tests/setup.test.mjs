import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

import { OllamaClient } from "../plugins/ollama/scripts/lib/ollama-client.mjs";
import { startFakeOllama } from "./fake-ollama-fixture.mjs";

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

function resetGlobalConfig() {
  fs.rmSync(path.join(TEST_HOME, ".ollama-plugin-cc"), { recursive: true, force: true });
}

test("ping returns true when OLLAMA is running", async (t) => {
  const ollama = await startFakeOllama();
  t.after(async () => {
    await ollama.close();
  });

  const client = new OllamaClient(ollama.endpoint);
  assert.equal(await client.ping(), true);
});

test("ping returns false when OLLAMA is not running", async () => {
  const client = new OllamaClient("http://localhost:19999");
  assert.equal(await client.ping(), false);
});

test("listLocalModels returns filtered models", async (t) => {
  const ollama = await startFakeOllama();
  t.after(async () => {
    await ollama.close();
  });

  const client = new OllamaClient(ollama.endpoint);
  const { listLocalModels } = await loadModelsModule();
  const models = await listLocalModels(client);

  assert.deepEqual(
    models.map((model) => model.name),
    ["mistral:latest", "deepseek-coder:latest"],
  );
});

test("listLocalModels returns empty array on error", async () => {
  const client = {
    async listModels() {
      throw new Error("boom");
    },
  };

  const { listLocalModels } = await loadModelsModule();
  assert.deepEqual(await listLocalModels(client), []);
});

test("validateModel returns true for existing model", async (t) => {
  const ollama = await startFakeOllama();
  t.after(async () => {
    await ollama.close();
  });

  const client = new OllamaClient(ollama.endpoint);
  const { validateModel } = await loadModelsModule();
  assert.equal(await validateModel(client, "mistral:latest"), true);
});

test("validateModel returns false for missing model", async (t) => {
  const ollama = await startFakeOllama();
  t.after(async () => {
    await ollama.close();
  });

  const client = new OllamaClient(ollama.endpoint);
  const { validateModel } = await loadModelsModule();
  assert.equal(await validateModel(client, "missing:latest"), false);
});

test("setup flow: getActiveModel/setActiveModel persist to disk", async (t) => {
  resetGlobalConfig();
  t.after(() => {
    resetGlobalConfig();
  });

  const { getActiveModel, setActiveModel } = await loadModelsModule();

  assert.equal(getActiveModel(), null);

  setActiveModel("mistral:latest");
  assert.equal(getActiveModel(), "mistral:latest");

  const configPath = path.join(TEST_HOME, ".ollama-plugin-cc", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(config.activeModel, "mistral:latest");
  assert.equal(typeof config.lastSetupTime, "string");
});
