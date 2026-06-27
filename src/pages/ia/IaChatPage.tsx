import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import IaChat from "@/components/ia/IaChat";
import type { IaModulo } from "@/lib/iaClient";

const SUGGESTIONS: Record<IaModulo, string[]> = {
  geral: [
    "Quais propostas estão próximas do vencimento?",
    "Quais OS estão sem responsável?",
    "Quais documentos vencem nos próximos 30 dias?",
    "Quais propostas aprovadas ainda não têm OS?",
    "Qual cliente gerou maior margem?",
  ],
  proposta: ["Resuma esta proposta", "Sugira melhorias na descrição comercial", "Identifique itens não inclusos"],
  precificacao: ["Avalie a saúde da precificação", "Onde há risco de margem baixa?", "Sugira revisão de valores"],
  documento: ["Sugira texto técnico para a próxima seção", "Aponte campos variáveis não preenchidos", "Resuma este documento"],
  os: ["Resuma a OS", "Liste pendências da OS", "Sugira próximos passos"],
  execucao: ["Quais execuções estão atrasadas?", "Sugira priorização operacional"],
  crm: ["Sugira próximo follow-up", "Identifique leads quentes sem ação", "Sugira mensagem de WhatsApp"],
  financeiro: ["Quais parcelas estão vencidas?", "Quais contratos têm baixa margem real?", "Gere resumo financeiro mensal"],
  alertas: ["Quais riscos críticos estão abertos?"],
};

const LABEL: Record<IaModulo, string> = {
  geral: "Assistente Geral", proposta: "IA de Propostas", precificacao: "IA de Precificação",
  documento: "IA de Documentos", os: "IA de OS", execucao: "IA de Execução",
  crm: "IA Comercial", financeiro: "IA Financeira", alertas: "Alertas Inteligentes",
};

export default function IaChatPage() {
  const [params] = useSearchParams();
  const modulo = ((params.get("modulo") as IaModulo) || "geral") as IaModulo;
  return (
    <div>
      <PageHeader title={LABEL[modulo]} subtitle="Copiloto interno HSE — sugestões para validação humana." />
      <div className="p-6">
        <IaChat modulo={modulo} suggestions={SUGGESTIONS[modulo] ?? []} title={LABEL[modulo]} />
      </div>
    </div>
  );
}