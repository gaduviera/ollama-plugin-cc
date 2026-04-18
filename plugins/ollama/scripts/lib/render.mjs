import fs from 'node:fs';

import { getConfig, readJobFile, resolveJobFile, loadGlobalConfig } from './state.mjs';

function renderText(message) {
  console.log(message);
}

export function renderSetupReport(report) {
  const { ollamaRunning, localModels, cloudModels, activeModel } = report;
  if (!ollamaRunning) {
    renderText(`Ollama is not running.`);
    return;
  }
  renderText(`Ollama is running.`);

  const allModels = [...(localModels || []), ...(cloudModels || [])];
  if (allModels.length === 0) {
    renderText(`No models found.`);
  } else {
    renderText(`Available models: ${allModels.map(m => m.name).join(', ')}`);
  }

  if (activeModel) {
    renderText(`Active model: ${activeModel}`);
  } else {
    renderText(`No active model. Use 'ollama set <model>' to set one.`);
  }
}

export function renderStatusReport(report) {
  const { ollamaRunning, activeModel, jobs } = report;
  if (!ollamaRunning) {
    renderText(`Ollama is not running.`);
    return;
  }
  renderText(`Ollama is running.`);
  if (activeModel) {
    renderText(`Active model: ${activeModel}`);
  } else {
    renderText(`No active model. Use 'ollama set <model>' to set one.`);
  }
  if (jobs && jobs.length > 0) {
    renderText(`Jobs:`);
    for (const job of jobs) {
      renderJobStatusReport(job);
    }
  } else {
    renderText(`No jobs found. Use 'ollama generate <prompt>' to generate one.`);
  }
}

export function renderJobStatusReport(job) {
  const { id, prompt, status, model, createdAt } = job;
  renderText(`  Job ${id} (${model}): ${prompt} (${status}) (${new Date(createdAt).toLocaleString()})`);
}

export function renderStoredJobResult(job, storedJob) {
  const { id, model, prompt, resultFile } = job;
  renderText(`Job ${id} (${model}): ${prompt}`);
  renderText(`Result:`);
  renderText(storedJob);
}

export function renderCancelReport(job) {
  const { id, prompt, status } = job;
  renderText(`Job ${id} (${prompt}) is ${status}.`);
}

export function renderSwitchReport(activeModel) {
  renderText(`Switched to model: ${activeModel}`);
}

export function renderListModelsReport(localModels, cloudModels) {
  const allModels = [...(localModels || []), ...(cloudModels || [])];
  if (allModels.length === 0) {
    renderText(`No models found.`);
  } else {
    renderText(`Available models: ${allModels.map(m => m.name).join(', ')}`);
  }
  const { activeModel } = loadGlobalConfig();
  if (activeModel) {
    renderText(`Active model: ${activeModel}`);
  }
}

export function renderRescueReport(report) {
  const { id, prompt, status, resultFile, error } = report;
  renderText(`Job ${id} (${prompt}) failed with error:`);
  renderText(error);
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];
const SEVERITY_ICON = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵" };

export function renderReviewFindings(reviewOutput, mode = "review") {
  const { verdict, summary, findings, next_steps } = reviewOutput;

  const modeLabel = mode === "adversarial" ? "Adversarial Review" : "Code Review";
  const verdictLabel = verdict === "approve" ? "✅ APPROVE" : "⚠️  NEEDS ATTENTION";

  renderText(`\n## ${modeLabel} — ${verdictLabel}\n`);
  renderText(`**Summary:** ${summary}\n`);

  if (findings.length === 0) {
    renderText("No findings.");
  } else {
    const sorted = [...findings].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    );

    for (const f of sorted) {
      const icon = SEVERITY_ICON[f.severity] ?? "⚪";
      renderText(`${icon} **[${f.severity.toUpperCase()}]** ${f.title}`);
      renderText(`   File: ${f.file}:${f.line_start}-${f.line_end} (confidence: ${(f.confidence * 100).toFixed(0)}%)`);
      renderText(`   ${f.body}`);
      renderText(`   → ${f.recommendation}\n`);
    }
  }

  if (next_steps.length > 0) {
    renderText("**Next steps:**");
    for (const step of next_steps) {
      renderText(`  - ${step}`);
    }
  }

  renderText(
    "\n---\n⛔ STOP. Do not apply any of the above changes automatically.\n" +
    "Tell the user which findings were found and ask which ones, if any, they want fixed.\n"
  );
}
