import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ConviteRow,
  ParticipanteRow,
  aplicarPlaceholders,
  atualizarParticipante,
  criarParticipante,
  csvSafe,
  editarParticipanteSeguro,
  gerarLinksAssinados,
  inativarParticipante,
  isEmailValido,
  isFoneValido,
  listarConvitesDaAvaliacao,
  listarParticipantes,
  marcarDistribuido,
  mascararEmail,
  mascararTelefone,
  prepararConvites,
  reativarParticipante,
  regenerarConvite,
  revogarConvite,
} from "@/lib/psicoParticipantes";
import { Copy, Download, FileUp, Link as LinkIcon, MoreHorizontal, Pencil, Plus, RefreshCw, Ban, UserX, UserCheck } from "lucide-react";
import { PsicoImportWizard } from "./PsicoImportWizard";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Props {
  avaliacaoId: string;
  clienteNome: string;
  tituloAvaliacao: string;
  mensagemConvite: string;
  assuntoConvite: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  quantidadePrevista: number;
  status: string;
  temVersaoPublicada: boolean;
  codigoAvaliacao: string;
}

export default function PsicoParticipantes(props: Props) {
  const [parts, setParts] = useState<ParticipanteRow[]>([]);
  const [conv, setConv] = useState<ConviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDistribuir, setShowDistribuir] = useState<{ ids: string[] } | null>(null);
  const [showRevogar, setShowRevogar] = useState<string | null>(null);
  const [showInativar, setShowInativar] = useState<string | null>(null);
  const [showEditar, setShowEditar] = useState<ParticipanteRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busca, setBusca] = useState("");

  const podeCadastrar = props.status !== "cancelada" && props.temVersaoPublicada;

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      listarParticipantes(props.avaliacaoId),
      listarConvitesDaAvaliacao(props.avaliacaoId),
    ]);
    setParts(p || []);
    setConv(c || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [props.avaliacaoId]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      const { data } = await (supabase as any)
        .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const conviteAtivoPorPart = useMemo(() => {
    const m = new Map<string, ConviteRow>();
    for (const c of conv) {
      if (["preparado", "ativo", "respondido"].includes(c.status)) m.set(c.participante_id, c);
    }
    return m;
  }, [conv]);

  const ativos = parts.filter((p) => p.ativo);
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.funcao || "").toLowerCase().includes(q) ||
        (p.setor || "").toLowerCase().includes(q) ||
        (p.unidade || "").toLowerCase().includes(q),
    );
  }, [parts, busca]);

  const cardStats = {
    previstos: props.quantidadePrevista,
    ativos: ativos.length,
    preparados: conv.filter((c) => c.status === "preparado" || c.status === "ativo").length,
    distribuidos: conv.filter((c) => c.distribuido_em).length,
    pendentes: ativos.filter((p) => {
      const c = conviteAtivoPorPart.get(p.id);
      return !c || c.status !== "respondido";
    }).length,
    respondidos: conv.filter((c) => c.status === "respondido").length,
  };

  const gruposSetor = useMemo(() => contarGrupos(ativos, "setor"), [ativos]);
  const gruposFuncao = useMemo(() => contarGrupos(ativos, "funcao"), [ativos]);

  async function prepararSelecionados(ids?: string[]) {
    const lista = ids || Array.from(selected);
    const sem = lista.filter((id) => {
      const p = parts.find((x) => x.id === id);
      if (!p || !p.ativo) return false;
      return !conviteAtivoPorPart.has(id);
    });
    if (!sem.length) return toast.info("Não há participantes ativos sem convite válido.");
    const { error } = await prepararConvites(props.avaliacaoId, sem);
    if (error) return toast.error(error.message || String(error));
    toast.success(`${sem.length} link(s) preparado(s).`);
    setSelected(new Set());
    load();
  }

  async function copiarLink(conviteId: string) {
    const { data, error } = await gerarLinksAssinados([conviteId]);
    if (error) return toast.error("Falha ao gerar link.");
    const link = data?.[0]?.link;
    if (!link) return toast.error("Convite indisponível.");
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado.");
  }

  async function copiarMensagem(part: ParticipanteRow, conviteId: string) {
    const { data } = await gerarLinksAssinados([conviteId]);
    const link = data?.[0]?.link;
    if (!link) return toast.error("Convite indisponível.");
    const msg = aplicarPlaceholders(props.mensagemConvite || "", {
      nome: part.nome,
      cliente: props.clienteNome,
      titulo: props.tituloAvaliacao,
      link,
      dataInicio: props.dataInicio || "",
      dataFim: props.dataFim || "",
    });
    await navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada.");
  }

  async function exportarAcessos() {
    if (!ativos.length) return toast.info("Nenhum participante ativo.");
    const ids = ativos.map((p) => conviteAtivoPorPart.get(p.id)?.id).filter(Boolean) as string[];
    const linksMap = new Map<string, string>();
    if (ids.length) {
      const { data } = await gerarLinksAssinados(ids);
      for (const r of data || []) if (r.link) linksMap.set(r.id, r.link);
    }
    const header = ["Nome", "E-mail", "Telefone", "Função", "Setor", "Unidade", "Status do acesso", "Distribuição", "Participação", "Link"];
    const rows = ativos.map((p) => {
      const c = conviteAtivoPorPart.get(p.id);
      return [
        p.nome,
        p.email || "",
        p.telefone || "",
        p.funcao || "",
        p.setor || "",
        p.unidade || "",
        c ? c.status : "não preparado",
        c?.distribuido_em ? "distribuído" : "não marcada",
        c?.status === "respondido" ? "respondido" : "pendente",
        (c && linksMap.get(c.id)) || "",
      ].map(csvSafe);
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.codigoAvaliacao}-participantes-acessos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function baixarModelo() {
    const header = ["Nome", "E-mail", "Telefone", "Função", "Setor", "Unidade"];
    const linhas = [
      ["Maria da Silva", "maria@empresa.com.br", "11999999999", "Assistente Administrativo", "Administrativo", "Matriz"],
      ["João de Souza", "joao@empresa.com.br", "11988888888", "Auxiliar de Produção", "Produção", "Matriz"],
    ];
    const instrucoes = [
      ["Modelo de importação de participantes — Avaliação de Fatores Psicossociais"],
      [""],
      ["Instruções de preenchimento:"],
      ["1. Preencha uma linha por participante na aba \"Participantes\"."],
      ["2. Não altere, remova ou reordene os títulos das colunas."],
      ["3. Nome é obrigatório. E-mail ou Telefone: pelo menos um deve estar preenchido."],
      ["4. Telefone: informe apenas números com DDD (ex.: 11999999999)."],
      ["5. Função, Setor e Unidade são opcionais, mas ajudam na segmentação dos resultados."],
      ["6. Remova as linhas de exemplo antes de importar."],
      ["7. Salve o arquivo em formato .xlsx e faça o upload em \"Importar planilha\"."],
    ];
    const wb = XLSX.utils.book_new();
    const wsDados = XLSX.utils.aoa_to_sheet([header, ...linhas]);
    (wsDados as any)["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDados, "Participantes");
    const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
    (wsInstr as any)["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");
    XLSX.writeFile(wb, "modelo-participantes-psicossocial.xlsx");
  }

  if (!podeCadastrar) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Para cadastrar participantes, vincule uma versão publicada do questionário e da metodologia a esta avaliação.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Participantes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cadastre os trabalhadores, prepare os acessos individuais e acompanhe a participação sem vincular a identificação ao conteúdo das respostas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar participante</Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><FileUp className="h-4 w-4 mr-1" /> Importar participantes</Button>
            <Button size="sm" variant="outline" onClick={baixarModelo}><Download className="h-4 w-4 mr-1" /> Baixar modelo</Button>
            <Button size="sm" variant="outline" onClick={() => prepararSelecionados(ativos.map((p) => p.id))}>
              <LinkIcon className="h-4 w-4 mr-1" /> Preparar links individuais
            </Button>
            <Button size="sm" variant="outline" onClick={exportarAcessos}><Download className="h-4 w-4 mr-1" /> Exportar acessos</Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            {Object.entries({
              Previstos: cardStats.previstos,
              Ativos: cardStats.ativos,
              "Links preparados": cardStats.preparados,
              Distribuídos: cardStats.distribuidos,
              Pendentes: cardStats.pendentes,
              Respondidos: cardStats.respondidos,
            }).map(([k, v]) => (
              <div key={k} className="rounded border p-2">
                <div className="text-[11px] text-muted-foreground uppercase">{k}</div>
                <div className="text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground border rounded p-3 bg-muted/30">
            <strong>Proteção dos resultados coletivos.</strong> A emissão futura do resultado global exigirá no mínimo 2 respondentes.
            Resultados por função, setor ou unidade somente serão apresentados quando o grupo possuir no mínimo 3 respondentes.
          </div>

          {(gruposSetor.length > 0 || gruposFuncao.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ResumoGrupos titulo="Por setor" itens={gruposSetor} />
              <ResumoGrupos titulo="Por função" itens={gruposFuncao} />
            </div>
          )}

          <div className="flex gap-2 items-center">
            <Input placeholder="Buscar por nome, função, setor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Participação</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">Nenhum participante cadastrado.</TableCell></TableRow>
                ) : filtered.map((p) => {
                  const c = conviteAtivoPorPart.get(p.id);
                  return (
                    <TableRow key={p.id} className={!p.ativo ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={(v) => {
                            const s = new Set(selected);
                            if (v) s.add(p.id); else s.delete(p.id);
                            setSelected(s);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.nome}
                        {!p.ativo && <Badge variant="outline" className="ml-2">Inativo</Badge>}
                      </TableCell>
                      <TableCell>{p.funcao || "—"}</TableCell>
                      <TableCell>{p.setor || "—"}</TableCell>
                      <TableCell>{p.unidade || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div>{mascararEmail(p.email)}</div>
                        <div>{mascararTelefone(p.telefone)}</div>
                      </TableCell>
                      <TableCell>
                        {!c ? <Badge variant="outline">Não preparado</Badge>
                          : c.status === "preparado" ? <Badge>Preparado</Badge>
                          : c.status === "ativo" ? <Badge className="bg-blue-500">Ativo</Badge>
                          : c.status === "revogado" ? <Badge variant="destructive">Revogado</Badge>
                          : <Badge variant="outline">{c.status}</Badge>}
                        {c?.distribuido_em && <Badge variant="outline" className="ml-1">Distribuído</Badge>}
                      </TableCell>
                      <TableCell>
                        {c?.status === "respondido"
                          ? <Badge className="bg-emerald-600">Respondido</Badge>
                          : <Badge variant="outline">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!c && p.ativo && (
                              <DropdownMenuItem onClick={() => prepararSelecionados([p.id])}>
                                <LinkIcon className="h-4 w-4 mr-2" /> Preparar link
                              </DropdownMenuItem>
                            )}
                            {c && c.status !== "revogado" && c.status !== "respondido" && (
                              <>
                                <DropdownMenuItem onClick={() => copiarLink(c.id)}><Copy className="h-4 w-4 mr-2" /> Copiar link</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copiarMensagem(p, c.id)}><Copy className="h-4 w-4 mr-2" /> Copiar mensagem</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowDistribuir({ ids: [c.id] })}>
                                  Marcar como distribuído
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={async () => {
                                  const { error } = await regenerarConvite(c.id, "Solicitação do usuário");
                                  if (error) toast.error((error as any).message || "Falha");
                                  else { toast.success("Convite regenerado."); load(); }
                                }}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Regenerar link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowRevogar(c.id)}>
                                  <Ban className="h-4 w-4 mr-2" /> Revogar link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {p.ativo ? (
                              <>
                              <DropdownMenuItem onClick={() => setShowEditar(p)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {conviteAtivoPorPart.get(p.id)?.status === "respondido" || conviteAtivoPorPart.get(p.id)?.respondido_em
                                  ? "Corrigir cadastro"
                                  : "Editar participante"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowInativar(p.id)}>
                                <UserX className="h-4 w-4 mr-2" /> Inativar participante
                              </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={async () => {
                                const { error } = await reativarParticipante(p.id);
                                if (error) toast.error((error as any).message);
                                else { toast.success("Reativado."); load(); }
                              }}>
                                <UserCheck className="h-4 w-4 mr-2" /> Reativar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {selected.size > 0 && (
            <div className="flex gap-2 items-center text-sm bg-muted p-2 rounded">
              <span>{selected.size} selecionado(s)</span>
              <Button size="sm" variant="outline" onClick={() => prepararSelecionados()}>Preparar links</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AdicionarDialog open={showAdd} onOpenChange={setShowAdd} avaliacaoId={props.avaliacaoId} onSaved={load} sugestoes={{
        funcao: uniqueVals(parts, "funcao"),
        setor: uniqueVals(parts, "setor"),
        unidade: uniqueVals(parts, "unidade"),
      }} />

      <PsicoImportWizard
        open={showImport}
        onOpenChange={setShowImport}
        avaliacaoId={props.avaliacaoId}
        existentes={parts}
        onDone={load}
      />

      <Dialog open={!!showDistribuir} onOpenChange={(v) => !v && setShowDistribuir(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como distribuído</DialogTitle></DialogHeader>
          <DistribuirForm
            onSubmit={async (canal, obs) => {
              const ids = showDistribuir?.ids || [];
              const { error } = await marcarDistribuido(ids, canal, obs);
              if (error) toast.error((error as any).message);
              else { toast.success("Distribuição registrada."); setShowDistribuir(null); load(); }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRevogar} onOpenChange={(v) => !v && setShowRevogar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar convite</DialogTitle></DialogHeader>
          <RevogarForm
            onSubmit={async (motivo) => {
              if (!showRevogar) return;
              const { error } = await revogarConvite(showRevogar, motivo);
              if (error) toast.error((error as any).message);
              else { toast.success("Convite revogado."); setShowRevogar(null); load(); }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!showInativar} onOpenChange={(v) => !v && setShowInativar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inativar participante</DialogTitle></DialogHeader>
          <RevogarForm
            label="Motivo da inativação"
            onSubmit={async (motivo) => {
              if (!showInativar) return;
              const { error } = await inativarParticipante(showInativar, motivo);
              if (error) toast.error((error as any).message);
              else { toast.success("Participante inativado."); setShowInativar(null); load(); }
            }}
          />
        </DialogContent>
      </Dialog>

      <EditarDialog
        participante={showEditar}
        onOpenChange={(v) => !v && setShowEditar(null)}
        onSaved={() => { setShowEditar(null); load(); }}
        respondido={showEditar ? !!(conviteAtivoPorPart.get(showEditar.id)?.status === "respondido" || conviteAtivoPorPart.get(showEditar.id)?.respondido_em) : false}
        distribuido={showEditar ? !!conviteAtivoPorPart.get(showEditar.id)?.distribuido_em : false}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function uniqueVals(rows: ParticipanteRow[], key: "funcao" | "setor" | "unidade") {
  const s = new Set<string>();
  rows.forEach((r) => { if (r[key]) s.add(r[key] as string); });
  return Array.from(s).sort();
}

function contarGrupos(rows: ParticipanteRow[], key: "funcao" | "setor" | "unidade") {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return Array.from(m.entries()).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
}

function ResumoGrupos({ titulo, itens }: { titulo: string; itens: { nome: string; qtd: number }[] }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs uppercase text-muted-foreground mb-2">{titulo}</div>
      <ul className="space-y-1 text-sm">
        {itens.slice(0, 8).map((g) => (
          <li key={g.nome} className="flex justify-between">
            <span>{g.nome}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{g.qtd}</span>
              {g.qtd < 3 && <Badge variant="outline" className="text-[10px]">Abaixo do mínimo para segmentação</Badge>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdicionarDialog({ open, onOpenChange, avaliacaoId, onSaved, sugestoes }: {
  open: boolean; onOpenChange: (v: boolean) => void; avaliacaoId: string; onSaved: () => void;
  sugestoes: { funcao: string[]; setor: string[]; unidade: string[] };
}) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" });
  useEffect(() => { if (!open) setForm({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" }); }, [open]);
  async function salvar() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (form.email && !isEmailValido(form.email)) return toast.error("E-mail inválido");
    if (form.telefone && !isFoneValido(form.telefone)) return toast.error("Telefone com número de dígitos incompatível");
    const { error } = await criarParticipante({
      avaliacao_id: avaliacaoId,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
      funcao: form.funcao || null,
      setor: form.setor || null,
      unidade: form.unidade || null,
      origem_cadastro: "manual",
    });
    if (error) return toast.error((error as any).message || "Falha ao cadastrar");
    toast.success("Participante cadastrado.");
    onOpenChange(false);
    onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar participante</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
          <div><Label>Função</Label><Input list="fs-funcao" value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
            <datalist id="fs-funcao">{sugestoes.funcao.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div><Label>Setor</Label><Input list="fs-setor" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
            <datalist id="fs-setor">{sugestoes.setor.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div className="sm:col-span-2"><Label>Unidade</Label><Input list="fs-unidade" value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            <datalist id="fs-unidade">{sugestoes.unidade.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Cadastro sem e-mail e sem telefone é permitido — o link poderá ser distribuído manualmente.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DistribuirForm({ onSubmit }: { onSubmit: (canal: string, obs?: string) => void }) {
  const [canal, setCanal] = useState("whatsapp");
  const [obs, setObs] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <Label>Canal</Label>
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="impresso">Impresso</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Observação (opcional, não incluir dados sensíveis)</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(canal, obs || undefined)}>Registrar</Button>
      </DialogFooter>
    </div>
  );
}

function RevogarForm({ label = "Motivo", onSubmit }: { label?: string; onSubmit: (m: string) => void }) {
  const [m, setM] = useState("");
  return (
    <div className="space-y-3">
      <div><Label>{label} *</Label><Textarea rows={3} value={m} onChange={(e) => setM(e.target.value)} /></div>
      <DialogFooter>
        <Button onClick={() => { if (!m.trim()) return toast.error("Informe o motivo"); onSubmit(m); }}>Confirmar</Button>
      </DialogFooter>
    </div>
  );
}

function EditarDialog({ participante, onOpenChange, onSaved, respondido, distribuido, isAdmin }: {
  participante: ParticipanteRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  respondido: boolean;
  distribuido: boolean;
  isAdmin: boolean;
}) {
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", funcao: "", setor: "", unidade: "" });
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);
  const open = !!participante;

  useEffect(() => {
    if (participante) {
      setForm({
        nome: participante.nome || "",
        email: participante.email || "",
        telefone: participante.telefone || "",
        funcao: participante.funcao || "",
        setor: participante.setor || "",
        unidade: participante.unidade || "",
      });
      setJustificativa("");
    }
  }, [participante]);

  const contatoAlterado = !!participante && (
    (form.email || "") !== (participante.email || "") ||
    (form.telefone || "") !== (participante.telefone || "") ||
    (form.nome || "") !== (participante.nome || "")
  );
  const segmentacaoAlterada = !!participante && (
    (form.funcao || "") !== (participante.funcao || "") ||
    (form.setor || "") !== (participante.setor || "") ||
    (form.unidade || "") !== (participante.unidade || "")
  );

  const bloqueadoSalvar =
    respondido && (segmentacaoAlterada || (contatoAlterado && !isAdmin));

  async function salvar() {
    if (!participante) return;
    if (!form.nome.trim()) return toast.error("Nome é obrigatório.");
    if (form.email && !isEmailValido(form.email)) return toast.error("E-mail inválido.");
    if (form.telefone && !isFoneValido(form.telefone)) return toast.error("Telefone inválido.");
    if (respondido && contatoAlterado) {
      if (!isAdmin) return toast.error("Somente administradores podem corrigir dados após resposta.");
      if (justificativa.trim().length < 10) return toast.error("Justificativa obrigatória (mínimo 10 caracteres).");
    }
    setSaving(true);
    const { error } = await editarParticipanteSeguro({
      participante_id: participante.id,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone || null,
      funcao: form.funcao || null,
      setor: form.setor || null,
      unidade: form.unidade || null,
      justificativa: respondido && contatoAlterado ? justificativa : null,
    });
    setSaving(false);
    if (error) return toast.error((error as any).message || "Falha ao salvar.");
    toast.success("Participante atualizado.");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{respondido ? "Corrigir cadastro (participante respondido)" : "Editar participante"}</DialogTitle>
        </DialogHeader>
        {respondido && (
          <div className="text-xs rounded border p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">
            Este participante já concluiu o questionário. Função, setor e unidade não podem ser alterados
            pois foram utilizados na consolidação da participação. A correção destes dados serve apenas para
            manutenção do cadastro nominal e não altera o conteúdo ou a segmentação da resposta já enviada.
          </div>
        )}
        {!respondido && distribuido && contatoAlterado && (
          <div className="text-xs rounded border p-2 bg-muted">
            O acesso já foi marcado como distribuído. Confirme se será necessário enviar novamente o link ao participante.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input autoComplete="off" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input autoComplete="off" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div>
            <Label>Função</Label>
            <Input autoComplete="off" disabled={respondido} value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
          </div>
          <div>
            <Label>Setor</Label>
            <Input autoComplete="off" disabled={respondido} value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Unidade</Label>
            <Input autoComplete="off" disabled={respondido} value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
          </div>
          {respondido && contatoAlterado && (
            <div className="sm:col-span-2">
              <Label>Justificativa da correção *</Label>
              <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">A justificativa não é armazenada em texto — apenas a existência dela é registrada na auditoria.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {(!respondido || isAdmin) && (
            <Button onClick={salvar} disabled={saving || bloqueadoSalvar}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}