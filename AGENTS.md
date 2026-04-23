# Repository Guidelines

## Project Structure & Module Organization

This repository is currently documentation-first. Product requirements live in [`docs/RPD.md`](./docs/RPD.md).

Use this structure as the project grows:

- `docs/`: product, research, and planning documents.
- `src/`: application code for the Web client and shared logic.
- `tests/`: automated tests, mirroring `src/` where practical.
- `assets/`: static images, icons, audio mock data, and design artifacts.

Keep feature work grouped by domain when code is added, for example `src/features/player/` or `src/features/ai-dj/`.

## Build, Test, and Development Commands

No build or test toolchain is configured yet. Until scripts are added, contributors should rely on:

- `git status`: verify intended changes before committing.
- `rg "<term>" .`: search requirements and future code quickly.
- `sed -n '1,120p' docs/RPD.md`: inspect the current product spec.

When a runtime is introduced, add project-local commands here and in the relevant package manifest or Makefile. Prefer explicit scripts such as `npm run dev`, `npm test`, and `npm run lint`.

## Coding Style & Naming Conventions

Use Markdown for planning docs and keep sections short, scannable, and versioned when requirements change.

For future code:

- Use 2-space indentation for frontend files unless the formatter enforces otherwise.
- Prefer descriptive, domain-based names: `playerQueue.ts`, `tasteProfileService.ts`.
- Use `PascalCase` for React components, `camelCase` for variables/functions, and `kebab-case` for asset filenames.
- Adopt an automatic formatter and linter before scaling the codebase.

## Testing Guidelines

There is no test framework yet. Once code is added:

- Place unit tests under `tests/` or alongside source files with a clear suffix such as `*.test.ts`.
- Mirror feature boundaries in test names, for example `ai-dj.recommendation.test.ts`.
- Add coverage for core flows: search, playback, recommendation logic, and AI DJ interactions.

## Commit & Pull Request Guidelines

The repository has no commit history yet, so use a consistent convention from the start:

- Commit format: `type(scope): summary`, for example `docs(rpd): refine AI DJ requirements`.
- Types should stay simple: `docs`, `feat`, `fix`, `refactor`, `test`, `chore`.

Pull requests should include:

- A short description of the change and its purpose.
- Linked issue or requirement reference when available.
- Screenshots or sample output for UI or document structure changes.
- Notes on follow-up work, assumptions, or open questions.

## Agent-Specific Notes

Do not overwrite user-authored changes without checking current files first. If you add new directories, update this guide so future contributors follow the same structure.
