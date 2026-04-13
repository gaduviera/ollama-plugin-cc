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
