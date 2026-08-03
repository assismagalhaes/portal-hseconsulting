// Camada de acesso a dados para pendências de projeto.
// Encapsula todas as chamadas ao Supabase para a tabela `projeto_pendencias`,
// evitando `supabase as any` espalhado nos componentes e concentrando os
// tipos do domínio em um único lugar.
import { supabase } from "@/integrations/supabase/client";

export type PendenciaPrioridade = "normal" | "urgente";
export type PendenciaStatus = "aberta" | "resolvida";

export type Pendencia = {
  id: string;
  projeto_id: string;
  titulo: string;
  responsavel: string | null;
  prazo: string | null;
  prioridade: PendenciaPrioridade;
  status: PendenciaStatus;
  observacao: string | null;
  resolvida_em: string | null;
  created_at: string;
};

export type PendenciaPatch = Partial<
  Pick<Pendencia, "titulo" | "responsavel" | "prazo" | "prioridade" | "status" | "observacao" | "resolvida_em">
>;

// `projeto_pendencias` ainda não consta em `types.ts` (arquivo auto-gerado).
// Usamos um cast local pontual; o restante da aplicação permanece tipado.
const table = () => (supabase as any).from("projeto_pendencias");

export async function listarPendencias(projetoId: string): Promise<Pendencia[]> {
  const { data, error } = await table()
    .select("*")
    .eq("projeto_id", projetoId)
    .order("status", { ascending: true })
    .order("prioridade", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Pendencia[];
}

export async function criarPendencia(projetoId: string, titulo: string): Promise<void> {
  const { error } = await table().insert({ projeto_id: projetoId, titulo });
  if (error) throw error;
}

export async function atualizarPendencia(id: string, changes: PendenciaPatch): Promise<void> {
  const { error } = await table().update(changes).eq("id", id);
  if (error) throw error;
}

export async function resolverPendencia(id: string): Promise<void> {
  return atualizarPendencia(id, { status: "resolvida", resolvida_em: new Date().toISOString() });
}

export async function reabrirPendencia(id: string): Promise<void> {
  return atualizarPendencia(id, { status: "aberta", resolvida_em: null });
}

export async function alternarUrgencia(id: string, atual: PendenciaPrioridade): Promise<void> {
  return atualizarPendencia(id, { prioridade: atual === "urgente" ? "normal" : "urgente" });
}

export async function removerPendencia(id: string): Promise<void> {
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
}