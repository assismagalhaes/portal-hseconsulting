import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ChecklistCard, VisitasCard, EvidenciasCard } from "@/pages/OrdemServicoEditor";

/**
 * Painel operacional de uma atividade do projeto.
 * Consolida Checklist / Visitas / Evidências como abas do próprio projeto,
 * usando uma única "OS" implícita por projeto (criada sob demanda).
 */
export default function AtividadePainel({ projeto, secao }: { projeto: any; secao: "checklist" | "visitas" | "evidencias" }) {
  const [osId, setOsId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureOs = async (): Promise<string | null> => {
    const { data: existing } = await supabase
      .from("ordens_servico")
      .select("id")
      .eq("projeto_id", projeto.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (existing && existing.length) return existing[0].id;
    const payload: any = {
      projeto_id: projeto.id,
      titulo: `Atividades — ${projeto.titulo || projeto.numero}`,
      prioridade: "media",
      data_prevista_inicio: projeto.data_inicio || null,
      data_prevista_conclusao: projeto.data_fim_prevista || null,
      client_id: projeto.client_id,
      cliente_nome: projeto.clients?.nome_fantasia || projeto.clients?.razao_social,
      cidade: projeto.clients?.cidade,
      endereco: projeto.clients?.endereco,
      responsavel_tecnico_id: projeto.responsavel_execucao_id || null,
    };
    const { data, error } = await supabase
      .from("ordens_servico")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      toast({ title: "Erro ao inicializar atividade", description: error.message, variant: "destructive" });
      return null;
    }
    return data!.id;
  };

  const loadData = async (id: string) => {
    const [ck, vi, ev, pp, roles] = await Promise.all([
      supabase.from("os_checklist").select("*").eq("os_id", id).order("ordem").order("created_at"),
      supabase.from("os_visitas").select("*").eq("os_id", id).order("data").order("hora_inicio"),
      supabase.from("os_evidencias").select("*").eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("execucao_profissionais").select("id, nome, cargo").order("nome"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "tecnico", "comercial"] as any),
    ]);
    const execList = ((pp.data as any) || []).map((p: any) => ({ id: p.id, nome: p.nome, cargo: p.cargo || null, source: "prof" as const }));
    const userIds = Array.from(new Set(((roles.data as any) || []).map((r: any) => r.user_id))) as string[];
    let usersList: any[] = [];
    if (userIds.length) {
      const { data: pr } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
      usersList = (pr || []).map((u: any) => ({ id: u.id, nome: u.nome || u.email, cargo: null, source: "user" as const }));
    }
    const seen = new Set<string>();
    const combined = [...execList, ...usersList].filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    setChecklist((ck.data as any) || []);
    setVisitas((vi.data as any) || []);
    setEvidencias((ev.data as any) || []);
    setProfs(combined);
  };

  const boot = async () => {
    setLoading(true);
    const id = await ensureOs();
    if (id) {
      setOsId(id);
      await loadData(id);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projeto?.id) boot();
    // eslint-disable-next-line
  }, [projeto?.id]);

  const reload = async () => { if (osId) await loadData(osId); };

  if (loading || !osId) {
    return <div className="p-10 text-center text-muted-foreground">Carregando atividade…</div>;
  }

  if (secao === "checklist") return <ChecklistCard osId={osId} items={checklist} onChange={reload} />;
  if (secao === "visitas") return <VisitasCard osId={osId} visitas={visitas} profs={profs} projRespId={projeto.responsavel_execucao_id} onChange={reload} />;
  return <EvidenciasCard osId={osId} evidencias={evidencias} visitas={visitas} onChange={reload} />;
}