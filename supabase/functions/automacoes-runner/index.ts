import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body { automacao_id?: string; manual?: boolean }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Body = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { data: autos } = body.automacao_id
    ? await supabase.from("automacoes").select("*").eq("id", body.automacao_id)
    : await supabase.from("automacoes").select("*").eq("ativa", true);

  const results: Array<{ id: string; status: string; afetados: number; detalhe?: string; execucao_id?: string }> = [];

  for (const a of (autos ?? [])) {
    const t0 = Date.now();
    let afetados = 0; let notif = 0; let tar = 0; let alt = 0; let status = "sucesso"; let detalhe = ""; const erros: unknown[] = [];

    try {
      const r = await runAutomacao(supabase, a);
      afetados = r.afetados; notif = r.notificacoes; tar = r.tarefas; alt = r.alertas; detalhe = r.detalhe;
    } catch (e) {
      status = "erro"; erros.push(String(e)); detalhe = String(e);
    }

    const { data: exec } = await supabase.from("automacoes_execucoes").insert({
      automacao_id: a.id,
      finalizado_em: new Date().toISOString(),
      duracao_ms: Date.now() - t0,
      status,
      registros_afetados: afetados,
      notificacoes_criadas: notif,
      tarefas_criadas: tar,
      alertas_criados: alt,
      erros: erros.length ? erros : null,
      detalhe,
      origem: body.manual ? "manual" : "sistema",
    }).select("id").single();

    await supabase.from("automacoes").update({
      ultima_execucao: new Date().toISOString(),
    }).eq("id", a.id);

    results.push({ id: a.id, status, afetados, detalhe, execucao_id: exec?.id });
  }

  return new Response(JSON.stringify({
    ok: true,
    execucoes: results,
    afetados: results.reduce((s, r) => s + r.afetados, 0),
    execucao_id: results[0]?.execucao_id,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

// ---------- regras ----------

type Sb = ReturnType<typeof createClient>;
interface Auto { id: string; nome: string; tipo: string; dias_antes: number | null; prioridade_padrao: string; modulos_afetados: string[] }
interface Result { afetados: number; notificacoes: number; tarefas: number; alertas: number; detalhe: string }

async function getInternosIds(supabase: Sb): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "comercial", "tecnico"]);
  const ids = Array.from(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)));
  return ids;
}

async function notificarTodos(supabase: Sb, ids: string[], n: { titulo: string; mensagem?: string; modulo: string; prioridade: string; link?: string; entidade_tipo?: string; entidade_id?: string; client_id?: string; automacao_id: string }) {
  if (!ids.length) return 0;
  const rows = ids.map((uid) => ({
    user_id: uid,
    titulo: n.titulo,
    mensagem: n.mensagem ?? null,
    modulo: n.modulo,
    prioridade: n.prioridade,
    link: n.link ?? null,
    entidade_tipo: n.entidade_tipo ?? null,
    entidade_id: n.entidade_id ?? null,
    client_id: n.client_id ?? null,
    automacao_id: n.automacao_id,
    origem: "automacao",
  }));
  const { error } = await supabase.from("notificacoes").insert(rows);
  if (error) throw error;
  return rows.length;
}

async function criarAlerta(supabase: Sb, a: Auto, alerta: { titulo: string; descricao?: string; gravidade?: string; entidade_tipo?: string; entidade_id?: string; client_id?: string }) {
  await supabase.from("ia_alertas").insert({
    tipo: "automacao",
    gravidade: alerta.gravidade ?? "media",
    modulo: a.tipo === "comercial" ? "crm" : a.tipo === "financeira" ? "financeiro" : a.tipo === "documental" ? "documento" : "alertas",
    titulo: alerta.titulo,
    descricao: alerta.descricao ?? null,
    entidade_tipo: alerta.entidade_tipo ?? null,
    entidade_id: alerta.entidade_id ?? null,
    client_id: alerta.client_id ?? null,
  });
}

async function criarTarefa(supabase: Sb, a: Auto, t: { titulo: string; descricao?: string; modulo: string; client_id?: string; entidade_tipo?: string; entidade_id?: string; prioridade?: string; responsavel_id?: string }) {
  await supabase.from("tarefas").insert({
    titulo: t.titulo,
    descricao: t.descricao ?? null,
    modulo_origem: t.modulo,
    client_id: t.client_id ?? null,
    entidade_tipo: t.entidade_tipo ?? null,
    entidade_id: t.entidade_id ?? null,
    prioridade: (t.prioridade ?? a.prioridade_padrao ?? "normal"),
    responsavel_id: t.responsavel_id ?? null,
    automacao_id: a.id,
  });
}

