# CLAUDE.md - @elementmints/date

## Project Overview

A zero-dependency, attribute-driven date picker library. Supports single/range/week/month selection modes, segmented and natural input editing, dual-month booking layouts, time picker, and more.

## Commands

```bash
npm run build          # Full build: JS (rollup) + types (tsc) + CSS (sass)
npm run build:js       # Rollup bundles: ESM, CJS, IIFE
npm run build:types    # TypeScript declarations only
npm run build:css      # Sass -> dist/date.min.css
npm test               # Jest tests (jsdom)
npm run test:coverage  # Tests with coverage report
npm run lint           # ESLint (warnings only, 0 errors expected)
npm run typecheck      # tsc --noEmit
npm run size           # size-limit check (JS <25kB, CSS <4kB gzipped)
npm run demo           # Serve demo at localhost:3000
```

## Architecture

### Source Layout

- `src/core/` - Pure logic: types, config parser, date utils, formatter, parser, validator, calendar generation, locale
- `src/dom/` - DOM layer: renderer, input-mask (segmented), natural-input, positioning, diff engine, event delegation
- `src/features/` - Optional features: accessibility, keyboard nav, error display, async validation
- `src/datepicker.ts` - Main orchestrator class that wires everything together
- `src/styles/` - SCSS: `_variables.scss` (CSS custom props), `_base.scss` (calendar/grid), `_input.scss`, `_themes.scss`, `_rtl.scss`
- `src/adapters/` - React, Vue, Angular wrappers
- `src/wrapper/web-component.ts` - Custom element wrapper
- `src/plugins/` - Plugin system
- `src/index.ts` - Public ESM exports
- `src/browser.ts` - IIFE entry with auto-init

### Build Outputs

- `dist/esm/` - ES modules (preserveModules)
- `dist/cjs/index.cjs` - CommonJS
- `dist/iife/date.min.js` - Browser bundle (minified, global `DatePicker`)
- `dist/types/` - TypeScript declarations
- `dist/date.min.css` - Compiled styles

### Key Patterns

- **Configuration**: All options via `data-*` attributes on the input element, parsed in `config.ts`
- **Event delegation**: Single listener per event type on calendar root (`dom/events.ts`), not per-element
- **DOM diffing**: `dom/diff.ts` patches the calendar grid efficiently without full re-render
- **Input modes**: `segmented` (keyboard-navigable segments) vs `native` (natural masked typing with split fields)
- **Selection modes**: `single`, `range` (hotel booking), `week`, `month`

## Conventions

- Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Prefix unused parameters with `_` (eslint rule: `argsIgnorePattern: ^_`)
- CSS custom properties namespaced with `--dp-` prefix
- CSS classes namespaced with `dp-` prefix, BEM-style modifiers (`dp-day--selected`, `dp-day--disabled`)
- Commit messages follow Conventional Commits (commitlint enforced via husky)
- Tests in `__tests__/` mirroring `src/` structure, using jest + jsdom
- No runtime dependencies. React/Vue are optional peer deps.

## CI Pipeline

GitHub Actions (`ci.yml`): lint -> typecheck -> test (with coverage) -> build -> size-check

Size budgets: JS IIFE < 25kB gzipped, CSS < 4kB gzipped.

## Demo

`demo/index.html` - Interactive playground with live-editable markup cards. Loads from `dist/`. Has dark/light theme toggle. Run with `npm run demo`.

## Important Notes

- The `DatePicker` constructor takes an `<input>` element (or container with an input)
- `calendarOnly` mode makes the input readonly - users must select from the calendar
- `portal` mode appends the calendar to `document.body` to avoid overflow clipping
- The `rerenderDualMonth()` method does a full innerHTML replacement and must re-append extras (footer, custom header) via `appendCalendarExtras()`
- Disabled date validation runs on both calendar click AND manual input
