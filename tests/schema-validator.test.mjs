import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  parseReviewOutput,
  buildRepairPrompt,
  SchemaValidationError,
} from '../plugins/ollama/scripts/lib/schema-validator.mjs';

const VALID_OUTPUT = JSON.stringify({
  verdict: 'approve',
  summary: 'Change looks safe.',
  findings: [],
  next_steps: [],
});

const VALID_WITH_FINDINGS = JSON.stringify({
  verdict: 'needs-attention',
  summary: 'One high severity issue found.',
  findings: [
    {
      severity: 'high',
      title: 'Missing null check',
      body: 'The function does not handle null input.',
      file: 'src/foo.mjs',
      line_start: 10,
      line_end: 15,
      confidence: 0.9,
      recommendation: 'Add a null guard at line 10.',
    },
  ],
  next_steps: ['Fix the null check before merging.'],
});

const INVALID_JSON = 'this is not json {{{';

const MISSING_REQUIRED = JSON.stringify({
  verdict: 'approve',
  summary: 'ok',
});

const WRONG_VERDICT = JSON.stringify({
  verdict: 'maybe',
  summary: 'ok',
  findings: [],
  next_steps: [],
});

describe('parseReviewOutput', () => {
  test('parses valid output with no findings', () => {
    const result = parseReviewOutput(VALID_OUTPUT);
    assert.strictEqual(result.verdict, 'approve');
    assert.deepStrictEqual(result.findings, []);
  });

  test('parses valid output with findings', () => {
    const result = parseReviewOutput(VALID_WITH_FINDINGS);
    assert.strictEqual(result.verdict, 'needs-attention');
    assert.strictEqual(result.findings.length, 1);
    assert.strictEqual(result.findings[0].severity, 'high');
  });

  test('throws SchemaValidationError on invalid JSON', () => {
    assert.throws(
      () => parseReviewOutput(INVALID_JSON),
      (err) => err instanceof SchemaValidationError && err.phase === 'parse'
    );
  });

  test('throws SchemaValidationError when required fields missing', () => {
    assert.throws(
      () => parseReviewOutput(MISSING_REQUIRED),
      (err) => err instanceof SchemaValidationError && err.phase === 'validate'
    );
  });

  test('throws SchemaValidationError on invalid verdict enum', () => {
    assert.throws(
      () => parseReviewOutput(WRONG_VERDICT),
      (err) => err instanceof SchemaValidationError && err.phase === 'validate'
    );
  });
});

describe('buildRepairPrompt', () => {
  test('includes original output and error summary', () => {
    let err;
    try {
      parseReviewOutput(MISSING_REQUIRED);
    } catch (e) {
      err = e;
    }
    const repairPrompt = buildRepairPrompt(MISSING_REQUIRED, err);
    assert.ok(repairPrompt.includes('JSON'));
    assert.ok(repairPrompt.includes('findings'));
  });
});
