# Contributing to @elementmints/date

Thank you for your interest in contributing! This guide covers everything you need to get started.

## How to Contribute

1. **Report bugs** -- open an [issue](https://github.com/ElementMint/date/issues) with a clear description and reproduction steps.
2. **Suggest features** -- open an issue tagged `enhancement` describing the use case and proposed API.
3. **Submit fixes and features** -- fork the repo, create a branch, and open a pull request.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ElementMint/date.git
cd date

# Install dependencies
npm install

# Start the dev server with watch mode
npm run dev
```

### Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Rollup in watch mode for development |
| `npm run build` | Build all output formats (ESM, CJS, IIFE) and CSS |
| `npm run lint` | Run ESLint on all TypeScript source files |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format source files with Prettier |
| `npm run typecheck` | Run the TypeScript compiler without emitting (type checking only) |
| `npm test` | Run the test suite with Jest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run size` | Check bundle size against the 10 KB limit |
| `npm run demo` | Serve the demo page locally |

## Project Structure

```
src/
  index.ts              # ESM entry point (public API exports)
  browser.ts            # IIFE entry point (CDN auto-init)
  datepicker.ts         # Main DatePicker class
  core/
    types.ts            # TypeScript interfaces and types
    config.ts           # data-* attribute parser and defaults
    parser.ts           # Date string parsing
    formatter.ts        # Date formatting (DD/MM/YYYY tokens)
    validator.ts        # Synchronous validation logic
    calendar.ts         # Calendar grid generation
    date-utils.ts       # Pure date utility functions
    locale.ts           # Locale-aware names via Intl API
  dom/
    renderer.ts         # Calendar DOM rendering
    input-mask.ts       # Segmented input (day/month/year fields)
    positioning.ts      # Calendar popup positioning
    diff.ts             # DOM diffing for calendar updates
    events.ts           # Event delegation utility
  features/
    keyboard.ts         # Keyboard navigation
    accessibility.ts    # ARIA management and announcements
    error-display.ts    # Validation error display
    async-validation.ts # Async server-side validation
  wrapper/
    web-component.ts    # <date-picker> custom element
  adapters/
    react.ts            # React adapter (createReactDatePicker)
    vue.ts              # Vue 3 adapter (createVueDatePicker)
    angular.ts          # Angular adapter (createAngularDatePicker)
  plugins/
    index.ts            # Plugin registry
  styles/
    main.scss           # SCSS entry point
    _variables.scss     # CSS custom properties
    _base.scss          # Base component styles
    _input.scss         # Input field styles
    _themes.scss        # Light/dark/system theme definitions
    _rtl.scss           # Right-to-left layout support
  auto-init/
    index.ts            # Auto-initialization logic (initAll, destroyAll)
__tests__/              # Jest test files
demo/                   # Demo page
```

## Code Standards

### TypeScript

- All source code is written in TypeScript with strict mode enabled.
- Use explicit types for function parameters and return values.
- Avoid `any` except in framework adapter boundaries where external types are unavoidable.

### No Runtime Dependencies

This library has **zero runtime dependencies** by design. Do not add any `dependencies` to `package.json`. Everything must be implemented from scratch or use browser-native APIs.

### Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. Commitlint is enforced via a Husky pre-commit hook.

Format: `<type>(<scope>): <description>`

Types:
- `feat` -- a new feature
- `fix` -- a bug fix
- `docs` -- documentation changes
- `style` -- formatting, semicolons, etc. (no code change)
- `refactor` -- code change that neither fixes a bug nor adds a feature
- `perf` -- performance improvement
- `test` -- adding or updating tests
- `chore` -- build process, tooling, or dependency updates

Examples:
```
feat(calendar): add month/year dropdown navigation
fix(parser): handle leap year edge case in February
docs: update README with async validation example
test(validator): add weekday rule edge cases
```

### Code Style

- Prettier handles formatting automatically. Run `npm run format` before committing.
- ESLint catches common issues. Run `npm run lint` to check.
- Both are enforced via Husky pre-commit hooks.

## Testing

Tests are written with [Jest](https://jestjs.io/) and use `jest-environment-jsdom` for DOM testing.

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Place test files in `__tests__/` with the naming convention `<module>.test.ts`.
- Test behavior, not implementation details.
- Mock DOM elements using jsdom rather than importing browser globals directly.
- Keep tests fast -- avoid timers and async waits where possible.

## Pull Request Process

1. **Fork and branch** -- create a feature branch from `master` (e.g. `feat/month-dropdown`).
2. **Make your changes** -- follow the code standards above.
3. **Write or update tests** -- ensure all new behavior is covered.
4. **Run the full check suite**:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run size
   ```
5. **Commit using Conventional Commits** format.
6. **Open a pull request** against `master` with a clear description of what changed and why.
7. **Address review feedback** -- maintainers may request changes before merging.

### PR Checklist

- [ ] Code follows the project's TypeScript and style conventions
- [ ] No new runtime dependencies added
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Bundle size is within the 10 KB limit (`npm run size`)
- [ ] Commit messages follow Conventional Commits format

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.
