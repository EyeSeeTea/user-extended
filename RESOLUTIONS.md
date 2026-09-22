# Dependency resolutions

`package.json` records which versions enter the dependency tree. It cannot record why. A resolution
overrides the version that another package requests, so a later developer needs the reason to decide
whether to keep it, change it or remove it. Without a reason, the `resolutions` block grows into a
set of constraints that nobody can maintain.

This file gives that reason. It also records dependency decisions that leave no trace in the
manifest: findings that have no fix, and constraints that are not about security.

Add, change or remove a resolution and its entry here in the same commit.

## How to read an entry

-   **Why** — the dependency path that needs the constraint, and why a normal upgrade does not work.
-   **Fixes** — the advisory or the compatibility problem.
-   **Drop when** — the condition that lets you remove the entry.

Every entry uses a compatible range, not an exact version. A range states a floor: _never below
this_. It lets later patches enter the tree on their own. An exact version freezes the dependency
and blocks the next patch, so use one only when something binds to that release, and say what binds
it.

Two entries (`i18next` and `vite`) need an upper bound as well as a floor. A caret range gives both:
it admits every patch inside the major, and it stops at the next one. Neither entry needs an exact
version to do that.

## Resolutions

### `axios` — `^1.18.0`

**Why:** `@eyeseetea/d2-api` requests `axios` at exactly `1.6.4`. `@eyeseetea/feedback-component`
requests `^0.27.2`. Neither range admits a patched release, and the application itself uses `axios`
at runtime. The floor collapses all three consumers onto one supported line.

**Fixes:** GHSA-gcfj-64vw-6mp9 and a further nine advisories against the 1.x line below 1.18.0. The
0.27.x line carries more than twenty open advisories and receives no patches.

**Drop when:** every consumer requests a range that admits 1.18.0 or later.

### `i18next` — `^19.8.5`

**Why:** `i18next-scanner` requests `*`. `@dhis2/d2-i18n` requests `^10.3`. Without a constraint the
scanner pulls i18next 26, whose bundled type definitions use syntax that TypeScript 4.9.5 cannot
parse. `tsc` then fails with parse errors inside `node_modules`. The upper bound does the work here.
The range keeps patches available inside the 19.x line.

**Fixes:** a compatibility problem, not an advisory. Published i18next advisories affect releases up
to 3.4.4 only, so no consumer in this tree is exposed.

**Drop when:** TypeScript moves to a version that parses the current i18next type definitions.

### `linkify-it@npm:^2.0.3` — `^5.0.2`

**Why:** `@eyeseetea/d2-ui-components` depends on `react-linkify@1.0.0-alpha`, which requests
`^2.0.3`. The advisory has one patched release, 5.0.2. `linkify-it@2.2.0` is the last release on the
2.x line, and no backport exists on the 2.x, 3.x or 4.x lines, so no upgrade inside the requested
range is possible. The resolution is scoped to that one descriptor. Other consumers keep their own
ranges.

`react-linkify` constructs the module with `new LinkifyIt()` and calls `.tlds()` and `.match()`.
Version 5 still provides all three, and it still ships a CommonJS build for the `require` that
`react-linkify` uses.

**Fixes:** GHSA-v245-v573-v5vm.

**Drop when:** `react-linkify` requests a range that admits 5.0.2 or later, or the application stops
using it.

### `lodash` — `^4.18.0`

**Why:** `@eyeseetea/d2-api` and `@eyeseetea/d2-ui-components` both request `lodash` at exactly
`4.17.21`. Remove the constraint and the tree resolves _downwards_ to that version. A floor is still
needed here; it only has to be a range instead of an exact version.

**Fixes:** GHSA-r5fr-rjxr-66jc, patched in 4.18.0.

**Drop when:** both packages request a range that admits 4.18.0 or later.

### `node-fetch` — `^2.7.0`

**Why:** `isomorphic-fetch` 2.x requests `^1.0.1`, and the 1.x line has no patched release. The floor
is `^2.7.0` and not a lower 2.x version because `cross-fetch` 3.x and 4.x both declare `^2.7.0`. A
lower constraint would hold those two below the range they declare for themselves.

**Fixes:** GHSA-r683-j2x4-v87g.

