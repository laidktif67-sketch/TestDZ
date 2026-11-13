#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowPath = process.argv[2] ?? ".github/workflows/apply-migration.yml";
const workflow = readFileSync(workflowPath, "utf8");

const triggerBlock = workflow.match(/^on:\s*\n([\s\S]*?)(?=^[^\s#]|\s*$)/m)?.[1] ?? "";
assert.match(triggerBlock, /^\s{2}workflow_dispatch:/m, "deployment must be manual");
assert.doesNotMatch(triggerBlock, /^\s{2}(push|pull_request|schedule):/m, "deployment must not run automatically");

assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/, "deployment must originate from protected main");
assert.match(workflow, /environment:\s*testdz-rebuild-migrations\b/, "deployment must use the approval-gated GitHub Environment");
assert.match(workflow, /test "\$SUPABASE_PROJECT_REF" = "ouzppgsvwsgtqyabkwjk"/, "target must be TestDZ-Rebuild only");
assert.doesNotMatch(workflow, /naqjjykcglxiobkmdllj/, "legacy TestDZ project ref must never appear");
assert.match(workflow, /SUPABASE_DB_URL/, "database URL must be independently validated");
assert.match(workflow, /supabase link --project-ref "\$SUPABASE_PROJECT_REF"/, "Supabase link must use the validated project ref");

assert.match(workflow, /staging[-_ ]only/i, "workflow must recognize staging-only migration markers");
assert.match(workflow, /supabase_migrations\.schema_migrations/, "workflow must compare marked migrations with remote migration history");
assert.match(workflow, /supabase db push --remote --dry-run/, "workflow must preview pending changes");
assert.match(workflow, /supabase db push --remote --yes/, "workflow must apply only after guards and dry-run");

console.log("apply-migration workflow safety checks passed");
