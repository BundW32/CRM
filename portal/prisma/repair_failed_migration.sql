-- One-time repair: clear the failed/incomplete record left behind by the
-- bogus "20260623155138_add_handover" migration that was applied (and failed)
-- during an earlier deploy. Its directory has since been removed, but the
-- unfinished row in _prisma_migrations causes `prisma migrate deploy` to abort
-- with P3009 ("migrate found failed migrations in the target database").
--
-- Only unfinished rows are removed, so this is safe and idempotent: if the row
-- does not exist (or was already cleared) it simply affects zero rows.
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20260623155138_add_handover'
  AND "finished_at" IS NULL;
