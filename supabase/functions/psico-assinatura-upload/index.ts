import { createClient } from "npm:@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BYTES = 2 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function detectImage(bytes: Uint8Array): { mime: "image/png" | "image/jpeg"; ext: "png" | "jpg" } | null {
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (png) return { mime: "image/png", ext: "png" };
  const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  return jpeg ? { mime: "image/jpeg", ext: "jpg" } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METODO_NAO_PERMITIDO" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "NAO_AUTENTICADO" }, 401);

    const contentType = req.headers.get("content-type") ?? "";
    let targetUserId = authData.user.id;
    let mode = "imagem";
    let file: File | null = null;
    if (contentType.includes("application/json")) {
      const body = await req.json();
      targetUserId = String(body?.responsavel_tecnico_id ?? authData.user.id);
      mode = String(body?.modo ?? "em_branco");
    } else {
      const form = await req.formData();
      targetUserId = String(form.get("responsavel_tecnico_id") ?? authData.user.id);
      file = form.get("arquivo") as File | null;
    }

    const { data: roleRows } = await userClient.from("user_roles").select("role").eq("user_id", authData.user.id);
    const isAdmin = (roleRows ?? []).some((row: { role: string }) => row.role === "admin");
    if (targetUserId !== authData.user.id && !isAdmin) return json({ error: "FORBIDDEN" }, 403);
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: "RESPONSAVEL_INVALIDO" }, 400);

    if (mode === "em_branco") {
      const { error } = await admin.from("profiles").update({ assinatura_modo: "em_branco" }).eq("id", targetUserId);
      if (!error) await admin.from("psico_auditoria").insert({ entidade: "profile", entidade_id: targetUserId, acao: "assinatura_relatorio_em_branco", metadados: { alterado_por: authData.user.id }, usuario_id: authData.user.id });
      return error ? json({ error: "CONFIGURACAO_NAO_SALVA", detalhe: error.message }, 400) : json({ ok: true, modo: "em_branco" });
    }

    if (!file || file.size === 0 || file.size > MAX_BYTES) return json({ error: "ARQUIVO_INVALIDO_OU_MAIOR_QUE_2MB" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return json({ error: "CONTEUDO_NAO_E_PNG_OU_JPEG" }, 400);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const path = `${targetUserId}/${crypto.randomUUID()}.${detected.ext}`;
    const upload = await admin.storage.from("psico-assinaturas").upload(path, bytes, { contentType: detected.mime, upsert: false, cacheControl: "3600" });
    if (upload.error) return json({ error: "UPLOAD_FALHOU", detalhe: upload.error.message }, 400);

    const { error: updateError } = await admin.from("profiles").update({
      assinatura_modo: "imagem", assinatura_storage_path: path,
      assinatura_nome_arquivo: file.name.slice(0, 240), assinatura_mime_type: detected.mime,
      assinatura_hash_sha256: hash, assinatura_carregada_por: authData.user.id,
      assinatura_carregada_em: new Date().toISOString(), assinatura_ativa: true,
    }).eq("id", targetUserId);
    if (updateError) {
      await admin.storage.from("psico-assinaturas").remove([path]);
      return json({ error: "CONFIGURACAO_NAO_SALVA", detalhe: updateError.message }, 400);
    }
    await admin.from("psico_auditoria").insert({ entidade: "profile", entidade_id: targetUserId, acao: "assinatura_relatorio_imagem_atualizada", metadados: { mime_type: detected.mime, hash_sha256: hash, alterado_por: authData.user.id }, usuario_id: authData.user.id });
    return json({ ok: true, modo: "imagem", mime_type: detected.mime, hash_sha256: hash });
  } catch (error) {
    console.error("[psico-assinatura-upload]", { code: error instanceof Error ? error.name : "UNKNOWN" });
    return json({ error: "ERRO_INTERNO" }, 500);
  }
});
