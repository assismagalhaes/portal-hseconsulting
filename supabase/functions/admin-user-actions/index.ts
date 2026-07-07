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
      case "reset_password":
      case "resend_invite": {
        // Gera nova senha provisória e marca profile
        const senhaProvisoria = generatePassword(12);
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          password: senhaProvisoria,
        } as any);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ senha_provisoria: true }).eq("id", user_id);
        detalhe = `Nova senha provisória gerada para ${email}`;
        await admin.from("internos_logs_acesso").insert({
          user_id: callerId, acao: `admin_${action}`, detalhe,
        });

        // Busca o nome do usuário para personalizar o e-mail
        const { data: prof } = await admin.from("profiles").select("nome").eq("id", user_id).maybeSingle();
        const origin = req.headers.get("origin") || "https://portal-hseconsulting.lovable.app";
        let emailEnviado = false;
        let emailErro: string | null = null;
        try {
          const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "credenciais-acesso",
              recipientEmail: email,
              idempotencyKey: `credenciais-${user_id}-${Date.now()}`,
              templateData: {
                nome: prof?.nome || "usuário",
                email,
                senhaProvisoria,
                portalUrl: `${origin}/auth`,
                reativado: false,
              },
            },
          });
          if (mailErr) {
            emailErro = mailErr.message;
            console.error("Falha ao enviar credenciais por e-mail:", mailErr);
          } else {
            emailEnviado = true;
          }
        } catch (e) {
          emailErro = (e as Error).message;
          console.error("Erro ao invocar send-transactional-email:", e);
        }

        return json({
          ok: true,
          email,
          senha_provisoria: senhaProvisoria,
          email_enviado: emailEnviado,
          email_erro: emailErro,
        });
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
        // Soft-delete: bane no auth, remove papéis/overrides e marca profile como excluído.
        // Não fazemos hard-delete porque muitas tabelas de histórico referenciam auth.users
        // com ON DELETE NO ACTION e a remoção física quebraria a integridade.
        const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        } as any);
        if (banErr) return json({ error: banErr.message }, 400);

        const { error: rolesErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
        if (rolesErr) return json({ error: `Erro ao remover perfil de acesso: ${rolesErr.message}` }, 400);

        const { error: overridesErr } = await admin.from("user_permission_overrides").delete().eq("user_id", user_id);
        if (overridesErr) return json({ error: `Erro ao remover permissões granulares: ${overridesErr.message}` }, 400);

        const { data: updatedProfile, error: profileErr } = await admin
          .from("profiles")
          .update({ status: "excluido" })
          .eq("id", user_id)
          .select("id, status")
          .maybeSingle();

        if (profileErr) return json({ error: `Erro ao marcar usuário como excluído: ${profileErr.message}` }, 400);
        if (!updatedProfile || updatedProfile.status !== "excluido") {
          return json({ error: "Não foi possível confirmar a exclusão do usuário." }, 400);
        }

        detalhe = `Usuário ${email || user_id} excluído (soft-delete)`;
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

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out + "!";
}