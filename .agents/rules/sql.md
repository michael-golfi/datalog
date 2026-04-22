# SQL Coding Style

Based on the professional conventions established by Graphile Starter's `000001.sql`
and adapted for this workspace when SQL is used.

## General

- Use **lowercase** for all SQL reserved words: `select`, `from`, `where`, `create table`, `insert into`, `alter table`, `grant`, `revoke`, etc.
- Use **lowercase** for built-in types and functions: `uuid`, `timestamptz`, `jsonb`, `now()`, `gen_random_uuid()`, `citext`.
- 2-space indentation for continued clauses and block bodies.
- One column or constraint per line in table definitions.
- Terminate every statement with `;`.

## Comments

- Every table, column, function, and trigger **must** have a `COMMENT ON` statement.
  ```sql
  comment on table app_public.users is
    E'A user who can log in to the application.';

  comment on column app_public.users.username is
    E'Public-facing username (or ''handle'') of the user.';
  ```
- Use block comments (`/* ... */`) for section headers and multi-line explanations before major blocks.
- Use single-line comments (`--`) for inline clarifications and Graphile metadata headers.
- Start each migration file with a block comment explaining its purpose.

## Schema Organization

- Separate concerns into schemas:
  - `app_public` — API-visible entities and functions.
  - `app_private` — internal data (passwords, tokens, secrets).
  - `app_hidden` — helper functions not exposed to the API.
- Order within a migration: schemas → grants → tables → functions → triggers → indexes → policies → column grants.
- One table per logical section. Use `--! split:` markers for Graphile Migrate file partitioning when needed.

## Table Definitions

- Define primary keys explicitly:
  ```sql
  create table app_public.users (
    id uuid primary key default gen_random_uuid(),
    ...
  );
  ```
- Include `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` on all user-facing tables.
- Use `citext` for case-insensitive text comparisons (emails, usernames).
- Define CHECK constraints inline when short; name them explicitly when complex:
  ```sql
  constraint user_emails_must_be_verified_to_be_primary
    check(is_primary is false or is_verified is true)
  ```
- Foreign keys must specify `on delete` behavior explicitly.

## Row-Level Security (RLS)

- Enable RLS on **every** table as a separate statement after creation:
  ```sql
  alter table app_public.users enable row level security;
  ```
- Define named RLS policies with descriptive action/scope names:
  - `select_all` — public read access
  - `select_own` — read only own rows
  - `update_self` — update only own row
  - `insert_own` — insert only for self
  - `delete_own` — delete only own rows
- Never grant `all` privileges to the visitor role.

## Indexes

- Create explicit named indexes for all foreign keys and common query patterns.
- Naming conventions:
  - Standard: `<table>_<column>_idx` (e.g., `sessions_user_id_idx`)
  - Unique: `uniq_<table>_<purpose>` (e.g., `uniq_user_emails_verified_email`)
  - Descriptive: `idx_<table>_<purpose>` (e.g., `idx_user_emails_primary`)
- Use partial indexes for conditional uniqueness:
  ```sql
  create unique index uniq_user_emails_verified_email
    on app_public.user_emails(email)
    where (is_verified is true);
  ```

## Functions & Triggers

- Security-sensitive functions must use:
  ```sql
  language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
  ```
- Name triggers with numeric prefix for execution ordering:
  - `_100_timestamps` — timestamp management (runs first)
  - `_200_validation` — data validation
  - `_500_audit` — audit/logging
  - `_900_notifications` — notification dispatch (runs last)
- Name helper functions with double-underscore convention: `tg__timestamps`, `tg__add_job`.
- Every function must have a `COMMENT ON FUNCTION` describing its purpose and arguments.

## Grants

- Grant schema access first, then default privileges, then table/function grants.
- Use parameterized role placeholders (`:DATABASE_OWNER`, `:DATABASE_VISITOR`) where the migration tool supports them.
- Grant least privilege. Use column-scoped grants where appropriate:
  ```sql
  grant update(username, name, avatar_url) on app_public.users to :DATABASE_VISITOR;
  grant insert (email) on app_public.user_emails to :DATABASE_VISITOR;
  ```
- Grant execute on functions explicitly.
- Never grant `all` on tables to the visitor role.
- Use comments to explain non-obvious grant decisions (e.g., why `delete` is not granted).

## Guardrails

- Never edit committed SQL migrations after they land.
- Use the `owner` role for migration and maintenance only.
- Application queries run through the `authenticator`/`visitor` role chain.
