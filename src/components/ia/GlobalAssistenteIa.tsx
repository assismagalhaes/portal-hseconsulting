import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import IaContextDrawer from "./IaContextDrawer";
import type { ModuloIa, EntidadeTipo } from "@/lib/iaActions";

interface CtxInfo { modulo: ModuloIa; entidade_tipo?: EntidadeTipo; entidade_id?: string; titulo?: string }

function resolveContext(pathname: string, params: Record<string, string | undefined>): CtxInfo | null {
  const id = params.id;
  if (/^\/propostas\/[^/]+/.test(pathname) && id) return { modulo: "proposta", entidade_tipo: "proposta", entidade_id: id, titulo: "Proposta em edição" };
  if (/^\/ordens-servico\/[^/]+/.test(pathname) && id) return { modulo: "os", entidade_tipo: "os", entidade_id: id, titulo: "Ordem de Serviço" };
  if (/^\/documentos\/[^/]+/.test(pathname) && id) return { modulo: "documento", entidade_tipo: "documento", entidade_id: id, titulo: "Documento Técnico" };
  if (/^\/execucao\/[^/]+/.test(pathname) && id) return { modulo: "execucao", entidade_tipo: "execucao", entidade_id: id, titulo: "Execução de Serviço" };
  if (/^\/financeiro\/contratos\/[^/]+/.test(pathname) && id) return { modulo: "financeiro", entidade_tipo: "contrato", entidade_id: id, titulo: "Contrato Financeiro" };
  if (pathname.startsWith("/propostas")) return { modulo: "proposta", titulo: "Módulo Propostas" };
  if (pathname.startsWith("/ordens-servico")) return { modulo: "os", titulo: "Módulo Ordens de Serviço" };
  if (pathname.startsWith("/documentos")) return { modulo: "documento", titulo: "Módulo Documentos" };
  if (pathname.startsWith("/execucao")) return { modulo: "execucao", titulo: "Módulo Execução" };
  if (pathname.startsWith("/financeiro")) return { modulo: "financeiro", titulo: "Módulo Financeiro" };
  if (pathname.startsWith("/crm")) return { modulo: "crm", titulo: "Módulo CRM" };
  if (pathname.startsWith("/clientes")) return { modulo: "geral", entidade_tipo: "cliente", titulo: "Módulo Clientes" };
  if (pathname.startsWith("/ia")) return null;
  return { modulo: "geral", titulo: "Assistente HSE" };
}

export default function GlobalAssistenteIa() {
  const loc = useLocation();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const ctx = useMemo(() => resolveContext(loc.pathname, params as Record<string, string | undefined>), [loc.pathname, params]);
  if (!ctx) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 shadow-lg rounded-full h-12 px-5" size="lg">
        <Sparkles className="h-4 w-4 mr-2" />
        Assistente IA
      </Button>
      <IaContextDrawer open={open} onOpenChange={setOpen}
        modulo={ctx.modulo}
        entidade_tipo={ctx.entidade_tipo}
        entidade_id={ctx.entidade_id}
        titulo={ctx.titulo} />
    </>
  );
}