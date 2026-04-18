#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import { readStdinIfPiped } from "./lib/fs.mjs";
import {
  collectReviewContext,
  ensureGitRepository,
  resolveReviewTarget,
} from "./lib/git.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
} from "./lib/job-control.mjs";
import { OllamaClient } from "./lib/ollama-client.mjs";
import { loadPrompt, PromptNotFoundError } from "./lib/prompt-loader.mjs";
import {
  buildRepairPrompt,
  parseReviewOutput,
  SchemaValidationError,
} from "./lib/schema-validator.mjs";
import {
  getActiveModel,
  getOllamaEndpoint,
  listCloudModels,
  listLocalModels,
  setActiveModel,
  validateModel,
} from "./lib/ollama-models.mjs";
import { terminateProcessTree } from "./lib/process.mjs";
import {
  renderCancelReport,
  renderJobStatusReport,
  renderListModelsReport,
  renderRescueReport,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderSwitchReport,
} from "./lib/render.mjs";
import {
  generateJobId,
  listJobs,
  loadGlobalConfig,
  upsertJob,
  writeJobFile,
} from "./lib/state.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob,
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PROMPTS_DIR = path.join(ROOT_DIR, "prompts");
const SCHEMA_PATH = path.join(ROOT_DIR, "schemas", "review-output.schema.json");
const SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "ollama-companion.mjs");
const DEFAULT_WAIT_TIMEOUT_MS = 240000;
const DEFAULT_POLL_INTERVAL_MS = 2000;

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/ollama-companion.mjs setup [--model <name>] [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs review [--scope <auto|working-tree|branch>] [--base <ref>] [--background] [--wait] [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs task [--background] [--write] [--cwd <path>] [--json] [prompt]",
      "  node scripts/ollama-companion.mjs task-worker --cwd <path> --job-id <id>",
      "  node scripts/ollama-companion.mjs status [job-id] [--all] [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs result <job-id> [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs cancel <job-id> [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs switch <model-name> [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs list-models [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs run-model <model-name> [--cwd <path>] [--json]",
      "  node scripts/ollama-companion.mjs rescue [--cwd <path>] [--json]",
    ].join("\n"),
  );
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    if (!raw?.trim()) {
      return [];
    }
    return splitRawArgumentString(raw);
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {}),
    },
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function resolveCommandWorkspace(options = {}) {
  return resolveWorkspaceRoot(resolveCommandCwd(options));
}

function createClient() {
  return new OllamaClient(getOllamaEndpoint());
}

function writeJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function outputWithRenderer(payload, asJson, renderer) {
  if (asJson) {
    writeJson(payload);
    return payload;
  }
  renderer(payload);
  return payload;
}

