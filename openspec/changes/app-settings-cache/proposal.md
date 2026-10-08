## Why

The app reads its settings from DHIS2 on every use case that needs them: 16 use cases call the settings repository on each execution, and `ListUsersUseCase` alone runs on every page, search and filter change. In a short session on 2.42.6 (browse the users list, search, edit a user, open each tab) the settings key was requested ~26 times. Settings rarely change, so almost all of those requests are wasted round-trips. ClickUp: [869f78zny](https://app.clickup.com/t/4528615/869f78zny).

## What Changes

- Settings are fetched from the server once per page load and reused by every reader (the UI provider and all use cases). Saving settings replaces the remembered value, so the new values apply immediately in the same session.
- A failed read is not remembered: the next read tries the server again.
- Works the same with both settings storages (dataStore and constants).
- The replicate-user dialog reads the settings already loaded by the app instead of starting its own independent load, so it also sees settings saved during the session.
- **Behaviour change (accepted):** settings changed by another admin, or in another tab, reach an already-open session only after a reload. The UI already behaves this way; after this change the use cases do too. It is not a security issue: these restrictions are client-side only, and the DHIS2 API is the real enforcement.

## Capabilities

### New Capabilities
- `app-settings`: how the app loads, reuses and updates its settings during a session.

### Modified Capabilities

## Impact

- `src/data/`: a new in-memory cache helper, used by the two settings repositories (`get` reads through it, `save` updates it). No changes to the `AppSettingsRepository` interface, the use cases or `CompositionRoot.ts`.
- `src/webapp/hooks/useReplicateUserFromTemplate.ts`: reads settings from the app settings context.
- Network: one `settings` request per page load instead of one per use case execution.
- Out of scope: deduplicating concurrent reads, propagating changes to other open sessions (TTL, polling), the legacy per-user settings in `userDataStore` (`src/legacy/models/settings.js`, `visible-columns`, `*-columns-preference`), extracting the cache to a shared EyeSeeTea package, and changing use case signatures to receive settings as a parameter.
