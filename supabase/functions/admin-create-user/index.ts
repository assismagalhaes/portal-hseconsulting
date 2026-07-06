import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: apenas administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const { email, nome, role, telefone, cargo, area, registro_profissional } = body || {};
    if (!email || !nome) return json({ error: "email e nome são obrigatórios" }, 400);
    const perfil = ["admin", "comercial", "tecnico", "financeiro"].includes(role) ? role : "tecnico";

    // cria usuário — senha aleatória; o convite é enviado por invite link
    const { data: created, error: cErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, role: perfil },
    });
    if (cErr) return json({ error: cErr.message }, 400);
    const userId = created.user?.id;
    if (!userId) return json({ error: "Falha ao criar usuário" }, 500);

    // upsert de profile
    await admin.from("profiles").upsert({
      id: userId, email, nome, telefone, cargo, area, registro_profissional, status: "ativo",
    }, { onConflict: "id" });

    // garante o papel (o trigger handle_new_user já insere, mas garantimos)
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: perfil });

    await admin.from("internos_logs_acesso").insert({
      user_id: callerId,
      acao: "usuario_criado",
      detalhe: `${email} (${perfil})`,
    });

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}