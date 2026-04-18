import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

let tmpDir;
let loadPrompt;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-loader-test-"));
  fs.writeFileSync(path.join(tmpDir, "sample.md"), "Hello {{NAME}}, target is {{TARGET}}.");
  fs.writeFileSync(path.join(tmpDir, "plain.md"), "No placeholders here.");
  const mod = await import(`../plugins/ollama/scripts/lib/prompt-loader.mjs?ts=${Date.now()}`);
  loadPrompt = mod.loadPrompt;
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadPrompt", () => {
  test("substitutes all placeholders", () => {
    const result = loadPrompt(tmpDir, "sample", { NAME: "Alice", TARGET: "main" });
    assert.strictEqual(result, "Hello Alice, target is main.");
  });

  test("handles prompt with no placeholders", () => {
    const result = loadPrompt(tmpDir, "plain", {});
    assert.strictEqual(result, "No placeholders here.");
  });

  test("leaves optional missing placeholder as empty string", () => {
    const result = loadPrompt(tmpDir, "sample", { NAME: "Bob" });
    assert.strictEqual(result, "Hello Bob, target is .");
  });

  test("throws PromptNotFoundError when file does not exist", () => {
    assert.throws(
      () => loadPrompt(tmpDir, "nonexistent", {}),
      (err) => err.name === "PromptNotFoundError"
    );
  });
});
