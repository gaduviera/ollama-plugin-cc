export class OllamaClient {
  constructor(endpoint = 'http://localhost:11434', timeout = 30000) {
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  // Verificar si OLLAMA está running
  async ping() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Generar texto (code review, task, etc)
  async generate(modelName, prompt, options = {}) {
    const payload = {
      model: modelName,
      prompt,
      stream: false,
      ...options
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        response: data.response,
        totalDuration: data.total_duration
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async chat(modelName, messages, options = {}) {
    const payload = {
      model: modelName,
      messages,
      stream: false,
      ...options,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        content: data.message?.content ?? '',
        totalDuration: data.total_duration ?? 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Listar modelos disponibles
  async listModels() {
    const response = await fetch(`${this.endpoint}/api/tags`);
    if (!response.ok) throw new Error('Failed to list models');
    return response.json();
  }

  // Obtener detalles de modelo
  async showModel(modelName) {
    const response = await fetch(`${this.endpoint}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    if (!response.ok) throw new Error(`Model ${modelName} not found`);
    return response.json();
  }

  // Descargar modelo del hub
  async pullModel(modelName) {
    const response = await fetch(`${this.endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) throw new Error(`Failed to pull ${modelName}`);
    return response.json();
  }
}

export const ollamaClient = new OllamaClient(process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434');
