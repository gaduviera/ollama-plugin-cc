# OLLAMA Plugin for Claude Code
Seamlessly integrate OLLAMA as your local AI agent for code review, generation, debugging, and refactoring within Claude Code.
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/bb0a47d2-5b9c-483f-8d3a-82dbcfe9b244" />
## 📋 Features
- **Local-first**: Execute AI tasks entirely on your machine without relying on external cloud APIs (unless explicitly configured).
- **Multiple Models**: Supports a variety of large language models like GLM, qwen-coder, mistral, mini-max, and deepseek, both local and cloud-based.
- **Background Jobs**: Offload long-running AI tasks to the background, allowing you to continue working.
- **Smart Detection**: Automatically detects installed OLLAMA models and offers them for use.
- **Extensible Architecture**: Built on a proven plugin pattern for easy maintenance and future enhancements.

## 📦 Prerequisites
To use the OLLAMA Plugin for Claude Code, ensure you have:
- **Node.js**: Version 18.18.0 or higher.
- **OLLAMA**: Installed and running. You can download OLLAMA from [ollama.com](https://ollama.com/). Make sure the OLLAMA server is active by running `ollama serve` in your terminal.

## ⚙️ Installation

Install directly from Claude Code in two commands:

```bash
# 1. Add this marketplace (one-time setup)
/plugin marketplace add gaduviera/ollama-plugin-cc

# 2. Install the plugin
/plugin install ollama@ollama-plugin-cc
```

That's it — no cloning or local paths needed.

## 🚀 Quick Start
Get up and running with OLLAMA in Claude Code in three simple steps:

1.  **Install the Plugin**: Follow the installation steps above.
2.  **Configure OLLAMA**: Run `/ollama:setup` in Claude Code's chat interface. This will detect your OLLAMA installation and help you choose an active model.
3.  **Perform a Code Review**: Once setup, try `/ollama:review` on an open file to get AI-powered code suggestions.

## 📝 Commands Reference
Here is a comprehensive list of all available `/ollama` commands:

| Command             | Purpose                                                                 | Usage Example                                          |
| :------------------ | :---------------------------------------------------------------------- | :----------------------------------------------------- |
| `/ollama:setup`     | Detects your OLLAMA server, lists available models, and sets the active model for tasks. | `/ollama:setup --model mistral`                        |
| `/ollama:review`    | Initiates a code review of your current changes or selected files using the active OLLAMA model. Returns structured JSON output. | `/ollama:review --scope working-tree`                  |
| `/ollama:adversarial-review` | Performs an adversarial code review, identifying reasons NOT to ship the change using the active model. Returns structured JSON output. | `/ollama:adversarial-review --scope working-tree`      |
| `/ollama:task`      | Delegates a complex coding task (e.g., refactoring, debugging, feature implementation) to the active OLLAMA model. | `/ollama:task "Refactor the authentication module"`    |
| `/ollama:result`    | Retrieves and displays the output of a previously run OLLAMA task, identified by its job ID. | `/ollama:result job-abc123`                            |
| `/ollama:status`    | Shows the current OLLAMA server connection status, the active model, and details of recent jobs. | `/ollama:status` or `/ollama:status job-abc123`        |
| `/ollama:cancel`    | Cancels a running OLLAMA task, preventing further execution and resource consumption. | `/ollama:cancel job-abc123`                            |
| `/ollama:switch`    | Allows you to quickly change the active OLLAMA model without going through the full setup process. | `/ollama:switch deepseek-coder:7b`                     |
| `/ollama:list-models`| Displays a list of all OLLAMA models detected locally and those available via cloud credentials. | `/ollama:list-models`                                  |
| `/ollama:run-model` | Downloads a specified model from the Ollama hub directly to your local OLLAMA instance. | `/ollama:run-model llama3`                             |
| `/ollama:rescue`    | Provides diagnostic information about your OLLAMA setup, connection, and recent job issues, offering troubleshooting tips. | `/ollama:rescue`                                       |

## 🔍 Structured Review Output
Both `/ollama:review` and `/ollama:adversarial-review` commands return structured JSON output validated against a JSON Schema (draft-07). This ensures consistent, machine-readable results that are easy to parse and integrate into CI/CD pipelines.

### Output Format
```json
{
  "verdict": "APPROVED",
  "summary": "The changes are well-structured and follow best practices.",
  "findings": [
    {
      "severity": "info",
      "category": "performance",
      "message": "Consider caching repeated DOM queries for better performance."
    }
  ],
  "next_steps": [
    "Address any 'warning' severity findings before merging.",
    "Consider performance improvements for frequently called functions."
  ]
}
```

### Field Descriptions
- **verdict**: `APPROVED`, `CONDITIONAL`, or `REJECTED` — the overall recommendation for shipping the change.
- **summary**: A concise explanation of the review's outcome and main observations.
- **findings**: An array of issues or observations, each with a severity level (`info`, `warning`, `critical`) and category.
- **next_steps**: Actionable recommendations for addressing findings and improving the code before merge.

### Schema Validation & Auto-Repair
The plugin validates all review output against a JSON Schema (draft-07 using ajv ^8.17.1) with automatic repair on validation failure. If the initial output fails validation, the plugin performs one automatic reintry to correct the format before falling back to the user.

## 🎯 Models Supported
The OLLAMA Plugin supports a variety of popular models, leveraging both local OLLAMA installations and cloud APIs where applicable:

*   **GLM**: Available locally or via cloud (requires `ZHIPU_API_KEY`).
*   **qwen-coder**: Available locally or via cloud (requires `DASHSCOPE_API_KEY`).
*   **mistral**: Commonly available for local OLLAMA installation.
*   **mini-max**: Available locally or via cloud (requires `MM_API_KEY`).
*   **deepseek**: Popular for local OLLAMA installations, particularly `deepseek-coder`.

For cloud models, ensure you have set the respective environment variables with your API keys for them to be detected and used.

## ⚙️ Configuration
The plugin stores its configuration in `~/.ollama-plugin-cc/config.json`. This file contains:
- `activeModel`: The currently selected OLLAMA model (e.g., `"mistral:latest"`).
- `ollamaEndpoint`: The URL of your local OLLAMA server (defaults to `"http://localhost:11434"`).
- `lastSetupTime`: Timestamp of the last successful setup.

Example `config.json`:
```json
{
  "activeModel": "mistral:latest",
  "ollamaEndpoint": "http://localhost:11434",
  "lastSetupTime": "2026-04-13T10:30:00Z"
}
```

## 🔄 How Background Jobs Work
When you initiate a long-running task (like `/ollama:task` or a background `/ollama:review`), the plugin creates a "job". This follows a simple pattern:

1.  **Initiate Task**: Run `/ollama:task "..."` or `/ollama:review --background`. The plugin will return a `jobId`.
2.  **Check Status**: Use `/ollama:status [jobId]` to see if the job is still running or has completed.
3.  **View Result**: Once complete, use `/ollama:result [jobId]` to view the AI's output.
4.  **Cancel (if needed)**: If a job is taking too long or is no longer needed, use `/ollama:cancel [jobId]`.

## 🐛 Troubleshooting
Encountering issues? Here are common problems and their solutions:

-   **OLLAMA Server Not Running**:
    -   **Symptom**: Commands fail with connection errors or `/ollama:setup` indicates OLLAMA is not found.
    -   **Solution**: Open your terminal and run `ollama serve`.
    -   **Further help**: If OLLAMA is not installed, follow instructions on [ollama.com](https://ollama.com/) to install it.

-   **Model Not Found / Not Available**:
    -   **Symptom**: You try to use a model, but the plugin reports it as unavailable or unknown.
    -   **Solution**:
        -   Ensure the model is installed in your local OLLAMA instance. You can download models using `/ollama:run-model <model-name>` (e.g., `/ollama:run-model llama3`).
        -   Check `/ollama:list-models` to see all available models (local and cloud) and their requirements (e.g., API keys).

-   **Plugin Installation Issues**:
    -   **Symptom**: Claude Code doesn't recognize the plugin after installation.
    -   **Solution**: Double-check the absolute path used during installation. Ensure the `plugins/ollama` directory structure is correct.

-   **Timeout on Requests**:
    -   **Symptom**: OLLAMA tasks take a long time and eventually time out, especially with larger models or slower hardware.
    -   **Solution**: OLLAMA can be slow with large models. You might need to adjust timeout settings within the plugin's `scripts/ollama-companion.mjs` or `scripts/lib/ollama-client.mjs` if you are developing on the plugin.

-   **General Diagnostic**:
    -   Use the `/ollama:rescue` command for a comprehensive diagnostic report of your OLLAMA setup, which often provides actionable advice.

## 📖 Quick Reference & Debugging
-   **Debugging**: Set `OLLAMA_DEBUG=1` environment variable before running Claude Code to enable verbose logging for the plugin.
-   **Logs**: Check `~/.ollama-plugin-cc/logs/` for detailed plugin activity logs.
-   **Reset Configuration**: To reset the plugin's configuration, delete the `~/.ollama-plugin-cc/` directory and re-run `/ollama:setup`.

---
## 🤝 Design Inspiration
This plugin's architecture and design patterns are inspired by the proven **openai-codex-plugin-cc**, adapted to leverage OLLAMA's REST API. Key elements adopted include a robust job management system, state persistence, and a clear command structure.

## 📝 License
Apache-2.0

## 👤 Author
Gabriel Duarte Viera (@gaduviera)

---
**Last Updated:** 2026-04-18
