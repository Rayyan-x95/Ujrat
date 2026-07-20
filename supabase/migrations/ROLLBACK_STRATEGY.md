# Migration Rollback Strategy

## Policy
All migrations in `supabase/migrations/` must include a `-- DOWN` comment block describing the rollback operation. For the consolidated `000_baseline.sql`, rollback is not supported (fresh install only). For incremental migrations, rollback is documented but not tested in CI.

## Rollback Instructions

### Per-Migration Rollback

Run the rollback SQL in a Supabase SQL editor or via `supabase db execute`:

```bash
# Example: rollback migration 026
supabase db execute --file supabase/migrations/rollback/026_rollback.sql
```

### Emergency Full Rollback

If a migration corrupts production data:

1. **Stop all traffic** - scale Vercel to 0, disable Supabase functions
2. **Restore from PITR** - Point-in-Time Recovery in Supabase Dashboard
3. **Verify data integrity** - run `supabase db verify`
4. **Reapply migrations** from clean baseline

## Migration Development Rules

| Rule | Enforcement |
|------|-------------|
| Every migration has `-- DOWN` block | Code review |
| No `DROP COLUMN` without 2-migration deprecation | CI lint |
| No `ALTER TABLE ... DROP CONSTRAINT` without replacement | CI lint |
| Backward-compatible only (additive) | CI lint |

## Rollback Templates

### Add Column
```sql
-- UP
ALTER TABLE invoices ADD COLUMN new_field TEXT;

-- DOWN
ALTER TABLE invoices DROP COLUMN new_field;
```

### Add Index
```sql
-- UP
CREATE INDEX idx_invoices_new ON invoices(new_field);

-- DOWN
DROP INDEX idx_invoices_new;
```

### Add FK with CASCADE
```sql
-- UP
ALTER TABLE payments ADD CONSTRAINT fk_payments_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- DOWN
ALTER TABLE payments DROP CONSTRAINT fk_payments_invoice;
```

### RLS Policy Change
```sql
-- UP
CREATE POLICY "Owner access" ON table FOR ALL USING (...);

-- DOWN
DROP POLICY "Owner access" ON table;
```

## Testing Rollbacks Locally

```bash
# Start local Supabase
supabase start

# Apply migration
supabase db reset

# Test rollback manually in SQL editor
# Copy -- DOWN block and execute

# Verify schema matches expected
supabase db diff --schema public
```

## Production Rollback Checklist

- [ ] Traffic stopped
- [ ] PITR restore point selected (pre-migration)
- [ ] Rollback executed
- [ ] `supabase db verify` passes
- [ ] Smoke test critical paths (login, portal, invoice)
- [ ] Traffic restored
- [ ] Incident logged

## Known Irreversible Migrations

| Migration | Reason |
|-----------|--------|
| `000_baseline.sql` | Fresh install only, use PITR |
| `026_mark_invoice_paid_transactional.sql` | Data transformation, use PITR |
| Any `DELETE FROM` or `TRUNCATE` | Data loss, use PITR |