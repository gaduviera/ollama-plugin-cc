import fs from "node:fs";
import path from "node:path";

export class PromptNotFoundError extends Error {
  constructor(name, promptsDir) {
    super(`Prompt "${name}" not found in ${promptsDir}`);
    this.name = "PromptNotFoundError";
  }
}

/**
 * @param {string} promptsDir - absolute path to the prompts directory
 * @param {string} name - prompt file name without extension
 * @param {Record<string, string>} vars - placeholder values; missing keys → empty string
 * @returns {string} the prompt with all {{KEY}} placeholders replaced
 */
export function loadPrompt(promptsDir, name, vars = {}) {
  const filePath = path.join(promptsDir, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new PromptNotFoundError(name, promptsDir);
  }
  const template = fs.readFileSync(filePath, "utf8");
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => vars[key] ?? "");
}