function diasAtras(dias: number) { const d = new Date(); d.setDate(d.getDate() - dias); return d.toISOString(); }
function diasFrente(dias: number) { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }

async function runAutomacao(supabase: Sb, a: Auto): Promise<Result> {
  const internos = await getInternosIds(supabase);
  const res: Result = { afetados: 0, notificacoes: 0, tarefas: 0, alertas: 0, detalhe: "" };
  const prio = a.prioridade_padrao ?? "normal";

  const nome = a.nome.toLowerCase();

  // ===== Comercial =====
  if (nome.includes("proposta enviada sem retorno")) {
    const dias = a.dias_antes ?? 3;
    const { data } = await supabase.from("proposals")
      .select("id, titulo, numero, client_id, created_by, updated_at")
      .eq("status", "enviada").lte("updated_at", diasAtras(dias));
    for (const p of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, p.created_by ? [p.created_by] : internos, {
        titulo: `Proposta sem retorno: ${p.numero ?? p.titulo}`,
        mensagem: `Sem movimentação há ${dias} dias. Considere um follow-up.`,
        modulo: "propostas", prioridade: prio, link: `/propostas/${p.id}`,
        entidade_tipo: "proposta", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("proposta vencendo")) {
    const dias = a.dias_antes ?? 5;
    const limite = diasFrente(dias);
    const { data } = await supabase.from("proposals")
      .select("id, titulo, numero, client_id, created_by, validade_dias, validade_ate")
      .in("status", ["enviada", "negociacao"]).not("validade_ate", "is", null).lte("validade_ate", limite).gte("validade_ate", new Date().toISOString().slice(0, 10));
    for (const p of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, p.created_by ? [p.created_by] : internos, {
        titulo: `Proposta vencendo: ${p.numero ?? p.titulo}`,
        mensagem: `Validade até ${p.validade_ate}.`,
        modulo: "propostas", prioridade: "alta", link: `/propostas/${p.id}`,
        entidade_tipo: "proposta", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("lead novo sem responsável") || nome.includes("lead novo sem responsavel")) {
    const { data } = await supabase.from("crm_leads").select("id, empresa").is("responsavel_id", null).neq("status", "convertido");
    for (const l of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Lead sem responsável: ${l.empresa}`,
        modulo: "crm", prioridade: "alta", link: `/crm/leads`,
        entidade_tipo: "lead", entidade_id: l.id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("oportunidade quente")) {
    const { data } = await supabase.from("crm_oportunidades")
      .select("id, titulo, client_id, etapa, probabilidade, proxima_acao_data, responsavel_id")
      .gte("probabilidade", 70).in("etapa", ["negociacao", "proposta_enviada"]).is("proxima_acao_data", null);
    for (const o of (data ?? [])) {
      await criarAlerta(supabase, a, {
        titulo: `Oportunidade quente sem próxima ação: ${o.titulo}`,
        descricao: "Definir próxima ação comercial.",
        gravidade: "alta", entidade_tipo: "oportunidade", entidade_id: o.id, client_id: o.client_id,
      });
      res.alertas++; res.afetados++;
    }
  } else if (nome.includes("proposta aprovada")) {
    const { data } = await supabase.from("proposals").select("id, titulo, numero, client_id, created_by")
      .eq("status", "aprovada").gte("updated_at", diasAtras(1));
    for (const p of (data ?? [])) {
      const { data: ex } = await supabase.from("execucao_servicos").select("id").eq("proposal_id", p.id).limit(1);
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Proposta aprovada: ${p.numero ?? p.titulo}`,
        mensagem: ex && ex.length > 0 ? "Execução criada — verifique o planejamento." : "Atenção: execução ainda não criada.",
        modulo: "execucao", prioridade: "alta", link: `/propostas/${p.id}`,
        entidade_tipo: "proposta", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  }
  // ===== Operacional =====
  else if (nome.includes("os criada sem responsável") || nome.includes("os criada sem responsavel")) {
    const { data } = await supabase.from("ordens_servico").select("id, numero, titulo, client_id").is("responsavel_tecnico_id", null);
    for (const o of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `OS sem responsável: ${o.numero}`,
        modulo: "os", prioridade: "alta", link: `/ordens-servico/${o.id}`,
        entidade_tipo: "os", entidade_id: o.id, client_id: o.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("os agendada para amanhã") || nome.includes("os agendada para amanha")) {
    const amanha = diasFrente(1);
    const { data } = await supabase.from("ordens_servico").select("id, numero, titulo, client_id, responsavel_tecnico_id, data_prevista_inicio")
      .eq("data_prevista_inicio", amanha);
    for (const o of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, o.responsavel_tecnico_id ? [o.responsavel_tecnico_id] : internos, {
        titulo: `OS agendada amanhã: ${o.numero}`,
        modulo: "os", prioridade: "normal", link: `/ordens-servico/${o.id}`,
        entidade_tipo: "os", entidade_id: o.id, client_id: o.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("os atrasada")) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("ordens_servico")
      .select("id, numero, titulo, client_id, responsavel_tecnico_id, data_prevista_conclusao, status")
      .lt("data_prevista_conclusao", hoje).not("status", "in", "(finalizada,cancelada)");
    for (const o of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, o.responsavel_tecnico_id ? [o.responsavel_tecnico_id, ...internos] : internos, {
        titulo: `OS atrasada: ${o.numero}`,
        mensagem: `Prazo previsto: ${o.data_prevista_conclusao}`,
        modulo: "os", prioridade: "critica", link: `/ordens-servico/${o.id}`,
        entidade_tipo: "os", entidade_id: o.id, client_id: o.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("os em campo sem checklist")) {
    const { data } = await supabase.from("ordens_servico").select("id, numero, client_id").eq("status", "em_campo");
    for (const o of (data ?? [])) {
      const { count } = await supabase.from("os_checklist").select("id", { count: "exact", head: true }).eq("os_id", o.id).eq("concluido", true);
      if ((count ?? 0) === 0) {
        await criarAlerta(supabase, a, { titulo: `OS em campo sem checklist: ${o.numero}`, gravidade: "alta", entidade_tipo: "os", entidade_id: o.id, client_id: o.client_id });
        res.alertas++; res.afetados++;
      }
    }
  } else if (nome.includes("serviço concluído sem documento") || nome.includes("servico concluido sem documento")) {
    const { data } = await supabase.from("execucao_servicos").select("id, titulo, client_id, responsavel_tecnico_id").eq("status", "concluido");
    for (const s of (data ?? [])) {
      const { count } = await supabase.from("documentos_tecnicos").select("id", { count: "exact", head: true }).eq("client_id", s.client_id ?? "");
      if ((count ?? 0) === 0) {
        await criarTarefa(supabase, a, {
          titulo: `Emitir documento técnico para serviço: ${s.titulo}`,
          modulo: "documentos", client_id: s.client_id ?? undefined,
          entidade_tipo: "execucao", entidade_id: s.id, responsavel_id: s.responsavel_tecnico_id ?? undefined,
        });
        res.tarefas++; res.afetados++;
      }
    }
  }
  // ===== Documental =====
  else if (nome.includes("documento vencendo")) {
    const dias = a.dias_antes ?? 30;
    const limite = diasFrente(dias);
    const { data } = await supabase.from("documentos_tecnicos").select("id, numero, titulo, client_id, data_vencimento, responsavel_tecnico_id")
      .not("data_vencimento", "is", null).lte("data_vencimento", limite).gte("data_vencimento", new Date().toISOString().slice(0, 10));
    for (const d of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, d.responsavel_tecnico_id ? [d.responsavel_tecnico_id] : internos, {
        titulo: `Documento vencendo: ${d.numero ?? d.titulo}`,
        mensagem: `Vencimento: ${d.data_vencimento}`,
        modulo: "documentos", prioridade: "alta", link: `/documentos/${d.id}`,
        entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id, automacao_id: a.id,
      });
      await criarAlerta(supabase, a, { titulo: `Renovar documento ${d.numero ?? d.titulo}`, gravidade: "media", entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id });
      res.alertas++; res.afetados++;
    }
  } else if (nome.includes("documento vencido")) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from("documentos_tecnicos").select("id, numero, titulo, client_id, data_vencimento")
      .not("data_vencimento", "is", null).lt("data_vencimento", hoje);
    for (const d of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Documento vencido: ${d.numero ?? d.titulo}`,
        mensagem: `Venceu em ${d.data_vencimento}`,
        modulo: "documentos", prioridade: "critica", link: `/documentos/${d.id}`,
        entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id, automacao_id: a.id,
      });
      await criarAlerta(supabase, a, { titulo: `Documento vencido: ${d.numero ?? d.titulo}`, gravidade: "critica", entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id });
      res.alertas++; res.afetados++;
    }
  } else if (nome.includes("documento em revisão") || nome.includes("documento em revisao")) {
    const dias = a.dias_antes ?? 5;
    const { data } = await supabase.from("documentos_tecnicos").select("id, numero, titulo, client_id, updated_at")
      .eq("status", "em_revisao").lte("updated_at", diasAtras(dias));
    for (const d of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Revisão parada há +${dias}d: ${d.numero ?? d.titulo}`,
        modulo: "documentos", prioridade: "normal", link: `/documentos/${d.id}`,
        entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("pendência documental") || nome.includes("pendencia documental")) {
    const dias = a.dias_antes ?? 3;
    const { data } = await supabase.from("documentos_pendentes").select("id, documento_solicitado, client_id, created_at, status")
      .neq("status", "recebido").lte("created_at", diasAtras(dias));
    for (const p of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Pendência sem resposta: ${p.documento_solicitado}`,
        modulo: "documentos", prioridade: "alta", link: `/documentos/pendentes`,
        entidade_tipo: "pendencia", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("documento aprovado")) {
    const { data } = await supabase.from("documentos_tecnicos").select("id, numero, titulo, client_id, visivel_para_cliente")
      .eq("status", "aprovado").eq("visivel_para_cliente", false);
    for (const d of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Liberar ao cliente: ${d.numero ?? d.titulo}`,
        mensagem: "Documento aprovado — considerar liberação no Portal do Cliente.",
        modulo: "documentos", prioridade: "normal", link: `/documentos/${d.id}`,
        entidade_tipo: "documento", entidade_id: d.id, client_id: d.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  }
  // ===== Financeira =====
  else if (nome.includes("parcela vencendo")) {
    const dias = a.dias_antes ?? 3;
    const limite = diasFrente(dias);
    const { data } = await supabase.from("financeiro_parcelas").select("id, numero, valor, client_id, data_vencimento, descricao")
      .eq("status", "a_vencer").lte("data_vencimento", limite).gte("data_vencimento", new Date().toISOString().slice(0, 10));
    for (const p of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Parcela vencendo: ${p.descricao} — R$ ${p.valor}`,
        mensagem: `Vencimento: ${p.data_vencimento}`,
        modulo: "financeiro", prioridade: "alta", link: `/financeiro/contas-receber`,
        entidade_tipo: "parcela", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("parcela vencida")) {
    await supabase.rpc("financeiro_atualizar_vencidas");
    const { data } = await supabase.from("financeiro_parcelas").select("id, valor, client_id, data_vencimento, descricao").eq("status", "vencida");
    for (const p of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Parcela vencida: ${p.descricao}`,
        mensagem: `Venceu em ${p.data_vencimento} — R$ ${p.valor}`,
        modulo: "financeiro", prioridade: "critica", link: `/financeiro/contas-receber`,
        entidade_tipo: "parcela", entidade_id: p.id, client_id: p.client_id, automacao_id: a.id,
      });
      await criarAlerta(supabase, a, { titulo: `Parcela vencida — ${p.descricao}`, gravidade: "critica", entidade_tipo: "parcela", entidade_id: p.id, client_id: p.client_id });
      res.alertas++; res.afetados++;
    }
  } else if (nome.includes("pagamento parcial")) {
    const { data } = await supabase.from("financeiro_parcelas").select("id, descricao, client_id").eq("status", "recebida_parcial");
    for (const p of (data ?? [])) {
      await criarTarefa(supabase, a, { titulo: `Acompanhar pagamento parcial: ${p.descricao}`, modulo: "financeiro", client_id: p.client_id ?? undefined, entidade_tipo: "parcela", entidade_id: p.id });
      res.tarefas++; res.afetados++;
    }
  }
  // ===== Portal do Cliente =====
  else if (nome.includes("cliente enviou documento")) {
    const { data } = await supabase.from("cliente_uploads").select("id, nome_arquivo, client_id, created_at").gte("created_at", diasAtras(1));
    for (const u of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Cliente enviou documento: ${u.nome_arquivo}`,
        modulo: "portal_cliente", prioridade: "alta", link: `/documentos/recebidos`,
        entidade_tipo: "upload_cliente", entidade_id: u.id, client_id: u.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  } else if (nome.includes("cliente respondeu comunicação") || nome.includes("cliente respondeu comunicacao")) {
    const { data } = await supabase.from("cliente_comunicacoes").select("id, assunto, client_id, autor_tipo, created_at").eq("autor_tipo", "cliente").gte("created_at", diasAtras(1));
    for (const c of (data ?? [])) {
      res.notificacoes += await notificarTodos(supabase, internos, {
        titulo: `Mensagem do cliente: ${c.assunto}`,
        modulo: "portal_cliente", prioridade: "normal", link: `/portal-cliente`,
        entidade_tipo: "comunicacao", entidade_id: c.id, client_id: c.client_id, automacao_id: a.id,
      });
      res.afetados++;
    }
  }
  // ===== IA =====
  else if (nome.includes("alertas inteligentes")) {
    await supabase.functions.invoke("ia-gerar-alertas", { body: {} });
    res.detalhe = "Engine de alertas IA disparada";
  } else {
    res.detalhe = "Sem regra implementada para esta automação";
  }

  res.detalhe ||= `${res.afetados} registros processados`;
  return res;
}