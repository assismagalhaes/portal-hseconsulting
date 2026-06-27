import { useState } from "react";
import ReactMarkdown from "react-markdown";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { salvarResumoEntidade } from "@/lib/iaActions";
import { toast } from "sonner";

export default function IaResumoSemanal() {
  const [resumo, setResumo] = useState("");
  const [loading, setLoading] = useState(false);

  async function gerar() {
    setLoading(true);
    try {
      const pergunta = `Gere o Resumo Semanal da Gestão HSE consolidando os últimos 7 dias: propostas emitidas, aprovadas e perdidas; serviços em execução; OS finalizadas; documentos emitidos e documentos vencendo; recebimentos; custos; margem real; pendências críticas; alertas inteligentes. Apresente em markdown com KPIs e destaques.`;
      const { data, error } = await supabase.functions.invoke("ia-chat", { body: { modulo: "geral", pergunta } });
      if (error) throw error;
      setResumo((data as { resposta: string }).resposta);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally { setLoading(false); }
  }

  async function salvar() {
    if (!resumo) return;
    await salvarResumoEntidade({ entidade_tipo: "geral", modulo: "geral", titulo: `Resumo Semanal ${new Date().toLocaleDateString("pt-BR")}`, resumo });
    toast.success("Resumo salvo");
  }

  return (
    <div>
      <PageHeader title="Resumo Semanal" subtitle="Visão consolidada da semana para a gestão"
        actions={<>
          <Button onClick={gerar} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Gerar resumo</Button>
          {resumo && <Button variant="outline" onClick={salvar}><Save className="h-4 w-4 mr-2" /> Salvar</Button>}
        </>}
      />
      <div className="p-6">
        {resumo ? (
          <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-border bg-card p-6">
            <ReactMarkdown>{resumo}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">Clique em "Gerar resumo" para gerar o panorama semanal.</p>
        )}
      </div>
    </div>
  );
}