function outputTextOrJson(payload, rendered, asJson) {
  if (asJson) {
    writeJson(payload);
    return payload;
  }
  process.stdout.write(rendered);
  return payload;
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isActiveStatus(status) {
  return status === "queued" || status === "running";
}

function toRenderableJob(job, storedJob = null) {
  const request = storedJob?.request ?? {};
  return {
    ...job,
    model: job.model ?? request.model ?? request.modelName ?? null,
    prompt:
      job.prompt ??
      request.prompt ??
      request.reviewContent ??
      request.modelName ??
      job.summary ??
      job.title ??
      "job",
  };
}

function buildStatusPayload(snapshot, extras) {
  const jobs = [
    ...(snapshot.running ?? []),
    ...(snapshot.latestFinished ? [snapshot.latestFinished] : []),
    ...(snapshot.recent ?? []),
  ];

  return {
    ...snapshot,
    ...extras,
    jobs: jobs.map((job) => toRenderableJob(job)),
  };
}

function createCompanionJob({
  prefix,
  kind,
  title,
  workspaceRoot,
  jobClass,
  summary,
  model = null,
  prompt = null,
  write = false,
}) {
  return createJobRecord({
    id: generateJobId(prefix),
    kind,
    kindLabel: kind,
    title,
    workspaceRoot,
    jobClass,
    summary,
    model,
    prompt,
    write,
  });
}

function createTrackedProgress(job, options = {}) {
  const logFile =
    options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  return {
    logFile,
    progress: createProgressReporter({
      stderr: Boolean(options.stderr),
      logFile,
      onEvent: createJobProgressUpdater(job.workspaceRoot, job.id),
    }),
  };
}

async function runForegroundCommand(job, runner, options = {}) {
  const { logFile, progress } = createTrackedProgress(job, {
    logFile: options.logFile,
    stderr: !options.json,
  });
  const execution = await runTrackedJob(job, () => runner(progress), { logFile });
  outputTextOrJson(execution.payload, execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
  return execution;
}

function spawnDetachedTaskWorker(cwd, jobId) {
  const child = spawn(
    process.execPath,
    [SCRIPT_PATH, "task-worker", "--cwd", cwd, "--job-id", jobId],
    {
      cwd,
      env: process.env,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.unref();
  return child;
}

function enqueueBackgroundTask(cwd, job, request) {
  const { logFile } = createTrackedProgress(job);
  appendLogLine(logFile, "Queued for background execution.");

  const child = spawnDetachedTaskWorker(cwd, job.id);
  const queuedRecord = {
    ...job,
    status: "queued",
    phase: "queued",
    pid: child.pid ?? null,
    logFile,
    request,
  };

  writeJobFile(job.workspaceRoot, job.id, queuedRecord);
  upsertJob(job.workspaceRoot, queuedRecord);

  return {
    jobId: job.id,
    status: "queued",
    title: job.title,
    summary: job.summary,
    logFile,
  };
}

async function ensureActiveModel() {
  const activeModel = getActiveModel();
  if (!activeModel) {
    throw new Error("No active Ollama model configured. Run setup or switch first.");
  }
  return activeModel;
}

async function buildModelsPayload(client) {
  const ollamaRunning = await client.ping();
  const localModels = ollamaRunning ? await listLocalModels(client) : [];
  const cloudModels = ollamaRunning ? await listCloudModels() : [];

  return {
    ollamaRunning,
    localModels,
    cloudModels,
    activeModel: getActiveModel(),
  };
}

async function executeGenerateRequest(request) {
  const client = createClient();
  const response = await client.generate(request.model, request.prompt);
  const text = String(response.response ?? "").trim();
  return {
    exitStatus: 0,
    payload: {
      model: request.model,
      prompt: request.prompt,
      response: text,
      totalDuration: response.totalDuration ?? null,
    },
    rendered: text ? `${text}\n` : "No response.\n",
    summary: shorten(text || "Generation completed."),
    jobTitle: request.jobTitle ?? "Ollama Task",
    jobClass: request.jobClass ?? "task",
    write: Boolean(request.write),
  };
}

async function runStructuredReview(model, promptName, vars) {
  const client = createClient();
  const schemaRaw = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const prompt = loadPrompt(PROMPTS_DIR, promptName, vars);
  const firstResponse = await client.chat(model, [{ role: "user", content: prompt }], {
    format: schemaRaw,
  });
  try {
    return parseReviewOutput(firstResponse.content);
  } catch (firstErr) {
    if (!(firstErr instanceof SchemaValidationError)) {
      throw firstErr;
    }
    const repairPrompt = buildRepairPrompt(firstResponse.content, firstErr);
    const secondResponse = await client.chat(
      model,
      [
        { role: "user", content: prompt },
        { role: "assistant", content: firstResponse.content },
        { role: "user", content: repairPrompt },
      ],
      { format: schemaRaw },
    );
    try {
      return parseReviewOutput(secondResponse.content);
    } catch {
      return {
        error: "schema_violation",
        verdict: "needs-attention",
        summary: "Model output did not conform to schema after retry.",
        findings: [],
        next_steps: ["Run /ollama:switch to a larger model and retry the review."],
      };
    }
  }
}

async function executePullModelRequest(request) {
  const client = createClient();
  const result = await client.pullModel(request.modelName);
  const payload = {
    model: request.modelName,
    result,
    message: `Pull requested for ${request.modelName}.`,
  };
  return {
    exitStatus: 0,
    payload,
    rendered: `${payload.message}\n`,
    summary: payload.message,
    jobTitle: request.jobTitle ?? "Ollama Pull Model",
    jobClass: "task",
  };
}

async function executeTaskRun(request) {
  return executeGenerateRequest({
    ...request,
    jobClass: "task",
    jobTitle: request.jobTitle ?? "Ollama Task",
  });
}

async function executeReviewRun(request) {
  ensureGitRepository(request.cwd);
  const target = resolveReviewTarget(request.cwd, { base: request.base, scope: request.scope });
  const context = collectReviewContext(request.cwd, target);
  const reviewOutput = await runStructuredReview(request.model, request.promptName ?? "review", {
    TARGET_LABEL: target?.label ?? "working-tree",
    USER_FOCUS: request.focus ?? "",
    REVIEW_INPUT: context.content,
  });
  const { renderReviewFindings } = await import("./lib/render.mjs");
  renderReviewFindings(reviewOutput, request.promptName === "adversarial-review" ? "adversarial" : "review");
  const rendered = JSON.stringify(reviewOutput, null, 2);
  return {
    exitStatus: 0,
    payload: { model: request.model, target, reviewContent: context.content, reviewOutput },
    rendered,
    summary: reviewOutput.summary,
    jobTitle: "Ollama Review",
    jobClass: "review",
    write: false,
  };
}

function readTaskPrompt(cwd, positionals) {
  const positionalPrompt = positionals.join(" ");
  return positionalPrompt || readStdinIfPiped();
}

export async function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["model", "cwd"],
    booleanOptions: ["json"],
  });

  const cwd = resolveCommandCwd(options);
  const client = createClient();
  const basePayload = await buildModelsPayload(client);

  if (!basePayload.ollamaRunning) {
    outputWithRenderer(
      {
        success: false,
        ...basePayload,
      },
      options.json,
      renderSetupReport,
    );
    return;
  }

  let activeModel = basePayload.activeModel;
  if (options.model) {
    const valid = await validateModel(client, options.model);
    if (!valid) {
      throw new Error(`Model not found in Ollama: ${options.model}`);
    }
    setActiveModel(options.model);
    activeModel = options.model;
  }

  outputWithRenderer(
    {
      success: true,
      ...basePayload,
      activeModel,
    },
    options.json,
    renderSetupReport,
  );
}

export async function handleReview(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["scope", "base", "cwd", "focus"],
    booleanOptions: ["background", "wait", "json"],
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const model = await ensureActiveModel();
  const target = resolveReviewTarget(cwd, {
    base: options.base,
    scope: options.scope,
  });
  const context = collectReviewContext(cwd, target);

  const job = createCompanionJob({
    prefix: "review",
    kind: "review",
    title: "Ollama Review",
    workspaceRoot,
    jobClass: "review",
    summary: `Review ${target.label}`,
    model,
    prompt: `Review ${target.label}`,
  });

  if (options.background || options.wait) {
    const payload = enqueueBackgroundTask(cwd, job, {
      operation: "review",
      cwd,
      model,
      promptName: "review",
      reviewContent: context.content,
      target,
      base: options.base,
      scope: options.scope,
      focus: options.focus ?? "",
      jobId: job.id,
    });

    if (options.wait) {
      const startedAt = Date.now();
      let current = readStoredJob(workspaceRoot, job.id);
      while (isActiveStatus(current?.status) && Date.now() - startedAt < DEFAULT_WAIT_TIMEOUT_MS) {
        await sleep(DEFAULT_POLL_INTERVAL_MS);
        current = readStoredJob(workspaceRoot, job.id);
      }
      if (isActiveStatus(current?.status)) {
        throw new Error(`Review job ${job.id} did not finish within ${DEFAULT_WAIT_TIMEOUT_MS}ms.`);
      }
      const resultPayload = {
        workspaceRoot,
        job: toRenderableJob(job, current),
        storedJob: current,
      };
      outputWithRenderer(resultPayload, options.json, (report) =>
        renderStoredJobResult(report.job, report.storedJob),
      );
      return;
    }

    outputTextOrJson(
      payload,
      `${payload.title} started in the background as ${payload.jobId}. Check status for progress.\n`,
      options.json,
    );
    return;
  }

  const reviewOutput = await runStructuredReview(model, "review", {
    TARGET_LABEL: target?.label ?? "working-tree",
    USER_FOCUS: options.focus ?? "",
    REVIEW_INPUT: context.content,
  });
  const { renderReviewFindings } = await import("./lib/render.mjs");
  renderReviewFindings(reviewOutput, "review");
  if (options.json) {
    console.log(JSON.stringify(reviewOutput, null, 2));
  }
  return;
}

export async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["background", "write", "json"],
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const model = await ensureActiveModel();
  const prompt = readTaskPrompt(cwd, positionals);

  if (!prompt) {
    throw new Error("Provide a prompt or pipe stdin to `task`.");
  }

  const job = createCompanionJob({
    prefix: "task",
    kind: "task",
    title: "Ollama Task",
    workspaceRoot,
    jobClass: "task",
    summary: shorten(prompt),
    model,
    prompt: shorten(prompt),
    write: Boolean(options.write),
  });

  if (options.background) {
    const payload = enqueueBackgroundTask(cwd, job, {
      operation: "task",
      cwd,
      model,
      prompt,
      write: Boolean(options.write),
      jobId: job.id,
    });
    outputTextOrJson(
      payload,
      `${payload.title} started in the background as ${payload.jobId}. Check status for progress.\n`,
      options.json,
    );
    return;
  }

  await runForegroundCommand(
    job,
    () =>
      executeTaskRun({
        cwd,
        model,
        prompt,
        write: Boolean(options.write),
        jobId: job.id,
      }),
    { json: options.json },
  );
}

