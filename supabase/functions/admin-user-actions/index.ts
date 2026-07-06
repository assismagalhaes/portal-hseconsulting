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
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(url, service);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: apenas administradores" }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, user_id, redirect_to } = body || {};
    if (!action || !user_id) return json({ error: "action e user_id são obrigatórios" }, 400);
    if (user_id === callerId && ["block", "delete"].includes(action)) {
      return json({ error: "Você não pode aplicar esta ação em si mesmo." }, 400);
    }

    const { data: target } = await admin.auth.admin.getUserById(user_id);
    const email = target?.user?.email;
    if (!email && action !== "delete") return json({ error: "Usuário não encontrado" }, 404);

    let detalhe = email || user_id;

    switch (action) {
      case "reset_password": {
        const { error } = await admin.auth.admin.generateLink({
          type: "recovery", email: email!,
          options: { redirectTo: redirect_to || undefined },
        });
        // usa generateLink apenas para validar; envia via resetPasswordForEmail
        if (error) return json({ error: error.message }, 400);
        const { error: err2 } = await userClient.auth.resetPasswordForEmail(email!, {
          redirectTo: redirect_to || undefined,
        });
        if (err2) return json({ error: err2.message }, 400);
        detalhe = `Reset de senha enviado para ${email}`;
        break;
      }
      case "resend_invite": {
        const { error } = await admin.auth.admin.inviteUserByEmail(email!, {
          redirectTo: redirect_to || undefined,
        });
        if (error) return json({ error: error.message }, 400);
        detalhe = `Convite reenviado para ${email}`;
        break;
      }
      case "block": {
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h", // ~100 anos
        } as any);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ status: "bloqueado" }).eq("id", user_id);
        detalhe = `Usuário ${email} bloqueado`;
        break;
      }
      case "unblock": {
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        } as any);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ status: "ativo" }).eq("id", user_id);
        detalhe = `Usuário ${email} desbloqueado`;
        break;
      }
      case "delete": {
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").delete().eq("id", user_id);
        detalhe = `Usuário ${email || user_id} excluído`;
        break;
      }
      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }

    await admin.from("internos_logs_acesso").insert({
      user_id: callerId, acao: `admin_${action}`, detalhe,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}