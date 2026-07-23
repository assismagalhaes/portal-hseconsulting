// Testes Deno para psico-individual-validar-convite.
// Cobrem: token ausente, malformado, e resposta a payload malicioso.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE = Deno.env.get("INDIVIDUAL_TEST_BASE_URL") ?? "http://localhost:54321/functions/v1";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function call(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/psico-individual-validar-convite`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  return { status: res.status, txt };
}

Deno.test("token ausente: 400", async () => {
  const r = await call({});
  assert([400, 401].includes(r.status));
});

Deno.test("token malformado: 400/401", async () => {
  const r = await call({ token: "!!! caracteres inválidos !!!" });
  assert([400, 401, 403].includes(r.status), `obtido ${r.status}`);
});

Deno.test("token inexistente: 401/404 e nunca vaza detalhes internos", async () => {
  const r = await call({ token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  assert([400, 401, 403, 404].includes(r.status));
  assert(!/service_role|SUPABASE_URL|SERVICE_KEY/i.test(r.txt), "vazamento de secret");
});
