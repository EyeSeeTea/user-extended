## Context

See proposal.md → Why. Current state:

- `AppSettingsRepository` has two implementations, chosen in `getCompositionRoot` by storage type: `AppSettingsD2Repository` (dataStore key `settings`) and `AppSettingsD2ConstantRepository` (a DHIS2 constant). Both `get()` call the server on every call.
- `AppSettingsProvider` wraps the whole app (`App.tsx`) and renders nothing until its first read finishes (`useAppSettings` → `GetAppSettingsUseCase` → `repository.get()`). Every other reader is mounted after it.
- 16 use cases read the settings through the repository: 8 directly (`repository.get()`) and 8 through `getAppSettings()` in `domain/usecases/common/settings.ts`, including `ListUsersUseCase`.
- `useReplicateUserFromTemplate.ts` calls `useAppSettings()` directly: a second, independent load whose state is not updated when settings are saved.
- The `compositionRoot` is created once in `App.tsx`, so each repository instance lives for the page load.

## Goals / Non-Goals

**Goals:**
- One settings request per page load, plus none after a save.
- Use cases keep calling `appSettingsRepository.get()` unchanged: caching is a data-layer detail.

**Non-Goals:**
- Deduplicating concurrent reads (not needed, see Decisions).
- Changing the repository interface, use case signatures or `CompositionRoot.ts`.

## Decisions

### Data flow

```
webapp                     domain                         data
AppSettingsProvider ─┐
  (first read)       ├──▶ GetAppSettingsUseCase ─┐
use cases' callers ──┘     16 use cases ─────────┼──▶ AppSettingsRepository.get()
                                                 │      └─ cache.getOrFuture("settings", getSettings())
                                                 │           ├─ hit  → remembered AppSettings
                                                 │           └─ miss → DHIS2 (dataStore | constant) → remember on success
Settings page ──────────▶ SaveAppSettingsUseCase ┴──▶ AppSettingsRepository.save()
                                                        └─ DHIS2 write → cache.set("settings", saved)
```

The domain and webapp layers do not change; only the repositories in `data/` read and write through the cache.

### `InmemoryCache` from sharing-settings-app-dev, plus `set`

The same class is copied across EyeSeeTea apps. Versions found:

| Repo | API | Fit |
|------|-----|-----|
| metadata-synchronization, d2-reports | `getOrPromise` | Promise-based; this project uses `FutureData` in `domain/` and `data/` |
| d2-audit-report | `getOrFuture(key, () => future)` | Its own `Future` (not fluture, error type `Error`) |
| uhcpw | `getOrFuture(key, future)` | Same fluture-based `Future` as this project, but a truthy check misses falsy cached values |
| **sharing-settings-app-dev** | `getOrFuture(key, future)` | **Same `Future` class and `FutureData<D> = Future<string, D>` as this project**; checks `!== undefined` |

Take `getOrFuture` from `sharing-settings-app-dev/src/data/cache/InmemoryCache.ts`, at `src/data/cache/InmemoryCache.ts` (the path that repo uses), importing this project's `Future`. Add `set(key, value)` so `save()` can replace the remembered value. Leave out `get`, `getKeys` and `clear`: nothing here uses them, and they can be copied when something does. Unlike the other apps, the class is generic over the cached value (`InmemoryCache<T>`, one cache per value type): each settings repository caches a single type, and it avoids the `as T` downcast the shared version needs (`rules/lang/typescript.md`). `set` replaces the internal record instead of mutating it. Failed futures are not stored (`map` only runs on success), so the next read retries.

### Cache as a private field of each repository, not a decorator

`private cache = new InmemoryCache<AppSettings>()` in `AppSettingsD2Repository` and `AppSettingsD2ConstantRepository`, as the other EyeSeeTea apps do (`InstanceDefaultRepository`, `UserD2Repository`). The duplication is a field plus two lines per repository. Alternative considered: a `CachedAppSettingsRepository` decorator wired in `CompositionRoot.ts`; rejected to follow the established convention and keep the composition root unchanged.

### No in-flight deduplication

`AppSettingsProvider` renders nothing until its read completes, so that read always fills the cache before any use case runs. Concurrent first reads cannot happen in the current app.

### Tests: the cache as a unit, not the repositories

Following metadata-synchronization (`InmemoryCache.spec.ts`), the cache is tested through its public API, one behavior per test, with `Future` instead of `Promise`. The repositories are not unit-tested: what they add (read through the cache, update it on save) is integration with DHIS2, and the project has no repository tests or HTTP mock server. The "one request per page load" behavior is checked in the smoke test (browser Network tab), for both storages.

### `useReplicateUserFromTemplate` reads from the context

Use `useAppSettingsContext()` (already used by the rest of the app) instead of `useAppSettings()`. This removes the second load and makes the dialog see settings saved during the session.

## Risks / Trade-offs

- [Settings changed elsewhere are not seen until reload] → Accepted (proposal.md → What Changes). Same as the UI today.
- [`getOrFuture` checks the cache when the future is built, not when it runs] → Use cases build the future in `execute()` and run it right away, so the check happens at the right time. Documented in the design; no change needed.
- [The cached `AppSettings` is shared by every reader] → `AppSettings` is an immutable `Struct`; `validateUserAndBuild` returns a new instance, so no reader can alter the cached value.
- [The constants storage may not be reachable] → `App.tsx` reads `process.env.REACT_APP_STORAGE`, which Vite does not expose (only `VITE_*` or `define`), so the app likely always uses the dataStore. Out of scope here; the smoke test checks the constants storage with a temporary local change and the result is reported in the PR.

## Migration Plan

No data migration. Rollback: revert the commits; behavior returns to one request per read.
