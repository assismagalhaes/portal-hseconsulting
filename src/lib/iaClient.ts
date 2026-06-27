import { supabase } from "@/integrations/supabase/client";

export type IaModulo = "geral" | "proposta" | "precificacao" | "documento" | "os" | "execucao" | "crm" | "financeiro" | "alertas";

export interface IaChatInput {
  modulo?: IaModulo;
  pergunta: string;
  entidade_tipo?: "proposta" | "os" | "documento" | "cliente";
  entidade_id?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  model?: string;
}

export async function iaChat(input: IaChatInput): Promise<{ resposta: string; model?: string }> {
  const { data, error } = await supabase.functions.invoke("ia-chat", { body: input });
  if (error) throw error;
  if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as { resposta: string; model?: string };
}

export async function iaGerarAlertas(): Promise<{ gerados: number; total: number }> {
  const { data, error } = await supabase.functions.invoke("ia-gerar-alertas", { body: {} });
  if (error) throw error;
  return data as { gerados: number; total: number };
}