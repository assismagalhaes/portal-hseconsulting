import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type RelatorioVersaoStatus =
  | "preparando"
  | "gerando"
  | "emitido"
  | "falhou"
  | "substituido"
  | "revogado";

export const REL_STATUS_LABEL: Record<RelatorioVersaoStatus, string> = {
  preparando: "Preparando",
  gerando: "Gerando",
  emitido: "Emitido",
  falhou: "Falhou",
  substituido: "Substituído",
  revogado: "Revogado",
};

export const REL_STATUS_COLOR: Record<RelatorioVersaoStatus, string> = {
  preparando: "bg-muted text-foreground",
  gerando: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  emitido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  falhou: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  substituido: "bg-muted text-muted-foreground",
  revogado: "bg-destructive/15 text-destructive",
};

export const ERRO_EMISSAO_LABEL: Record<string, string> = {
  nao_autorizado: "Sem permissão para emitir.",
  avaliacao_inexistente: "Avaliação não encontrada.",
  status_avaliacao_incompativel: "A avaliação não está pronta (aguardando resultado).",
  sem_processamento_ativo: "Nenhum processamento ativo disponível.",
  processamento_invalido: "O processamento ativo não está concluído.",
  sem_revisao_tecnica: "Nenhuma revisão técnica registrada.",
  revisao_nao_aprovada: "A revisão técnica não foi aprovada.",
  conclusao_vazia: "Conclusão técnica vazia na revisão.",
  limitacoes_vazias: "Limitações não descritas na revisão.",
  responsavel_tecnico_ausente: "Responsável técnico não definido.",
  sem_plano_acao: "Nenhum plano de ação vinculado.",
  plano_nao_aprovado: "Plano de ação ainda não foi aprovado.",
  emissao_em_andamento: "Já existe uma emissão em andamento.",
  SNAPSHOT_INVALIDO: "Falha no snapshot dos dados.",
  MODELO_NAO_LOCALIZADO: "Modelo de relatório indisponível.",
  ERRO_RENDERIZACAO: "Falha ao renderizar o PDF.",
  ERRO_GRAFICO: "Falha ao gerar gráficos.",
  PDF_INVALIDO: "PDF gerado inválido.",
  ERRO_STORAGE: "Falha ao armazenar o arquivo.",
  ERRO_INTEGRACAO_DOCUMENTOS: "Falha ao integrar com Documentos Técnicos.",
  TEMPO_LIMITE: "A geração ultrapassou o tempo limite.",
  ERRO_INTERNO: "Erro interno na geração.",
};

export function traduzirErroEmissao(cod: string) {
  return ERRO_EMISSAO_LABEL[cod] || cod;
}

export async function validarEmissao(avaliacaoId: string) {
  return sb.rpc("psico_validar_emissao_relatorio", { p_avaliacao_id: avaliacaoId });
}

export async function getRelatorio(avaliacaoId: string) {
  const { data } = await sb
    .from("psico_relatorios")
    .select("*")
    .eq("avaliacao_id", avaliacaoId)
    .maybeSingle();
  return data;
}

export async function listarVersoes(relatorioId: string) {
  const { data } = await sb
    .from("psico_relatorios_versoes")
    .select(
      "id, numero_revisao, codigo_revisao, descricao_revisao, status, emitido_em, emitido_por, arquivo_paginas, arquivo_tamanho_bytes, pdf_hash_sha256, codigo_validacao, erro_codigo, revogado_em, motivo_revogacao, arquivo_storage_path"
    )
    .eq("relatorio_id", relatorioId)
    .order("numero_revisao", { ascending: false });
  return data || [];
}

export async function gerarRelatorio(
  avaliacaoId: string,
  confirmacao: string,
  descricaoRevisao?: string
) {
  const { data, error } = await supabase.functions.invoke("psico-gerar-relatorio", {
    body: {
      avaliacao_id: avaliacaoId,
      confirmacao,
      descricao_revisao: descricaoRevisao ?? null,
    },
  });
  return { data, error };
}

export async function baixarVersao(versaoId: string): Promise<{ url?: string; error?: string; nome?: string }> {
  const { data, error } = await sb.rpc("psico_obter_versao_download", {
    p_relatorio_versao_id: versaoId,
  });
  if (error) return { error: error.message };
  const path = (data as any)?.storage_path as string | undefined;
  const nome = (data as any)?.nome_arquivo as string | undefined;
  if (!path) return { error: "arquivo_indisponivel" };
  const signed = await supabase.storage.from("psico-relatorios").createSignedUrl(path, 300, {
    download: nome || true,
  });
  if (signed.error) return { error: signed.error.message };
  return { url: signed.data.signedUrl, nome };
}

export async function revogarVersao(versaoId: string, motivo: string) {
  return sb.rpc("psico_revogar_versao_relatorio", {
    p_relatorio_versao_id: versaoId,
    p_motivo: motivo,
  });
}

export async function validarPublico(codigo: string) {
  return sb.rpc("psico_validar_publico_relatorio", { p_codigo_validacao: codigo });
}