# Stack versions and project equivalents

The reference (`dhis2-app-skeleton`) uses newer versions: React 18, TypeScript 5.7, `@dhis2/ui` 10, Vite 7. This project is on React 17, TypeScript 4.9, `@dhis2/ui` 7 and Vite 6.

- Never copy from the reference an API these versions do not have (React 18 hooks, TS 5 syntax, `@dhis2/ui` 10 components).
- New code uses the project's own `Future` (`src/domain/entities/Future.ts`), not the reference's.
- E2E tests use Cypress (`cypress/`), not Playwright; `dhis2-react/testing.md` → *Playwright* principles still apply.
