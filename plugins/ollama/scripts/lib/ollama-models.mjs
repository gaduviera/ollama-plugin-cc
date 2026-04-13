import { loadGlobalConfig, saveGlobalConfig } from './state.mjs';

export const SUPPORTED_MODELS = ['glm', 'qwen', 'mini-max', 'minimax', 'mistral', 'deepseek'];

export async function listLocalModels(client) {
  try {
    const data = await client.listModels();
    const models = data.models ?? [];
    return models.filter(m => SUPPORTED_MODELS.some(s => m.name.toLowerCase().includes(s)));
  } catch { return []; }
}

export async function listCloudModels() {
  const cloud = [];
  if (process.env.ZHIPU_API_KEY) cloud.push({ name: 'glm-4', source: 'cloud' }, { name: 'glm-3-turbo', source: 'cloud' });
  if (process.env.DASHSCOPE_API_KEY) cloud.push({ name: 'qwen-coder-7b', source: 'cloud' });
  if (process.env.MM_API_KEY) cloud.push({ name: 'mini-max-text', source: 'cloud' });
  return cloud;
}

export async function validateModel(client, name) {
  try {
    await client.showModel(name);
    return true;
  } catch { return false; }
}

export function getActiveModel() {
  return loadGlobalConfig().activeModel ?? null;
}

export function setActiveModel(name) {
  const config = loadGlobalConfig();
  saveGlobalConfig({ ...config, activeModel: name, lastSetupTime: new Date().toISOString() });
}

export function getOllamaEndpoint() {
  return process.env.OLLAMA_ENDPOINT ?? loadGlobalConfig().ollamaEndpoint ?? 'http://localhost:11434';
}

export function getOllamaRuntimeStatus(env = process.env) {
  const endpoint = env?.OLLAMA_ENDPOINT ?? 'localhost:11434';
  return { label: `OLLAMA (${endpoint})` };
}
