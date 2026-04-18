import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(
  __dirname,
  '../../schemas/review-output.schema.json'
);

const ajv = new Ajv({ strict: false });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const validate = ajv.compile(schema);

export class SchemaValidationError extends Error {
  constructor(message, phase, rawOutput = '', ajvErrors = null) {
    super(message);
    this.name = 'SchemaValidationError';
    this.phase = phase;
    this.rawOutput = rawOutput;
    this.ajvErrors = ajvErrors;
  }
}

export function parseReviewOutput(raw) {
  let parsed;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new SchemaValidationError(
      `JSON parse failed: ${err.message}`,
      'parse',
      raw,
      null
    );
  }

  const valid = validate(parsed);
  if (!valid) {
    const errorSummary = ajv.errorsText(validate.errors, { separator: '; ' });
    throw new SchemaValidationError(
      `Schema validation failed: ${errorSummary}`,
      'validate',
      raw,
      validate.errors
    );
  }

  return parsed;
}

export function buildRepairPrompt(rawOutput, err) {
  const errorText =
    err.ajvErrors
      ? ajv.errorsText(err.ajvErrors, { separator: '\n- ' })
      : err.message;

  return [
    'Your previous response did not conform to the required JSON schema.',
    '',
    'Validation errors:',
    `- ${errorText}`,
    '',
    'Required schema fields: verdict ("approve"|"needs-attention"), summary (string),',
    'findings (array with severity/title/body/file/line_start/line_end/confidence/recommendation),',
    'next_steps (array of strings).',
    '',
    'Your previous response was:',
    '```',
    rawOutput.slice(0, 2000),
    '```',
    '',
    'Return ONLY valid JSON matching the schema. No prose, no code fences.',
  ].join('\n');
}
