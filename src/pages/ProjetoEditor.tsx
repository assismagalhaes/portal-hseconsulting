import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDate, formatDateTime } from "@/lib/format";
import { projetoStatusColor, projetoStatusLabel, projetoServicoStatusColor, projetoServicoStatusLabel } from "@/lib/projetos";
import { ArrowLeft, FileText, ClipboardList, FileSignature, DollarSign, History, RefreshCw, Save, Building2, User, Mail, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";

function InfoRow({ label, value, mono, icon, href }: { label: string; value?: any; mono?: boolean; icon?: React.ReactNode; href?: string }) {
  const display = value == null || value === "" ? "—" : String(value);
  const content = href && display !== "—"
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-primary hover:underline break-all">{display}</a>
    : <span className="break-all">{display}</span>;
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{content}</div>
    </div>
  );
}

export default function ProjetoEditor() {
  const { id } = useParams();
  const { isTecnico } = useAuth();
  const [projeto, setProjeto] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [os, setOs] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [contrato, setContrato] = useState<any>(null);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [renovacoes, setRenovacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [valorContratado, setValorContratado] = useState<number | null>(null);
  const [valoresServicos, setValoresServicos] = useState<Record<string, number>>({});

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: p } = await supabase
      .from("projetos")
      .select("*, clients(id, razao_social, nome_fantasia, cnpj_cpf, cidade, uf, endereco, bairro, cep, email, telefone, whatsapp, solicitante, cargo, qtd_funcionarios), proposals(numero)")
      .eq("id", id).maybeSingle();
    setProjeto(p);
    document.title = `${p?.numero || "Projeto"} | HSE Consulting`;

    const [s, o, d, t, ren, u, pr] = await Promise.all([
      supabase.from("projeto_servicos").select("*").eq("projeto_id", id).order("created_at"),
      supabase.from("ordens_servico").select("id, numero, status, prioridade, titulo, data_prevista_conclusao").eq("projeto_id", id),
      supabase.from("documentos_tecnicos").select("id, numero, tipo, titulo, status, data_emissao, data_vencimento").eq("projeto_id", id),
      supabase.from("projeto_timeline").select("*").eq("projeto_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("projeto_renovacoes").select("*, projeto_servicos(nome)").eq("projeto_id", id),
      supabase.from("profiles").select("id, nome, email").eq("status", "ativo").order("nome"),
      supabase.from("execucao_profissionais").select("id, nome, cargo").order("nome"),
    ]);
    setServicos(s.data || []);
    setOs(o.data || []);
    setDocs(d.data || []);
    setTimeline(t.data || []);
    setRenovacoes(ren.data || []);
    setUsuarios(u.data || []);
    setProfissionais(pr.data || []);

    if (!isTecnico && p?.financeiro_contrato_id) {
      const { data: c } = await supabase.from("financeiro_contratos").select("*").eq("id", p.financeiro_contrato_id).maybeSingle();
      setContrato(c);
      const { data: pa } = await supabase.from("financeiro_parcelas").select("*").eq("contrato_id", p.financeiro_contrato_id).order("numero");
      setParcelas(pa || []);
    }

    if (!isTecnico && id) {
      const [{ data: vp }, { data: vs }] = await Promise.all([
        supabase.rpc("get_projetos_valores", { _ids: [id] }),
        supabase.rpc("get_projeto_servicos_valores", { _projeto_id: id }),
      ]);
      setValorContratado(vp?.[0]?.valor_contratado ?? null);
      const map: Record<string, number> = {};
      (vs || []).forEach((r: any) => { map[r.id] = Number(r.valor || 0); });
      setValoresServicos(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, isTecnico]);

  const saveProjeto = async (patch: any) => {
    if (!id) return;
    const { error } = await supabase.from("projetos").update(patch).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Salvo" });
    setProjeto({ ...projeto, ...patch });
  };

  const updateServico = async (sid: string, patch: any) => {
    const { error } = await supabase.from("projeto_servicos").update(patch).eq("id", sid);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    await load();
  };

  if (loading || !projeto) {
    return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  }

  const cliente = projeto.clients?.nome_fantasia || projeto.clients?.razao_social || "—";

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diasRestantes = projeto.data_fim_prevista
    ? Math.round((new Date(projeto.data_fim_prevista).setHours(0, 0, 0, 0) - hoje.getTime()) / 86400000)
    : null;
  const drLabel = diasRestantes === null ? "—" : diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atraso` : `${diasRestantes}d restantes`;
  const pendencias = servicos.filter((s) => s.status !== "concluido" && s.status !== "cancelado").length;

  return (
    <div>
      <PageHeader
        title={`${projeto.numero} — ${projeto.titulo}`}
        subtitle={cliente}
        actions={
          <div className="flex items-center gap-2">
            <Badge className={projetoStatusColor[projeto.status] + " border-0"}>{projetoStatusLabel[projeto.status]}</Badge>
            <Button asChild variant="outline" size="sm"><Link to="/projetos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Header KPIs */}
        {isTecnico ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Serviços</div>
              <div className="font-display text-xl font-bold mt-1">{servicos.filter(s => s.status === "concluido").length}/{servicos.length}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ordens de Serviço</div>
              <div className="font-display text-xl font-bold mt-1">{os.length}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Documentos</div>
              <div className="font-display text-xl font-bold mt-1">{docs.length}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Progresso</div>
              <div className="font-display text-xl font-bold mt-1">{projeto.percentual_progresso || 0}%</div>
              <Progress value={projeto.percentual_progresso || 0} className="h-1.5 mt-1.5" />
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Prazo</div>
              <div className="font-display text-sm font-bold mt-1">{formatDate(projeto.data_fim_prevista)}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{drLabel}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pendências</div>
              <div className="font-display text-xl font-bold mt-1">{pendencias}</div>
            </CardContent></Card>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor contratado</div>
              <div className="font-display text-xl font-bold mt-1">{brl(valorContratado ?? 0)}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Recebido</div>
              <div className="font-display text-xl font-bold mt-1">{brl(contrato?.valor_recebido || 0)}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Serviços</div>
              <div className="font-display text-xl font-bold mt-1">{servicos.filter(s => s.status === "concluido").length}/{servicos.length}</div>
            </CardContent></Card>
            <Card className="shadow-elegant"><CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Progresso</div>
              <div className="font-display text-xl font-bold mt-1">{projeto.percentual_progresso || 0}%</div>
              <Progress value={projeto.percentual_progresso || 0} className="h-1.5 mt-1.5" />
            </CardContent></Card>
          </div>
        )}

        <Tabs defaultValue="visao">
          <TabsList>
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
            <TabsTrigger value="servicos">Serviços ({servicos.length})</TabsTrigger>
            <TabsTrigger value="os">Ordens de Serviço ({os.length})</TabsTrigger>
            <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger>
            {!isTecnico && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
            {!isTecnico && <TabsTrigger value="renovacoes">Renovações ({renovacoes.length})</TabsTrigger>}
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="mt-4">
            <Card className="shadow-elegant">
              <CardHeader><CardTitle className="font-display text-base">Dados do projeto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Título</Label>
                    <Input defaultValue={projeto.titulo} onBlur={(e) => e.target.value !== projeto.titulo && saveProjeto({ titulo: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={projeto.status} onValueChange={(v) => saveProjeto({ status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(projetoStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data início</Label>
                    <Input type="date" defaultValue={projeto.data_inicio || ""} onBlur={(e) => saveProjeto({ data_inicio: e.target.value || null })} />
                  </div>
                  <div>
                    <Label>Data prevista de conclusão</Label>
                    <Input type="date" defaultValue={projeto.data_fim_prevista || ""} onBlur={(e) => saveProjeto({ data_fim_prevista: e.target.value || null })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Responsável de Execução</Label>
                    <Select
                      value={projeto.responsavel_execucao_id || "none"}
                      onValueChange={(v) => saveProjeto({ responsavel_execucao_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sem responsável —</SelectItem>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      O responsável de execução terá acesso a todo o projeto (serviços, OS, documentos) automaticamente.
                    </p>
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea defaultValue={projeto.observacoes || ""} onBlur={(e) => saveProjeto({ observacoes: e.target.value || null })} rows={4} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Origem: Proposta <Link className="underline" to={`/propostas/${projeto.proposal_id}`}>{projeto.proposals?.numero || "—"}</Link> · Cliente {cliente}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cliente" className="mt-4">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoRow label="Razão Social" value={projeto.clients?.razao_social} />
                  <InfoRow label="Nome Fantasia" value={projeto.clients?.nome_fantasia} />
                  <InfoRow label="CNPJ / CPF" value={projeto.clients?.cnpj_cpf} mono />
                  <InfoRow label="Funcionários" value={projeto.clients?.qtd_funcionarios || "—"} />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Endereço</div>
                  <div className="grid gap-4 md:grid-cols-2 rounded-lg border p-4 bg-muted/30">
                    <InfoRow label="Logradouro" value={projeto.clients?.endereco} />
                    <InfoRow label="Bairro" value={projeto.clients?.bairro} />
                    <InfoRow label="CEP" value={projeto.clients?.cep} />
                    <InfoRow label="Cidade / UF" value={[projeto.clients?.cidade, projeto.clients?.uf].filter(Boolean).join(" / ") || "—"} />
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Pessoa de Contato</div>
                  <div className="grid gap-4 md:grid-cols-2 rounded-lg border p-4 bg-muted/30">
                    <InfoRow label="Nome" value={projeto.clients?.solicitante} />
                    <InfoRow label="Cargo" value={projeto.clients?.cargo} />
                    <InfoRow
                      label="E-mail"
                      icon={<Mail className="h-3.5 w-3.5" />}
                      value={projeto.clients?.email}
                      href={projeto.clients?.email ? `mailto:${projeto.clients.email}` : undefined}
                    />
                    <InfoRow
                      label="Telefone"
                      icon={<Phone className="h-3.5 w-3.5" />}
                      value={projeto.clients?.telefone}
                      href={projeto.clients?.telefone ? `tel:${projeto.clients.telefone}` : undefined}
                    />
                    <InfoRow
                      label="WhatsApp"
                      value={projeto.clients?.whatsapp}
                      href={projeto.clients?.whatsapp ? `https://wa.me/55${(projeto.clients.whatsapp || "").replace(/\D/g, "")}` : undefined}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Informações do cliente disponíveis para consulta. Alterações cadastrais devem ser feitas na tela de Clientes pelo perfil responsável.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servicos" className="mt-4">
            <Card className="shadow-elegant">
              <CardContent className="p-0">
                {servicos.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">Nenhum serviço contratado.</div>
                ) : (
                  <ul className="divide-y">
                    {servicos.map((s) => (
                      <li key={s.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium flex-1 min-w-[200px]">{s.nome}</span>
                          {s.categoria && <Badge variant="outline" className="text-[10px]">{s.categoria}</Badge>}
                          <Select value={s.status} onValueChange={(v) => updateServico(s.id, { status: v })}>
                            <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(projetoServicoStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Badge className={projetoServicoStatusColor[s.status] + " border-0"}>{projetoServicoStatusLabel[s.status]}</Badge>
                          {!isTecnico && (
                            <span className="font-mono text-sm w-24 text-right">{brl(valoresServicos[s.id] ?? 0)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number" min={0} max={100} className="w-24 h-8"
                            defaultValue={s.percentual_progresso}
                            onBlur={(e) => {
                              const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              if (v !== s.percentual_progresso) updateServico(s.id, { percentual_progresso: v });
                            }}
                          />
                          <Progress value={s.percentual_progresso || 0} className="h-2 flex-1" />
                          <div className="text-xs text-muted-foreground w-32 text-right">
                            {s.data_validade ? `Validade: ${formatDate(s.data_validade)}` : (s.validade_meses ? `${s.validade_meses} meses` : "sem validade")}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="os" className="mt-4">
            <Card className="shadow-elegant">
              <CardContent className="p-0">
                {os.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">Nenhuma OS vinculada.</div>
                ) : (
                  <ul className="divide-y">
                    {os.map((o) => (
                      <li key={o.id} className="p-4 hover:bg-muted/40">
                        <Link to={`/ordens-servico/${o.id}`} className="flex items-center gap-3">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">{o.numero}</span>
                          <span className="flex-1 truncate">{o.titulo}</span>
                          <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(o.data_prevista_conclusao)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <Card className="shadow-elegant">
              <CardContent className="p-0">
                {docs.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">Nenhum documento vinculado a este projeto.</div>
                ) : (
                  <ul className="divide-y">
                    {docs.map((d) => (
                      <li key={d.id} className="p-4 hover:bg-muted/40">
                        <Link to={`/documentos/${d.id}`} className="flex items-center gap-3">
                          <FileSignature className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-xs">{d.numero}</span>
                          <span className="flex-1 truncate">{d.titulo}</span>
                          <Badge variant="outline" className="text-[10px]">{d.tipo}</Badge>
                          <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(d.data_vencimento)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financeiro" className="mt-4">
            {!contrato ? (
              <Card className="shadow-elegant"><CardContent className="p-10 text-center text-muted-foreground">Nenhum contrato financeiro vinculado.</CardContent></Card>
            ) : (
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Contrato {contrato.numero}
                    <Link to={`/financeiro/contratos/${contrato.id}`} className="ml-auto text-xs underline">Ver detalhes</Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3 mb-4">
                    <div><div className="text-[11px] text-muted-foreground uppercase">Aprovado</div><div className="font-mono text-lg">{brl(contrato.valor_aprovado)}</div></div>
                    <div><div className="text-[11px] text-muted-foreground uppercase">Recebido</div><div className="font-mono text-lg text-emerald-700">{brl(contrato.valor_recebido)}</div></div>
                    <div><div className="text-[11px] text-muted-foreground uppercase">Saldo</div><div className="font-mono text-lg">{brl((contrato.valor_aprovado || 0) - (contrato.valor_recebido || 0))}</div></div>
                  </div>
                  {parcelas.length > 0 && (
                    <ul className="divide-y border rounded">
                      {parcelas.map((p) => (
                        <li key={p.id} className="p-3 flex items-center gap-3 text-sm">
                          <span className="font-mono text-xs w-10">#{p.numero}</span>
                          <span className="flex-1 truncate">{p.descricao}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(p.data_vencimento)}</span>
                          <span className="font-mono w-24 text-right">{brl(p.valor)}</span>
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="renovacoes" className="mt-4">
            <Card className="shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Renovações</CardTitle>
                <Button size="sm" variant="outline" onClick={async () => {
                  const { data, error } = await supabase.rpc("projetos_gerar_renovacoes");
                  if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
                  else { toast({ title: `${data || 0} renovações geradas` }); load(); }
                }}>Gerar agora</Button>
              </CardHeader>
              <CardContent className="p-0">
                {renovacoes.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">Nenhuma renovação próxima. Use "Gerar agora" para varrer serviços com validade próxima.</div>
                ) : (
                  <ul className="divide-y">
                    {renovacoes.map((r) => (
                      <li key={r.id} className="p-4 flex items-center gap-3 text-sm">
                        <span className="flex-1">{r.projeto_servicos?.nome}</span>
                        <span className="text-xs text-muted-foreground">Vence em {formatDate(r.data_validade)}</span>
                        {r.oportunidade_id && <Link className="text-xs underline" to={`/crm/oportunidades`}>Ver oportunidade</Link>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card className="shadow-elegant">
              <CardContent className="p-0">
                {timeline.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">Sem eventos.</div>
                ) : (
                  <ul className="divide-y">
                    {timeline.map((t) => (
                      <li key={t.id} className="p-3 flex items-start gap-3 text-sm">
                        <History className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">{t.evento}</div>
                          {t.detalhe && <div className="text-xs text-muted-foreground">{t.detalhe}</div>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}