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

    // Gera senha provisória (12 chars: letras + números + símbolo simples)
    const senhaProvisoria = generatePassword(12);

    // Verifica se já existe usuário com esse e-mail (pode ser um soft-delete)
    let userId: string | undefined;
    let reativado = false;
    const emailLc = String(email).toLowerCase();
    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const jaExiste: any = existingList?.users?.find((u: any) => (u.email || "").toLowerCase() === emailLc);

    if (jaExiste) {
      // Verifica se está marcado como excluído (soft-delete) para reativar
      const { data: prof } = await admin.from("profiles").select("status").eq("id", jaExiste.id).maybeSingle();
      const estaExcluido = prof?.status === "excluido" || !!jaExiste.banned_until;
      if (!estaExcluido) {
        return json({ error: `Já existe um usuário ativo cadastrado com o e-mail ${email}. Use outro e-mail ou edite o usuário existente.` }, 409);
      }
      // Reativa: remove ban e redefine senha
      const { error: upErr } = await admin.auth.admin.updateUserById(jaExiste.id, {
        password: senhaProvisoria,
        ban_duration: "none",
        email_confirm: true,
        user_metadata: { nome, role: perfil },
      } as any);
      if (upErr) return json({ error: `Não foi possível reativar o usuário: ${upErr.message}` }, 400);
      userId = jaExiste.id;
      reativado = true;
    } else {
      // Cria usuário já confirmado com senha provisória — SEM convite por link
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: senhaProvisoria,
        email_confirm: true,
        user_metadata: { nome, role: perfil },
      });
      if (cErr) {
        const msg = /already.*registered|email.*exists/i.test(cErr.message)
          ? `Já existe um usuário cadastrado com o e-mail ${email}.`
          : cErr.message;
        return json({ error: msg }, 400);
      }
      userId = created.user?.id;
    }
    if (!userId) return json({ error: "Falha ao criar usuário" }, 500);

    // upsert de profile — marca como senha provisória
    await admin.from("profiles").upsert({
      id: userId, email, nome, telefone, cargo, area, registro_profissional,
      status: "ativo", senha_provisoria: true,
    }, { onConflict: "id" });

    // garante o papel (o trigger handle_new_user já insere, mas garantimos)
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role: perfil });

    await admin.from("internos_logs_acesso").insert({
      user_id: callerId,
      acao: reativado ? "usuario_reativado" : "usuario_criado",
      detalhe: `${email} (${perfil})${reativado ? " — reativado" : ""}`,
    });

    // Envia e-mail com credenciais (best-effort — não bloqueia a criação em caso de falha)
    let emailEnviado = false;
    let emailErro: string | null = null;
    try {
      const origin = req.headers.get("origin") || "https://portal-hseconsulting.lovable.app";
      const { error: mailErr } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "credenciais-acesso",
          recipientEmail: email,
          idempotencyKey: `credenciais-${userId}-${Date.now()}`,
          templateData: {
            nome,
            email,
            senhaProvisoria,
            portalUrl: `${origin}/auth`,
            reativado,
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
      user_id: userId,
      email,
      senha_provisoria: senhaProvisoria,
      reativado,
      email_enviado: emailEnviado,
      email_erro: emailErro,
    });
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

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  // garante ao menos um símbolo
  return out + "!";
}