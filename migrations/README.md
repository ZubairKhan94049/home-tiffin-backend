# Migrations

Incremental schema changes live here as plain `.sql` files, applied in filename
order. Prefix each file with the date so they sort chronologically:

```
YYYYMMDD_short_description.sql
e.g. 20260705_add_orders_promo_code.sql
```

Apply a migration with:

```
node scripts/run-sql.js migrations/<file>.sql
```

The base schema is `sql/schema.sql` (destructive DROP + CREATE, used for fresh
setups only). Never edit an applied migration; add a new one instead.
