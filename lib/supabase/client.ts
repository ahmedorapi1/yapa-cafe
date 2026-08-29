import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const isDevelopment = process.env.NODE_ENV !== "production";

let client: SupabaseClient | null = null;
let modeLogged = false;
let connectionTestStarted = false;

function logMode(configured: boolean) {
  if (!isDevelopment || modeLogged) return;
  modeLogged = true;
  console.info(
    configured
      ? "Supabase mode: ENABLED"
      : "Supabase mode: LOCAL FALLBACK",
  );

  if (!configured) {
    const missingVariables = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);
    console.warn(
      `Supabase configuration missing: ${missingVariables.join(", ")}`,
    );
  }
}

function getSafeErrorDetails(error: unknown) {
  if (!(error instanceof Object)) return error;

  const candidate = error as Record<string, unknown>;
  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
  };
}

export function logSupabaseError(operation: string, error: unknown) {
  if (!isDevelopment) return;
  console.error(
    `Supabase ${operation} failed: ${JSON.stringify(getSafeErrorDetails(error))}`,
  );
}

function startConnectionTest(supabase: SupabaseClient) {
  if (!isDevelopment || connectionTestStarted) return;
  connectionTestStarted = true;

  void supabase
    .from("orders")
    .select("id")
    .limit(1)
    .then(({ error }) => {
      if (error) {
        logSupabaseError("connection test", error);
        return;
      }
      console.info("Supabase connection successful");
    });
}

export function isSupabaseConfigured() {
  // Both legacy JWT anon keys and modern `sb_publishable_` keys are valid.
  // Presence is intentionally the only key check performed by the browser.
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabase() {
  const configured = isSupabaseConfigured();
  logMode(configured);
  if (!configured) return null;

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
    startConnectionTest(client);
  }
  return client;
}
