import { supabase } from "@/integrations/supabase/client";

const sb: any = supabase;

export type ParticipanteRow = {
  id: string;
  avaliacao_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  funcao: string | null;
  setor: string | null;
  unidade: string | null;
  ativo: boolean;
  origem_cadastro: "manual" | "importacao";
  created_at: string;
  updated_at: string;
  funcao_normalizada: string | null;
  setor_normalizada: string | null;
  unidade_normalizada: string | null;
  nome_normalizado: string;
  email_normalizado: string | null;
  telefone_normalizado: string | null;
};

export type ConviteRow = {
  id: string;
  avaliacao_id: string;
  participante_id: string;
  public_id: string;
  token_version: number;
  status: "preparado" | "ativo" | "respondido" | "revogado" | "expirado";
  canal_distribuicao: string | null;
  distribuido_em: string | null;
  respondido_em: string | null;
  revogado_em: string | null;
  gerado_em: string;
  updated_at: string;
};

export const CONVITE_LABEL: Record<string, string> = {
  preparado: "Preparado",
  ativo: "Ativo",
  respondido: "Respondido",
  revogado: "Revogado",
  expirado: "Expirado",
};

export function mascararEmail(e?: string | null) {
  if (!e) return "—";
  const [u, d] = e.split("@");
  if (!d) return "—";
  return `${u.slice(0, 1)}***@${d}`;
}
export function mascararTelefone(t?: string | null) {
  if (!t) return "—";
  const d = t.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `(**) *****-${d.slice(-4)}`;
}
export function primeiroNome(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}

