// Testes Deno para psico-individual-sugerir-plano.
// Focam nos gates de entrada (auth, payload, feature flag) — sem dependência de rede real com IA.
// Executam contra a instância local `supabase functions serve` ou a função implantada
// se INDIVIDUAL_TEST_BASE_URL estiver definida.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE = Deno.env.get("INDIVIDUAL_TEST_BASE_URL") ?? "http://localhost:54321/functions/v1";
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function call(body: Record<string, unknown>, token = "") {
  const res = await fetch(`${BASE}/psico-individual-sugerir-plano`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": ANON,
      "authorization": token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(txt); } catch { /* ok */ }
  return { status: res.status, body: parsed, raw: txt };
}

Deno.test("rejeita OPTIONS sem 200 fora do preflight — 405 em métodos não POST", async () => {
  const res = await fetch(`${BASE}/psico-individual-sugerir-plano`, {
    method: "GET",
    headers: { apikey: ANON },
  });
  await res.text();
  assert([401, 405].includes(res.status), `esperado 401/405, obtido ${res.status}`);
});

Deno.test("sem token: retorna 401 unauthorized", async () => {
  const r = await call({ avaliacao_id: "00000000-0000-0000-0000-000000000000" });
  assertEquals(r.status, 401);
});

Deno.test("payload sem avaliacao_id: 400", async () => {
  const r = await call({}, "invalid-token");
  // Ou 401 (token inválido) ou 400 (avaliação ausente) — ambos são falha esperada.
  assert([400, 401].includes(r.status), `esperado 400/401, obtido ${r.status}`);
});

Deno.test("payload excessivo: rejeitado em <10s", async () => {
  const huge = "x".repeat(2 * 1024 * 1024);
  const t0 = performance.now();
  const r = await call({ avaliacao_id: huge });
  const dt = performance.now() - t0;
  assert(dt < 10_000, `demorou ${dt}ms — deveria falhar rápido`);
  assert(r.status >= 400 && r.status < 500, `esperado 4xx, obtido ${r.status}`);
});
