import { Link } from "react-router-dom";
import { MessageSquare, Bell, FileText, Sparkles, BookOpen, ListChecks } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const cards = [
  { to: "/ia/chat", icon: MessageSquare, title: "Assistente Geral", desc: "Pergunte sobre clientes, propostas, OS, documentos, financeiro." },
  { to: "/ia/alertas", icon: Bell, title: "Alertas Inteligentes", desc: "Riscos cruzados entre módulos com ação sugerida." },
  { to: "/ia/interacoes", icon: ListChecks, title: "Histórico de Interações", desc: "Auditoria de perguntas e respostas da IA." },
  { to: "/ia/prompts", icon: BookOpen, title: "Biblioteca de Prompts", desc: "Configure prompts padrão por módulo." },
];

export default function IaHub() {
  return (
    <div>
      <PageHeader title="IA HSE — Copiloto Interno" subtitle="Sugestões inteligentes baseadas nos dados do portal. Toda recomendação exige validação humana." />
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3 items-start">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">A IA atua como copiloto, nunca como decisor final.</div>
            <div className="text-muted-foreground">Ela não altera valores, não aprova propostas, não emite documentos e não envia mensagens ao cliente sem confirmação.</div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="rounded-xl border border-border bg-card p-5 hover:border-primary/60 hover:shadow-md transition group">
              <c.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition" />
              <div className="font-display font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
            </Link>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <Link to="/ia/chat?modulo=proposta" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA de Propostas</Link>
          <Link to="/ia/chat?modulo=precificacao" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA de Precificação</Link>
          <Link to="/ia/chat?modulo=documento" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA de Documentos Técnicos</Link>
          <Link to="/ia/chat?modulo=os" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA de OS / Execução</Link>
          <Link to="/ia/chat?modulo=crm" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA Comercial / CRM</Link>
          <Link to="/ia/chat?modulo=financeiro" className="rounded-lg border border-border bg-card p-4 hover:border-primary/60"><FileText className="inline h-4 w-4 mr-2 text-primary" />IA Financeira</Link>
        </div>
      </div>
    </div>
  );
}