export function normTexto(v?: string | null) {
  if (!v) return null;
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim() || null;
}
export function normEmail(v?: string | null) {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  return t || null;
}
export function normFone(v?: string | null) {
  if (!v) return null;
  const t = v.replace(/\D/g, "");
  return t || null;
}
export function isEmailValido(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function isFoneValido(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

export async function listarParticipantes(avaliacaoId: string) {
  return sb
    .from("psico_participantes")
    .select("*")
    .eq("avaliacao_id", avaliacaoId)
    .order("nome", { ascending: true });
}

export async function listarConvitesDaAvaliacao(avaliacaoId: string) {
  return sb
    .from("psico_convites")
    .select("*")
    .eq("avaliacao_id", avaliacaoId);
}

export async function criarParticipante(input: {
  avaliacao_id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  funcao?: string | null;
  setor?: string | null;
  unidade?: string | null;
  origem_cadastro?: "manual" | "importacao";
  importacao_id?: string | null;
}) {
  return sb.from("psico_participantes").insert(input).select().single();
}

export async function atualizarParticipante(id: string, patch: Record<string, any>) {
  return sb.from("psico_participantes").update(patch).eq("id", id).select().single();
}

/**
 * Edição segura via RPC no backend. Aplica normalização, duplicidade,
 * bloqueio pós-resposta e auditoria sanitizada.
 */
export async function editarParticipanteSeguro(input: {
  participante_id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  funcao?: string | null;
  setor?: string | null;
  unidade?: string | null;
  justificativa?: string | null;
}) {
  return sb.rpc("psico_atualizar_participante", {
    _participante_id: input.participante_id,
    _nome: input.nome,
    _email: input.email ?? null,
    _telefone: input.telefone ?? null,
    _funcao: input.funcao ?? null,
    _setor: input.setor ?? null,
    _unidade: input.unidade ?? null,
    _justificativa: input.justificativa ?? null,
  });
}

export async function inativarParticipante(id: string, motivo: string) {
  return sb
    .from("psico_participantes")
    .update({ ativo: false, motivo_inativacao: motivo })
    .eq("id", id);
}
export async function reativarParticipante(id: string) {
  return sb
    .from("psico_participantes")
    .update({ ativo: true, motivo_inativacao: null, inativado_em: null, inativado_por: null })
    .eq("id", id);
}

export async function prepararConvites(avaliacaoId: string, participanteIds: string[]) {
  const rows = participanteIds.map((pid) => ({
    avaliacao_id: avaliacaoId,
    participante_id: pid,
    status: "preparado" as const,
  }));
  const { data, error } = await sb.from("psico_convites").insert(rows).select("id, participante_id");
  if (!error) {
    await sb.from("psico_auditoria").insert({
      entidade: "avaliacao",
      entidade_id: avaliacaoId,
      acao: "convites_preparados_lote",
      metadados: { quantidade: rows.length },
    });
  }
  return { data, error };
}

export async function regenerarConvite(conviteId: string, motivo: string) {
  const { data: atual, error: er1 } = await sb
    .from("psico_convites")
    .select("*")
    .eq("id", conviteId)
    .single();
  if (er1 || !atual) return { error: er1 };
  if (atual.status === "respondido") {
    return { error: { message: "Não é possível regenerar um convite já respondido." } };
  }
  // revoga o atual
  const { error: er2 } = await sb
    .from("psico_convites")
    .update({
      status: "revogado",
      revogado_em: new Date().toISOString(),
      motivo_revogacao: `Regeneração: ${motivo}`,
    })
    .eq("id", conviteId);
  if (er2) return { error: er2 };
  const { data: novo, error: er3 } = await sb
    .from("psico_convites")
    .insert({
      avaliacao_id: atual.avaliacao_id,
      participante_id: atual.participante_id,
      status: "preparado",
      token_version: 1,
    })
    .select("id")
    .single();
  if (!er3) {
    await sb.from("psico_auditoria").insert({
      entidade: "convite",
      entidade_id: novo.id,
      acao: "convite_regenerado",
      metadados: { motivo, avaliacao_id: atual.avaliacao_id },
    });
  }
  return { data: novo, error: er3 };
}

export async function revogarConvite(conviteId: string, motivo: string) {
  const { error } = await sb
    .from("psico_convites")
    .update({
      status: "revogado",
      revogado_em: new Date().toISOString(),
      motivo_revogacao: motivo,
    })
    .eq("id", conviteId);
  if (!error) {
    await sb.from("psico_auditoria").insert({
      entidade: "convite",
      entidade_id: conviteId,
      acao: "convite_revogado",
      metadados: { motivo },
    });
  }
  return { error };
}

export async function marcarDistribuido(conviteIds: string[], canal: string, observacao?: string) {
  const { error } = await sb
    .from("psico_convites")
    .update({
      canal_distribuicao: canal,
      distribuido_em: new Date().toISOString(),
    })
    .in("id", conviteIds);
  if (!error && conviteIds.length) {
    await sb.from("psico_auditoria").insert({
      entidade: "convite",
      entidade_id: conviteIds[0],
      acao: conviteIds.length > 1 ? "convites_marcados_distribuidos_lote" : "convite_marcado_distribuido",
      metadados: { quantidade: conviteIds.length, canal, observacao: observacao ?? null },
    });
  }
  return { error };
}

/**
 * Gera links assinados via edge function segura.
 * Retorna [{id, token, link}]
 */
export async function gerarLinksAssinados(conviteIds: string[]) {
  const { data, error } = await sb.functions.invoke("psico-invite-token", {
    body: { convite_ids: conviteIds },
  });
  if (error) return { data: null, error };
  return { data: data?.convites || [], error: null };
}

export function aplicarPlaceholders(
  tpl: string,
  ctx: { nome: string; cliente?: string; titulo?: string; link: string; dataInicio?: string; dataFim?: string },
) {
  const map: Record<string, string> = {
    "{{primeiro_nome}}": primeiroNome(ctx.nome),
    "{{nome}}": ctx.nome,
    "{{cliente}}": ctx.cliente || "",
    "{{titulo_avaliacao}}": ctx.titulo || "",
    "{{link}}": ctx.link,
    "{{data_inicio}}": ctx.dataInicio || "",
    "{{data_fim}}": ctx.dataFim || "",
  };
  return tpl.replace(/\{\{[a-z_]+\}\}/g, (m) => (m in map ? map[m] : m));
}

/** Protege células contra CSV injection */
export function csvSafe(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}