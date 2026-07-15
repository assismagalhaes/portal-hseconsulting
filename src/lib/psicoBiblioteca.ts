import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;

export type BibliotecaVersao = {
  id: string;
  codigo: string;
  nome: string;
  versao: string;
  descricao: string | null;
  fonte: string | null;
  status: "em_configuracao" | "publicada" | "arquivada";
  vigente: boolean;
  quantidade_fatores_prevista: number | null;
  quantidade_medidas_prevista: number | null;
  publicado_em: string | null;
};

export type FatorOrientacao = {
  id: string;
  biblioteca_versao_id: string;
  fator_codigo: string;
  nome: string;
  ordem: number;
  definicao_resumida: string | null;
  impactos_possiveis: string[] | null;
  situacoes_associadas: string[] | null;
  objetivo_medidas: string | null;
  perguntas_avaliacao_interna: string[] | null;
  orientacao_priorizacao: string | null;
  observacao_final: string | null;
  ativo: boolean;
};

export type MedidaModelo = {
  id: string;
  biblioteca_versao_id: string;
  fator_codigo: string;
  codigo: string;
  ordem: number;
  titulo: string;
  nivel_recomendacao: "basica" | "intermediaria" | "avancada" | "transversal";
  grupo_transversal: string | null;
  o_que_significa: string | null;
  orientacoes_praticas: string[] | null;
  exemplos_aplicacao: string[] | null;
  responsaveis_sugeridos: string[] | null;
  evidencias_recomendadas: string[] | null;
  indicadores_sugeridos: string[] | null;
  prazo_sugerido_dias: number | null;
  complexidade: "baixa" | "media" | "alta" | null;
  custo_estimado: "baixo" | "medio" | "alto" | null;
  observacoes: string | null;
  ativo: boolean;
};

export async function listBibliotecas(): Promise<BibliotecaVersao[]> {
  const { data, error } = await sb
    .from("psico_bibliotecas_medidas_versoes")
    .select("*")
    .order("vigente", { ascending: false })
    .order("publicado_em", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []) as BibliotecaVersao[];
}

export async function getBibliotecaVigente(): Promise<BibliotecaVersao | null> {
  const { data } = await sb
    .from("psico_bibliotecas_medidas_versoes")
    .select("*")
    .eq("vigente", true)
    .maybeSingle();
  return (data as BibliotecaVersao) || null;
}

export async function getBiblioteca(id: string): Promise<{
  biblioteca: BibliotecaVersao | null;
  fatores: FatorOrientacao[];
  medidas: MedidaModelo[];
}> {
  const [b, f, m] = await Promise.all([
    sb.from("psico_bibliotecas_medidas_versoes").select("*").eq("id", id).maybeSingle(),
    sb.from("psico_fatores_orientacoes").select("*").eq("biblioteca_versao_id", id).order("ordem"),
    sb.from("psico_medidas_modelos").select("*").eq("biblioteca_versao_id", id).order("fator_codigo").order("ordem"),
  ]);
  return {
    biblioteca: (b.data as BibliotecaVersao) || null,
    fatores: (f.data || []) as FatorOrientacao[],
    medidas: (m.data || []) as MedidaModelo[],
  };
}

export async function validarBiblioteca(id: string) {
  return sb.rpc("psico_validar_biblioteca_medidas", { p_biblioteca_versao_id: id });
}

export async function publicarBiblioteca(id: string, confirmacao: string) {
  return sb.rpc("psico_publicar_biblioteca_medidas", {
    p_biblioteca_versao_id: id,
    p_confirmacao: confirmacao,
  });
}

export async function duplicarBiblioteca(id: string, novoCodigo: string, novaVersao: string, novoNome?: string) {
  return sb.rpc("psico_duplicar_biblioteca_medidas", {
    p_biblioteca_versao_id: id,
    p_novo_codigo: novoCodigo,
    p_nova_versao: novaVersao,
    p_novo_nome: novoNome ?? null,
  });
}

export const NIVEL_LABEL: Record<string, string> = {
  basica: "Básica",
  intermediaria: "Intermediária",
  avancada: "Avançada",
  transversal: "Transversal",
};

export const NIVEL_COLOR: Record<string, string> = {
  basica: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  intermediaria: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  avancada: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  transversal: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
};

export const STATUS_BIB_LABEL: Record<string, string> = {
  em_configuracao: "Em configuração",
  publicada: "Publicada",
  arquivada: "Arquivada",
};