export async function handleTaskWorker(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"],
  });

  if (!options["job-id"]) {
    throw new Error("Missing required --job-id for task-worker.");
  }

  const workspaceRoot = resolveWorkspaceRoot(resolveCommandCwd(options));
  const storedJob = readStoredJob(workspaceRoot, options["job-id"]);
  if (!storedJob) {
    throw new Error(`No stored job found for ${options["job-id"]}.`);
  }

  if (!storedJob.request || typeof storedJob.request !== "object") {
    throw new Error(`Stored job ${options["job-id"]} is missing its request payload.`);
  }

  const job = { ...storedJob, workspaceRoot };
  const { logFile, progress } = createTrackedProgress(job, {
    logFile: storedJob.logFile ?? null,
  });

  await runTrackedJob(
    { ...job, logFile },
    async () => {
      const request = { ...storedJob.request, onProgress: progress };
      switch (request.operation) {
        case "review":
          return executeReviewRun({
            ...request,
            jobClass: "review",
            jobTitle: "Ollama Review",
          });
        case "task":
          return executeGenerateRequest({
            ...request,
            jobClass: "task",
            jobTitle: "Ollama Task",
          });
        case "pull-model":
          return executePullModelRequest(request);
        default:
          throw new Error(`Unsupported task-worker operation: ${request.operation}`);
      }
    },
    { logFile },
  );
}

