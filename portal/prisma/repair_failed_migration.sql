-- Pre-deploy repairs. Runs via `prisma db execute` before `prisma migrate
-- deploy` (see vercel.json); every statement is idempotent and affects zero
-- rows/connections when there is nothing to repair.

-- 1) Clear the failed/incomplete record left behind by the bogus
-- "20260623155138_add_handover" migration that was applied (and failed)
-- during an earlier deploy. Its directory has since been removed, but the
-- unfinished row in _prisma_migrations causes `prisma migrate deploy` to abort
-- with P3009 ("migrate found failed migrations in the target database").
--
-- Only unfinished rows are removed, so this is safe and idempotent: if the row
-- does not exist (or was already cleared) it simply affects zero rows.
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20260623155138_add_handover'
  AND "finished_at" IS NULL;

-- 2) Free an orphaned migration advisory lock. While `migrate deploy` still
-- ran through the Neon pooler (PgBouncer), its session-level
-- pg_advisory_lock(72707369) could stick to a pooled backend connection that
-- never closes — after which every deploy timed out with P1002 ("Timed out
-- trying to acquire a postgres advisory lock"). Terminate only connections
-- that actually hold this exact lock; a deploy that is legitimately migrating
-- right now would be interrupted, but its next attempt succeeds — whereas an
-- orphaned lock blocks every deploy forever.
SELECT pg_terminate_backend(l.pid)
FROM pg_locks l
WHERE l.locktype = 'advisory'
  AND l.classid = 0
  AND l.objid = 72707369
  AND l.granted
  AND l.pid <> pg_backend_pid();
