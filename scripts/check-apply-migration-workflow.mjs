#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = process.argv[2] ?? ".github/workflows/apply-migration.yml";
const workflow = readFileSync(workflowPath, "utf8");

const triggerBlock = workflow.match(/^on:\s*\n([\s\S]*?)(?=^[^\s#]|\s*$)/m)?.[1] ?? "";
assert.match(triggerBlock, /^\s{2}workflow_dispatch:/m, "workflow must be manually invokable for an explicit refusal");
assert.doesNotMatch(triggerBlock, /^\s{2}(push|pull_request|schedule):/m, "remote migration workflow must never run automatically");

assert.match(workflow, /Remote migrations are disabled/i, "workflow must clearly state that remote migrations are disabled");
assert.match(workflow, /exit 1/, "workflow must fail closed when invoked");
assert.doesNotMatch(workflow, /environment\s*:/i, "workflow must not rely on an unverified Environment approval gate");
assert.doesNotMatch(workflow, /secrets\./i, "disabled workflow must not read repository or environment secrets");
assert.doesNotMatch(workflow, /SUPABASE_[A-Z0-9_]+/i, "disabled workflow must not access Supabase credentials or project configuration");
assert.doesNotMatch(workflow, /supabase\s+db\s+push|supabase\s+link|\bpsql\b/i, "disabled workflow must not connect to or modify a remote database");

console.log("remote migration fail-closed checks passed");