export async function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["all", "json"],
  });

  const cwd = resolveCommandCwd(options);
  const client = createClient();
  const ollamaRunning = await client.ping();
  const activeModel = getActiveModel();
  const reference = positionals[0] ?? "";

  if (reference) {
    const snapshot = buildSingleJobSnapshot(cwd, reference);
  const payload = {
      ...snapshot,
      ollamaRunning,
      activeModel,
      job: toRenderableJob(snapshot.job),
    };
    return outputWithRenderer(payload, options.json, (report) =>
      renderJobStatusReport(report.job),
    );
  }

  const snapshot = buildStatusSnapshot(cwd, { all: options.all });
  const payload = buildStatusPayload(snapshot, { ollamaRunning, activeModel });
  return outputWithRenderer(payload, options.json, renderStatusReport);
}

export function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  const payload = {
    workspaceRoot,
    job: toRenderableJob(job, storedJob),
    storedJob,
  };
  outputWithRenderer(payload, options.json, (report) =>
    renderStoredJobResult(report.job, report.storedJob),
  );
}

export async function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveCancelableJob(cwd, reference);
  const existing = readStoredJob(workspaceRoot, job.id) ?? {};

  terminateProcessTree(job.pid ?? Number.NaN);
  appendLogLine(job.logFile, "Cancelled by user.");

  const completedAt = nowIso();
  const nextJob = {
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user.",
  };

  writeJobFile(workspaceRoot, job.id, {
    ...existing,
    ...nextJob,
    cancelledAt: completedAt,
  });
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt,
  });

  outputWithRenderer(
    {
      jobId: job.id,
      status: "cancelled",
      title: job.title,
      job: toRenderableJob(nextJob, existing),
    },
    options.json,
    (report) => renderCancelReport(report.job),
  );
}

