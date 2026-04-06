# Repository Guidelines

## Project Structure & Module Organization
This repository is a configuration workspace for Clash-family clients. Keep changes scoped to the correct target:

- `scripts/clash/override.js`: main Clash Verge override script and policy assembly logic.
- `rules/clash/*.yaml`: static Clash rule fragments and templates, such as `override.template.yaml`.
- `scripts/stash/*.stoverride*`: Stash-specific override snippets and templates.
- `rules/shadowrocket/*`: Shadowrocket rule lists and client-specific config artifacts.
- `docs/` and `scripts/clash/*.md`: architecture notes and operator-facing documentation.

## Build, Test, and Development Commands
There is no package manager, build pipeline, or CI in this repo. Use lightweight local validation instead:

- `node --check scripts/clash/override.js`: syntax-check the main JavaScript override script.
- `rg --files`: inspect repository files while respecting `.gitignore`.
- `git diff --stat`: review the scope of your change before committing.

For functional validation, import the updated script and rule files into Clash Verge, Stash, or Shadowrocket and confirm that groups, DNS bindings, and rule order behave as expected.

## Coding Style & Naming Conventions
Use 2-space indentation in JavaScript and YAML. Match the existing style: `camelCase` for JavaScript helpers and config variables, uppercase region codes such as `HK` and `US`, and stable policy names such as `Proxies`, `Tmp`, `Claude`, and `SecUS🟩`. Keep rule files ordered from specific to broad so earlier matches are not shadowed by generic entries.

## Testing Guidelines
No automated test suite is present today. Minimum validation for script changes is `node --check scripts/clash/override.js` plus a manual client import. For rule edits, verify that new entries do not duplicate built-in AI or DNS rules and that process rules, domain rules, and CIDR rules still match in the intended order.

## Commit & Pull Request Guidelines
Recent history is mixed, but the newest commits commonly use prefixes such as `feat:`, `fix:`, and `perf:`. Prefer `type: concise summary`, using the affected subsystem in the subject when helpful. Pull requests should describe the target client, the routing or DNS behavior changed, any renamed groups or files, and the manual validation performed. Add screenshots only when GUI ordering or visible client behavior changed.

## Security & Local Configuration
Do not read, commit, or reference `.gitignore`-ignored local material such as `tmp`, `.env*`, `*.pem`, `*.key`, `secrets/`, `.codex`, or `.claude`. Keep secrets and machine-specific overrides local.
