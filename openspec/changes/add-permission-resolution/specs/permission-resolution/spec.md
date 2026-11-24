## Purpose

Defines how `@rixl/sdk` resolves, stores and answers questions about the current identity's effective permissions, so that every consumer shares one implementation of the verb hierarchy rather than reimplementing it.

## ADDED Requirements

### Requirement: User info exposes granted policies and permissions

The SDK SHALL return the policies and effective permissions that `GET /auth/v1/userinfo` provides, rather than discarding them.

#### Scenario: Response carries policies and permissions

- **WHEN** user info is retrieved for a user holding policies
- **THEN** the returned value carries those policies and the permissions they grant

#### Scenario: Response omits them

- **WHEN** user info is retrieved and the response contains neither field
- **THEN** both are returned as empty collections rather than undefined
- **AND** all previously returned fields are unchanged

### Requirement: Permission store holds the effective set

The SDK SHALL expose a `permissions` store holding the current identity's effective permission set, readable synchronously and subscribable for change.

#### Scenario: Initial state

- **WHEN** no permissions have been resolved
- **THEN** the store holds an empty set
- **AND** every permission check against it returns `false`

#### Scenario: Subscribers observe resolution

- **WHEN** the permission set is populated
- **THEN** subscribers to the store are notified

#### Scenario: Permissions are cleared on sign-out

- **WHEN** tokens are removed on sign-out
- **THEN** the permission store is emptied so no stale grant survives sign-out

### Requirement: Permissions resolve from user info

The SDK SHALL provide `resolvePermissions`, which populates the permission store from the effective permissions reported by user info for the caller's active organization.

#### Scenario: Store is populated

- **WHEN** `resolvePermissions` is called and user info reports a set of permissions
- **THEN** the store holds exactly those permissions

#### Scenario: Revoked grants disappear

- **WHEN** `resolvePermissions` is called and user info reports fewer permissions than the store currently holds
- **THEN** the store is replaced rather than merged, so the removed grants no longer satisfy checks

#### Scenario: Resolution failure preserves the held set

- **WHEN** the user info request fails
- **THEN** the error is surfaced to the caller
- **AND** the previously held set is left untouched rather than cleared or partially replaced

### Requirement: Permission matching honors the verb hierarchy

The SDK SHALL provide `hasPermission(required)` returning whether the held set satisfies the required permission, treating write verbs as satisfying read checks. The registry grants only `read` and `write`, so no other verb is a superset of any other.

#### Scenario: Exact match

- **WHEN** the held set contains the required permission exactly
- **THEN** the check returns `true`

#### Scenario: Write implies read

- **WHEN** a read permission is required and the held set contains a write verb for the same resource
- **THEN** the check returns `true`

#### Scenario: A verb outside the hierarchy grants nothing extra

- **WHEN** the held set contains a verb the hierarchy does not define, such as `admin`, for the required resource
- **THEN** the check returns `false` unless the required permission matches it exactly

#### Scenario: Read does not imply write

- **WHEN** a write verb is required and the held set contains only a read verb for that resource
- **THEN** the check returns `false`

#### Scenario: A different resource never satisfies the check

- **WHEN** the held set contains permissions only for other resources or services
- **THEN** the check returns `false`

#### Scenario: Empty set denies everything

- **WHEN** the held set is empty
- **THEN** every check returns `false`

#### Scenario: Unrecognized permission shape

- **WHEN** a required permission contains no verb separator, or names a verb the hierarchy does not define
- **THEN** only an exact match satisfies it, and no error is thrown

### Requirement: Permission API is publicly exported

The SDK SHALL export its permission surface from the package entry point so consumers need no deep imports.

#### Scenario: Consumer imports the permission API

- **WHEN** a consumer imports from `@rixl/sdk`
- **THEN** `permissions`, `resolvePermissions`, `hasPermission` and `clearPermissions` are available
- **AND** their types are present in the emitted declarations
