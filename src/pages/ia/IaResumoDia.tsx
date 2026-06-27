import { useState } from "react";
import ReactMarkdown from "react-markdown";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { salvarResumoEntidade } from "@/lib/iaActions";
import { toast } from "sonner";

export default function IaResumoDia() {
  const [resumo, setResumo] = useState("");
  const [loading, setLoading] = useState(false);

  async function gerar() {
    setLoading(true);
    try {
      const pergunta = `Gere o Resumo Operacional do Dia (${new Date().toLocaleDateString("pt-BR")}) para a gestão da HSE Consulting. Consolide: OS agendadas para hoje, visitas técnicas, follow-ups comerciais pendentes, parcelas vencendo, documentos vencendo, pendências críticas, alertas novos e propostas próximas do vencimento. Estruture em seções em markdown com prioridades.`;
      const { data, error } = await supabase.functions.invoke("ia-chat", { body: { modulo: "geral", pergunta } });
      if (error) throw error;
      setResumo((data as { resposta: string }).resposta);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally { setLoading(false); }
  }

  async function salvar() {
    if (!resumo) return;
    await salvarResumoEntidade({ entidade_tipo: "geral", modulo: "geral", titulo: `Resumo do Dia ${new Date().toLocaleDateString("pt-BR")}`, resumo });
    toast.success("Resumo salvo");
  }

  return (
    <div>
      <PageHeader title="Resumo do Dia" subtitle="Consolidação operacional gerada pela IA"
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
          <p className="text-muted-foreground">Clique em "Gerar resumo" para que a IA monte um panorama do dia.</p>
        )}
      </div>
    </div>
  );
}