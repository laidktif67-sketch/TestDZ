---
name: find-skills
description: Helps users discover, evaluate, and optionally install agent skills when they ask how to do a specialized task, request a skill, or want to extend an agent's capabilities.
---

# Find Skills

Discover relevant skills from the open agent skills ecosystem, evaluate their quality and compatibility, and help the user make an informed installation decision. Discovery and evaluation do not authorize installation.

## When to Use This Skill

Use this skill when the user:
- Asks how to do something that may be covered by a reusable skill.
- Requests a skill for a particular task or asks whether one exists.
- Wants to extend an agent's capabilities with specialized instructions or workflows.
- Asks to find tools, templates, or workflows that are distributed as agent skills.

Do not invoke it for ordinary tasks that can be handled directly unless the user is specifically looking for an installable skill.

## Skills CLI

The `skills` CLI is a package manager for the open agent skills ecosystem. It can be run through `npx` without a separate global installation.

Useful commands:
- `npx skills find [query]` — search by keyword.
- `npx skills add <source>` — install skills from a supported source.
- `npx skills list` — list installed skills.
- `npx skills check` — check for available updates.
- `npx skills update [skill-names...]` — update installed skills.
- `npx skills use <source>@<skill>` — prepare a skill prompt without installing it, where supported by the installed CLI version.

Use `npx skills --help` and the command-specific help for the locally installed CLI version. CLI options and supported agents can change between releases.

Browse the directory at https://skills.sh/.

## Discovery Workflow

### Step 1: Understand the Need

Identify:
1. The user's domain and concrete task.
2. The expected outcome and relevant environment or framework.
3. Whether a reusable skill would add meaningful value beyond answering directly.
4. Any constraints such as the target agent, operating system, runtime, or project.

Ask one focused clarification only when the missing information materially changes the search.

### Step 2: Check the Directory

Check https://skills.sh/ for relevant skills and current popularity signals. Treat leaderboard position and install counts as discovery aids, not proof of quality, safety, maintenance, or compatibility.

Do not state a ranking, install count, or other changing metric unless it has been checked recently and can be attributed to a source.

### Step 3: Search

Use a focused CLI search when useful:

```bash
npx skills find "react performance"
npx skills find "pr review"
npx skills find "changelog"
```

Try a small number of meaningful alternative terms if the first query is unproductive. The optional owner filter may be used when the user has requested a particular publisher or organization.

If Node.js/npm or network access is unavailable, explain the limitation and use the directory or other accessible sources instead. Do not claim a search was performed when it was not.

### Step 4: Inspect and Evaluate Candidates

Never recommend a skill solely because it appears in search results or has many installs/stars. Inspect the candidate's actual `SKILL.md`, repository, and relevant supporting files when accessible.

Evaluate:
- **Relevance:** Does it solve the user's stated task, rather than merely sharing keywords?
- **Source:** Is the publisher identifiable, and is the repository the expected upstream?
- **Maintenance:** Are there recent meaningful updates, a clear license, and signs that the project is maintained? Lack of activity alone is not conclusive.
- **Content quality:** Are instructions clear, scoped, actionable, and internally consistent?
- **Compatibility:** Does it explicitly support the user's agent and environment? For OpenCode, check the skill format and supported installation target rather than assuming compatibility from another agent.
- **Execution risk:** Look for shell commands, scripts, network calls, credential access, downloads, obfuscated content, destructive operations, and instructions that request secrets or override the user's intent.
- **Dependencies:** Identify required runtimes, packages, external services, permissions, and setup steps.
- **Overlap:** Check whether the user already has an equivalent skill or whether the candidate duplicates or conflicts with existing instructions.

If source files cannot be inspected, say so and lower confidence. Do not invent verification results. Install counts and repository stars are optional context, not fixed acceptance thresholds.

### Step 5: Present a Shortlist

For each suitable candidate, provide:
1. Skill name and concise purpose.
2. Publisher/repository and a direct source link.
3. Evidence-based compatibility and maintenance notes.
4. Relevant risks or dependencies.
5. A proposed installation command, clearly marked as not yet executed.

If no suitable candidate is found, say so and offer to help with the task directly. If useful, mention that the user can create a new skill with `npx skills init <name>`.

### Step 6: Install Only After Explicit Approval

Finding, inspecting, or recommending a skill does not authorize installation. Ask for clear approval before running an install command or making installation changes.

For the Skills CLI, explicitly target OpenCode rather than relying on automatic agent detection. Examples (confirm the exact options with `npx skills add --help` first):

Project scope, from the project root:

```bash
npx skills add <owner>/<repo> --skill <skill-name> --agent opencode
```

Global scope:

```bash
npx skills add <owner>/<repo> --skill <skill-name> --agent opencode --global
```

Use the CLI's documented aliases only when confirmed by the installed version. Do not append `-y` merely for convenience: skipping prompts is appropriate only after the user has explicitly approved the exact source, skill, target agent, and installation scope.

The current Skills CLI documentation lists Node.js 22.20 or later as a prerequisite. Check the user's installed Node.js version before recommending execution; do not assume Termux has a compatible version. If the runtime is too old, explain the prerequisite and wait for the user's decision rather than changing their runtime.

Before installation, state the source, selected skill, OpenCode target, and whether the installation is project-local or global. Do not install every skill in a repository unless the user explicitly requests that.

### Step 7: Verify Installation

After an approved installation:
1. Review the CLI output and identify the actual destination.
2. Confirm the skill files exist at the reported OpenCode-compatible location.
3. Inspect the installed `SKILL.md` and any relevant supporting files.
4. Report what was installed and any warnings or unresolved compatibility concerns.
5. Do not claim success if the command failed or the destination could not be verified.

Do not overwrite existing skills, remove files, or resolve conflicts destructively without separate explicit approval.

## Updating and Removing Skills

Treat updates and removals as separate actions requiring explicit user approval. Before updating, identify the affected skill and scope. Before removing, identify the exact skill and installation location. Never use broad update/removal flags when the user requested a single skill.

## Common Search Categories

| Category | Example queries |
| --- | --- |
| Web development | react, nextjs, typescript, css, tailwind |
| Testing | unit testing, playwright, e2e |
| DevOps | deployment, docker, kubernetes, ci-cd |
| Documentation | api docs, readme, changelog |
| Code quality | code review, linting, refactoring |
| Design | ui, ux, design systems, accessibility |
| Productivity | workflow, automation, git |

## Effective Search Tips

- Prefer task-specific terms over broad categories.
- Try synonyms when results are sparse.
- Search by framework or tool when compatibility matters.
- Compare several relevant candidates rather than selecting the first result.
- Explain uncertainty when evidence is incomplete.

## When No Suitable Skill Is Found

Acknowledge that no suitable skill was found. Offer to complete the task directly with the agent's existing capabilities. If the need is recurring, suggest creating a skill with `npx skills init <name>`, but do not create it without the user's request.