**Drop when:** `isomorphic-fetch` leaves the tree, or requests a 2.x range.

### `node-gettext` — `^3.0.1`

**Why:** `@dhis2/d2-i18n-generate` requests `^2.0.0`. The advisory affects every release up to and
including 3.0.0, so the fix sits outside the requested major.

The advisory records no patched version, which makes tooling report it as unfixable. It is not.
Its affected range is `<= 3.0.0`, and 3.0.1 is published and outside that range. Check the affected
range against the published version list, not only the patched-version field.

**Fixes:** GHSA-g974-hxvm-x689.

**Drop when:** `@dhis2/d2-i18n-generate` requests a range that admits 3.0.1, or the package is
replaced.

### `qs` — `^6.16.0`

**Why:** one consumer requests `qs` at exactly `6.9.7` and another requests `^6.12.3`. Neither range
admits the patched release. `@eyeseetea/d2-api` reaches `qs` at runtime, so verify this constraint
with the test suite and a production build, not with `yarn install` alone. The application's own
direct dependency was itself held exact at `6.15.2`, which is what let the floor decay: raising the
`resolutions` range alone is not enough while the direct entry pins below it.

**Fixes:** GHSA-q8mj-m7cp-5q26. The 6.9.7 release also carries GHSA-w7fw-mjwx-w883 and
GHSA-6rw7-vpxm-498p. The floor moved from `^6.15.2` to `^6.16.0` for GHSA-4mjr-xmp4-gh2g and
GHSA-x5fp-wj9c-mxmx, both fixed in 6.16.0.

**Drop when:** every consumer requests a range that admits 6.16.0 or later.

### `vite` — `^6.4.3`

**Why:** `vitest` and `vite-node` request `^5.0.0 || ^6.0.0 || ^7.0.0-0`. Without a constraint they
install a second vite on the 7.x line beside the one the application builds with. The test runner
then transforms the source with a different toolchain from the one that produces the bundle.

**Fixes:** a duplicate build toolchain, not an advisory.

**Drop when:** the application moves to vite 7. Move the range with it.

## Findings with no fix available

None of these has a fix that can currently be applied: two have no published fix at all,
and one has a published fix that cannot be installed without breaking its consumer. All
three are scored below the critical/high threshold that the CI gate reads.

### `react-router` and `react-router-dom` 6.30.6

**Chain:** direct dependency `react-router-dom@6.30.6` → `react-router@6.30.6`.

**Why it cannot be fixed:** GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg are patched in 7.18.0 only.
Version 7 changes the routing API, so it is a migration and not a bump. GHSA-jjmj-jmhj-qwj2 is no
longer in this entry: it was fixed in 6.30.6, so bumping the direct dependency from 6.30.4 closed it.
Check the affected range against the published version list before recording "no fix", not only the
advisory's patched-version field: this is why that one moved out of this section instead of staying
here indefinitely.

**Impact:** runtime code that ships to users.

**Reachability:** both remaining advisories concern redirect targets that the calling application
passes to the router. They are not reachable through the library's own internal navigation.

**Severity note:** scored medium by both the local audit and the workflow scan, so the CI gate does
not block on them.

**Review condition:** a 6.x release that carries the fix, or a planned migration to react-router 7.

### `elliptic` 6.6.1

**Chain:** `vite-plugin-node-polyfills` → `node-stdlib-browser` → `crypto-browserify` →
`browserify-sign` and `create-ecdh` → `elliptic`.

**Why it cannot be fixed:** GHSA-848j-6mx2-7j84 affects every release up to and including 6.6.1,
which is the latest published release. No patched version exists, on any line.

**Impact:** the polyfill is bundled into the browser build, so this is runtime code.

**Reachability:** the advisory concerns ECDSA signature verification. `crypto-browserify` reaches
that code through `browserify-sign` and `create-ecdh`.

**Severity note:** scored low.

**Review condition:** an `elliptic` release above 6.6.1.

### `decode-uri-component` 0.2.2

**Chain:** `@testing-library/jest-dom` → `css@3.0.0` → `source-map-resolve@0.6.0` →
`decode-uri-component@^0.2.0`.

