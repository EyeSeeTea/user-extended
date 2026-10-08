## Purpose

Defines how the app loads its settings from DHIS2, reuses them during a session, and applies changes saved by an admin, so that every feature works from the same settings without repeated requests.

## ADDED Requirements

### Requirement: Settings are fetched once per page load
The app SHALL request its settings from the server once per page load and serve every later read in that page load (UI and use cases) from that result, whichever storage is configured (dataStore or constants).

#### Scenario: Browsing the app after it loads
- **WHEN** the app has loaded and the user paginates, searches, switches tabs, opens the edit page, exports users, sets or resets passwords, or replicates a user
- **THEN** no further settings request is sent to the server

#### Scenario: Settings were never saved
- **WHEN** the instance has no stored settings
- **THEN** the app uses the default settings and requests them from the server only once

### Requirement: Saved settings apply immediately in the same session
When settings are saved successfully, every later read in the same page load SHALL return the saved settings, without a new request to the server.

#### Scenario: Admin saves settings
- **WHEN** an admin saves new settings
- **THEN** the users list, export, password actions, column preferences and replicate user use the new values without a reload

### Requirement: A failed read is retried
A settings read that fails SHALL NOT be remembered; the next read SHALL request the settings from the server again.

#### Scenario: Server error on the first read
- **WHEN** the first settings request fails
- **THEN** the next feature that needs the settings requests them from the server again
