import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);

test("database contract protects session creation behind token RPCs", () => {
  assert.match(schema, /create table if not exists public\.cafe_tables/i);
  assert.match(schema, /create or replace function public\.start_table_session/i);
  assert.match(schema, /create or replace function public\.restore_table_session/i);
  assert.match(schema, /digest\([\s\S]*'sha256'/i);
  assert.match(schema, /revoke all on public\.sessions from anon, authenticated/i);
  assert.doesNotMatch(schema, /create policy[^;]+sessions[^;]+for insert/is);
});

test("database contract enforces exact one-hour sessions and order validation", () => {
  assert.match(
    schema,
    /check \(expires_at = created_at \+ interval '1 hour'\)/i,
  );
  assert.match(schema, /session_row\.table_number <> p_table_number/i);
  assert.match(schema, /session_row\.expires_at <= now\(\)/i);
});

test("database contract includes served, paid, reset, and realtime behavior", () => {
  assert.match(
    schema,
    /status in \('NEW', 'PREPARING', 'READY', 'SERVED', 'PAID', 'REJECTED'\)/i,
  );
  assert.match(schema, /where status in \('PAID', 'REJECTED'\)/i);
  assert.match(schema, /alter publication supabase_realtime add table public\.orders/i);
  assert.match(
    schema,
    /alter publication supabase_realtime add table public\.order_items/i,
  );
});
