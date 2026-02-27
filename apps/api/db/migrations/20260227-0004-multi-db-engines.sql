BEGIN;

ALTER TABLE db_connections
  DROP CONSTRAINT IF EXISTS db_connections_database_engine_check;

ALTER TABLE db_connections
  ADD CONSTRAINT db_connections_database_engine_check
  CHECK (database_engine IN ('postgresql', 'mysql', 'sqlite', 'sqlserver'));

COMMIT;
