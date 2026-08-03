import { Link, useLocation, Navigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, BookOpen, ClipboardList, FileText, Settings2 } from "lucide-react";

/** Chrome compartilhado das páginas do módulo Avaliação de Fatores Psicossociais. */

export const BASE = "/operacoes/avaliacao-fatores-psicossociais";

export function ModuleTabs() {
  const loc = useLocation();
  const tabs = [
    { to: `${BASE}/avaliacoes`, label: "Avaliações", icon: ClipboardList },
    { to: `${BASE}/resultados`, label: "Resultados", icon: BarChart3 },
    { to: `${BASE}/relatorios`, label: "Relatórios", icon: FileText },
    { to: `${BASE}/biblioteca-medidas`, label: "Biblioteca de Medidas", icon: BookOpen },
    { to: `${BASE}/configuracoes`, label: "Configurações", icon: Settings2 },
  ];
  const current = tabs.find((t) => loc.pathname.startsWith(t.to))?.to || tabs[0].to;
  return (
    <Tabs value={current} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.to} value={t.to} asChild>
            <Link to={t.to} className="flex items-center gap-2">
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted grid place-items-center">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function ModuloHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Avaliação de Fatores Psicossociais"
        subtitle="Crie, acompanhe e emita avaliações coletivas sobre fatores psicossociais relacionados às condições e à organização do trabalho."
        actions={actions}
      />
      <div className="px-6 pt-4">
        <ModuleTabs />
      </div>
    </>
  );
}

export function PsicoModuloRedirect() {
  return <Navigate to={`${BASE}/avaliacoes`} replace />;
}