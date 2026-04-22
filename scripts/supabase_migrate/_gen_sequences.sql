-- Generate setval() statements for every serial sequence in public.
-- Executed with `psql -Atq -o ...` to write a ready-to-replay script.
SELECT
  format(
    'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true);',
    pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname),
    a.attname,
    n.nspname,
    c.relname
  )
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) IS NOT NULL
ORDER BY c.relname, a.attname;