**Why it cannot be fixed:** GHSA-vcc3-ghjq-m6fr is patched in 0.5.0. `source-map-resolve@0.6.0` is
its last published release and still requests `decode-uri-component@^0.2.0`, so there is no newer
parent release to pick up the fix. Forcing `decode-uri-component` to 0.5.0 with a resolution installs
cleanly and fails at load: 0.2.x ships plain CommonJS, 0.5.0 is `"type": "module"` with no `main`
field, and `source-map-resolve` calls it with `require()`. That is a broken build, not a remediation.

**Impact:** dev/test tooling only (`@testing-library/jest-dom`, used by `vitest`). Never reaches the
application bundle.

**Reachability:** the advisory is a ReDoS in percent-decoding untrusted input. `source-map-resolve`
only passes it strings already extracted from a source map by its own parser, in code that runs
against local build artifacts during tests, not untrusted input.

**Severity note:** scored medium by both the local audit and the workflow scan.

**Review condition:** `source-map-resolve` publishes a release that requests
`decode-uri-component >= 0.3` (its first non-CommonJS-incompatible move), or `@testing-library/jest-dom`
drops it.

## Withdrawn advisories

A withdrawn advisory is not remediated. It is dismissed. Scanners pick up a withdrawal at different
times, so a withdrawn advisory can stay in a report and look like ordinary work.

| Advisory            | Against        | Withdrawn  | Note                                                                                                               |
| ------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| GHSA-p5wg-g6qr-c7cg | `eslint@8.3.0` | 2026-02-03 | Reported as patched in eslint 9.26.0. That upgrade corrects nothing.                                               |
| GHSA-gv7w-rqvm-qjhr | `esbuild`      | 2026-06-17 | Reported as patched in esbuild 0.28.1. It is the only advisory that covers the esbuild release this tree installs. |

Check an advisory before you start any remediation that costs more than a version bump:

```bash
gh api advisories/<GHSA> --jq '.withdrawn_at // "not withdrawn"'
```

## Constraints that were tried and removed

These leave no trace in the current tree, so they are recorded here to stop anyone repeating them.

-   **An `esbuild` constraint above vite's own range.** `vite@6.4.3` requests `esbuild@^0.25.0`.
    Forcing esbuild to 0.28.1 made the production build fail: esbuild 0.28 and later refuse to lower
    destructuring for Safari 14.0, which is in vite's default browser target. Keeping the constraint
    needed a `build.target` override in `vite.config.ts` that raised the Safari baseline to 14.1 and so
    narrowed browser support. The only advisory covering `esbuild@0.25.12` is withdrawn, so the
    constraint bought nothing. Both the constraint and the override were removed.

-   **Exact-version constraints copied from a shared baseline.** Around thirty entries pinned packages
    that no consumer needed pinned. Their parents already requested ranges that admit a patched
    release, so a lockfile refresh was the real fix. Several held a consumer _below_ its own declared
    range: `ansi-regex@4.1.1` against `strip-ansi@7`, which declares `^6.2.2`; `semver@6.3.1` against
    `eslint` and `@typescript-eslint`, which declare `^7`; `node-fetch@2.6.7` against `cross-fetch`,
    which declares `^2.7.0`. All were removed.

    Test a constraint before you remove it. Remove the entry, install, and compare **the resolved
    versions** — not the lockfile bytes. A byte-identical lockfile proves the constraint matched no
    descriptor, but the reverse does not hold: a constraint can rewrite a descriptor, change the
    lockfile, and change nothing that installs.

## What this file must not contain

This repository is public, and so is this file. The dependency inventory it describes is public
already, because `package.json` and `yarn.lock` are in the repository. The reasoning is the part that
needs a limit.

-   Justify reachability with facts about the dependency, never with the application's own defences.
    _"The advisory affects an API that this package never calls"_ is a statement about third-party code
    that any reader can check. _"Not reachable because our code strips that input"_ stops being true as
    soon as someone changes that code without knowing this file depends on it.
-   Write nothing that is not derivable from the public tree. No internal URLs, environment names or
    infrastructure details.
-   A vulnerability in this application's own code does not belong here. That is a private security
    advisory.
-   No before/after finding counts, here or in a pull request description. A count is only true on the
    day it is written. Link to the alerts instead.
