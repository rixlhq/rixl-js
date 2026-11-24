# Spec Delta

## Purpose

Lets SDK consumers show a user where they are signed in and sign individual devices, all other devices, or every device out.

## ADDED Requirements

### Requirement: List signed-in devices

`listSignedInDevices()` SHALL return the signed-in user's devices, most recently used first. Each entry SHALL carry:

- id, created time, last-used time and expiry time;
- sign-in method;
- raw user agent, IP and country;
- a `current` flag that is true only for the device making the request;
- a parsed device summary (browser, OS, device type).

#### Scenario: Two devices

- **WHEN** a user signed in on a laptop and a phone calls `listSignedInDevices()` from the laptop
- **THEN** two entries are returned
- **AND** only the laptop entry has `current` true

#### Scenario: Unparseable user agent

- **WHEN** an entry's user agent is empty or no browser or OS can be recognized
- **THEN** the parsed summary reports an unknown browser, OS and device type

#### Scenario: Partially recognized user agent

- **WHEN** the parser recognizes the browser or OS but cannot recognize the other field
- **THEN** the summary preserves the recognized field and reports the other as unknown

### Requirement: Sign out one device

`signOutDevice(id)` SHALL revoke that device's sign-in. The gateway rejects that sign-in's access tokens immediately. Revoking the current device SHALL also clear local tokens and announce the logout to other tabs, exactly like `logout()`.

#### Scenario: Sign out another device

- **WHEN** the user signs out their phone from the laptop
- **THEN** the call resolves and the laptop stays signed in

#### Scenario: Sign out the current device

- **WHEN** the user signs out the device they are using
- **THEN** local tokens are cleared and other tabs are told to log out

### Requirement: Sign out all other devices

`signOutOtherDevices()` SHALL revoke every sign-in except the current one, and keep the current device signed in.

#### Scenario: Revoke others

- **WHEN** the user calls `signOutOtherDevices()`
- **THEN** a following `listSignedInDevices()` returns only the current device

### Requirement: Sign out everywhere

`signOutEverywhere()` SHALL revoke every sign-in including the current one, then clear local state like `logout()`. The gateway rejects every access token of those sign-ins immediately. Local state SHALL be cleared even if the request fails.

#### Scenario: Request fails

- **WHEN** `signOutEverywhere()` gets a network error
- **THEN** local tokens are still cleared and the error is reported to the caller

### Requirement: Errors are typed

The device functions SHALL surface API failures as the SDK's existing error type with the HTTP status. A missing device SHALL be reported as not found.

#### Scenario: Unknown device id

- **WHEN** `signOutDevice` is called with an id that no longer exists
- **THEN** the promise rejects with a not-found error
