import fs from 'node:fs';
import path from 'node:path';

import { appendLog } from './lib/log.mjs';
import { listJobs, resolveJobLogFile, resolveStateDir, ensureStateDir } from './lib/state.mjs';

const [command, scriptPath, hookName] = process.argv;

function sessionStart() {
  // We need to ensure the state directory exists.
  ensureStateDir();
}

function sessionEnd() {
  // Write "Session ended" to all active jobs.
  const jobs = listJobs().filter(job => job.status === 'active');
  for (const job of jobs) {
    appendLog(
      job.id,
      resolveJobLogFile(job.id),
      `

---------- Session ended at ${new Date().toLocaleString()} ----------`,
    );
  }
}

switch (hookName) {
  case 'SessionStart':
    sessionStart();
    break;
  case 'SessionEnd':
    sessionEnd();
    break;
  default:
    console.error(`Unknown hook: ${hookName}`);
    process.exit(1);
}