export async function handleSwitch(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const modelName = positionals[0];
  if (!modelName?.trim()) {
    return outputWithRenderer(
      {
        success: false,
        error: "Model name is required. Usage: /ollama:switch <model-name>",
      },
      options.json,
      () => {
        console.log("Model name is required. Usage: /ollama:switch <model-name>");
      },
    );
  }

  const client = createClient();
  const valid = await validateModel(client, modelName);
  if (!valid) {
    throw new Error(`Model not found in Ollama: ${modelName}`);
  }

  setActiveModel(modelName);
  return outputWithRenderer(
    { success: true, activeModel: modelName },
    options.json,
    (report) => renderSwitchReport(report.activeModel),
  );
}

export async function handleListModels(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const client = createClient();
  const payload = await buildModelsPayload(client);
  return outputWithRenderer(payload, options.json, (report) =>
    renderListModelsReport(report.localModels, report.cloudModels),
  );
}

export async function handleRunModel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const modelName = positionals[0];
  if (!modelName?.trim()) {
    return outputWithRenderer(
      {
        success: false,
        error: "Model name is required. Usage: /ollama:run-model <model-name>",
      },
      options.json,
      () => {
        console.log("Model name is required. Usage: /ollama:run-model <model-name>");
      },
    );
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const job = createCompanionJob({
    prefix: "model",
    kind: "task",
    title: "Ollama Pull Model",
    workspaceRoot,
    jobClass: "task",
    summary: `Pull model ${modelName}`,
    model: modelName,
    prompt: `pull ${modelName}`,
  });

  const queued = enqueueBackgroundTask(cwd, job, {
    operation: "pull-model",
    cwd,
    modelName,
    jobId: job.id,
  });

  return outputTextOrJson(
    {
      jobId: queued.jobId,
      model: modelName,
      message: `Model pull queued for ${modelName}.`,
    },
    `Model pull queued for ${modelName} as ${queued.jobId}.\n`,
    options.json,
  );
}

export async function handleRescue(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"],
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const client = createClient();
  const recentJobs = listJobs(workspaceRoot).slice(0, 10);

  const payload = {
    ollamaRunning: await client.ping(),
    activeModel: getActiveModel(),
    globalConfig: loadGlobalConfig(),
    workspaceRoot,
    recentJobs,
  };

  return outputWithRenderer(payload, options.json, () => {
    if (recentJobs.length === 0) {
      console.log("No recent jobs found.");
      return;
    }
    for (const job of recentJobs) {
      renderRescueReport({
        id: job.id,
        prompt: job.prompt ?? job.summary ?? job.title,
        status: job.status,
        resultFile: null,
        error: job.errorMessage ?? "No error recorded.",
      });
    }
  });
}

export async function main(argv = process.argv.slice(2)) {
  const [subcommand, ...restArgv] = argv;
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }

  switch (subcommand) {
    case "setup":
      await handleSetup(restArgv);
      break;
    case "review":
      await handleReview(restArgv);
      break;
    case "task":
      await handleTask(restArgv);
      break;
    case "task-worker":
      await handleTaskWorker(restArgv);
      break;
    case "status":
      await handleStatus(restArgv);
      break;
    case "result":
      handleResult(restArgv);
      break;
    case "cancel":
      await handleCancel(restArgv);
      break;
    case "switch":
      await handleSwitch(restArgv);
      break;
    case "list-models":
      await handleListModels(restArgv);
      break;
    case "run-model":
      await handleRunModel(restArgv);
      break;
    case "rescue":
      await handleRescue(restArgv);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === SCRIPT_PATH) {
  main().then(
    () => process.exit(0),
    (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
