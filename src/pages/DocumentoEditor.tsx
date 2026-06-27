import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, GitBranch, Check, Send, Printer, Upload, Trash2, Paperclip, History } from "lucide-react";
import { toast } from "sonner";
import DocEditor from "@/components/documentos/DocEditor";
import { STATUS_DOCUMENTO, TIPOS_DOCUMENTO, statusColor, statusLabel, statusValidade, proximoStatus } from "@/lib/documentos";

export default function DocumentoEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [oss, setOss] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [variaveis, setVariaveis] = useState<any[]>([]);
  const [revisoes, setRevisoes] = useState<any[]>([]);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [aprov, setAprov] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [html, setHtml] = useState("");
  const [revDesc, setRevDesc] = useState("");
  const [revOpen, setRevOpen] = useState(false);
  const [aprovOpen, setAprovOpen] = useState(false);
  const [aprovObs, setAprovObs] = useState("");

  const load = async () => {
    if (!id) return;
    const [d, c, p, e, o, pr, v, rv, ax, ap, tl] = await Promise.all([
      supabase.from("documentos_tecnicos").select("*").eq("id", id).single(),
      supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
      supabase.from("proposals").select("id, numero, titulo").order("created_at", { ascending: false }),
      supabase.from("execucao_servicos").select("id, titulo").order("created_at", { ascending: false }),
      supabase.from("ordens_servico").select("id, numero, titulo").order("created_at", { ascending: false }),
      supabase.from("execucao_profissionais").select("id, nome, registro_profissional, cargo").order("nome"),
      supabase.from("documentos_campos_variaveis").select("chave, label").eq("ativo", true).order("label"),
      supabase.from("documentos_revisoes").select("*").eq("documento_id", id).order("numero_revisao", { ascending: false }),
      supabase.from("documentos_anexos").select("*").eq("documento_id", id).order("created_at", { ascending: false }),
      supabase.from("documentos_aprovacoes").select("*").eq("documento_id", id).order("aprovado_em", { ascending: false }),
      supabase.from("documentos_timeline").select("*").eq("documento_id", id).order("created_at", { ascending: false }),
    ]);
    if (d.error) { toast.error(d.error.message); return; }
    setDoc(d.data); setHtml((d.data?.conteudo_json as any)?.html || "");
    setClientes(c.data || []); setPropostas(p.data || []); setExecs(e.data || []);
    setOss(o.data || []); setProfs(pr.data || []); setVariaveis(v.data || []);
    setRevisoes(rv.data || []); setAnexos(ax.data || []); setAprov(ap.data || []); setTimeline(tl.data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const validade = useMemo(() => statusValidade(doc?.data_vencimento), [doc?.data_vencimento]);

  const updateField = (k: string, v: any) => setDoc((d: any) => ({ ...d, [k]: v }));

  const salvar = async () => {
    if (!doc) return;
    const payload: any = {
      titulo: doc.titulo, tipo: doc.tipo, status: doc.status,
      client_id: doc.client_id || null, proposal_id: doc.proposal_id || null,
      execucao_id: doc.execucao_id || null, os_id: doc.os_id || null,
      responsavel_tecnico_id: doc.responsavel_tecnico_id || null,
      responsavel_revisao_id: doc.responsavel_revisao_id || null,
      observacoes_internas: doc.observacoes_internas || null,
      visivel_para_cliente: !!doc.visivel_para_cliente,
      assinatura_registro: doc.assinatura_registro || null,
      assinatura_cargo: doc.assinatura_cargo || null,
      assinatura_art: doc.assinatura_art || null,
      data_vencimento: doc.data_vencimento || null,
      data_emissao: doc.data_emissao || null,
      conteudo_json: { html },
    };
    const { error } = await supabase.from("documentos_tecnicos").update(payload).eq("id", id!);
    if (error) return toast.error(error.message);
    toast.success("Documento salvo");
    load();
  };

  const criarRevisao = async () => {
    const { error } = await supabase.rpc("criar_revisao_documento", {
      _doc_id: id!, _descricao: revDesc || "Revisão",
    });
    if (error) return toast.error(error.message);
    toast.success("Revisão criada");
    setRevOpen(false); setRevDesc(""); load();
  };

  const avancarStatus = async () => {
    const prox = proximoStatus(doc.status);
    if (!prox) return;
    const { error } = await supabase.from("documentos_tecnicos").update({ status: prox }).eq("id", id!);
    if (error) return toast.error(error.message);
    toast.success(`Status alterado para ${statusLabel(prox)}`);
    load();
  };

  const aprovar = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("documentos_aprovacoes").insert({
      documento_id: id!, observacoes: aprovObs || null, aprovado_por: u?.user?.id,
    });
    if (error) return toast.error(error.message);
    await supabase.from("documentos_tecnicos").update({ status: "aprovado" }).eq("id", id!);
    toast.success("Documento aprovado");
    setAprovOpen(false); setAprovObs(""); load();
  };

  const uploadAnexo = async (file: File) => {
    if (!id) return;
    const path = `${id}/${Date.now()}_${file.name}`;
    const up = await supabase.storage.from("documentos-tecnicos").upload(path, file);
    if (up.error) return toast.error(up.error.message);
    const { error } = await supabase.from("documentos_anexos").insert({
      documento_id: id, nome: file.name, arquivo_path: path, tipo: file.type, origem: "upload",
    });
    if (error) return toast.error(error.message);
    toast.success("Anexo enviado");
    load();
  };

  const removerAnexo = async (a: any) => {
    await supabase.storage.from("documentos-tecnicos").remove([a.arquivo_path]);
    await supabase.from("documentos_anexos").delete().eq("id", a.id);
    load();
  };

  const baixarAnexo = async (a: any) => {
    const { data } = await supabase.storage.from("documentos-tecnicos").createSignedUrl(a.arquivo_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!doc) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <>
      <PageHeader
        title={`${doc.numero} — ${doc.titulo}`}
        subtitle={`Rev. ${String(doc.revisao).padStart(2, "0")} • ${doc.cliente_nome || "Sem cliente"}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link to="/documentos"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
            <Badge className={statusColor(doc.status)} variant="outline">{statusLabel(doc.status)}</Badge>
            {doc.data_vencimento && <Badge className={validade.cor} variant="outline">{validade.rotulo}</Badge>}
            <Button asChild variant="outline" size="sm"><Link to={`/documentos/${id}/pdf`} target="_blank"><Printer className="h-4 w-4 mr-1" />Gerar PDF</Link></Button>
            <Button size="sm" onClick={salvar}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="revisoes">Revisões</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
            <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral">
            <Card><CardContent className="p-6 grid gap-4 md:grid-cols-2">
              <div><Label>Título</Label><Input value={doc.titulo || ""} onChange={(e) => updateField("titulo", e.target.value)} /></div>
              <div><Label>Tipo</Label>
                <Select value={doc.tipo} onValueChange={(v) => updateField("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={doc.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_DOCUMENTO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Cliente</Label>
                <Select value={doc.client_id || ""} onValueChange={(v) => updateField("client_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Proposta vinculada</Label>
                <Select value={doc.proposal_id || ""} onValueChange={(v) => updateField("proposal_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{propostas.map((p) => <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Execução vinculada</Label>
                <Select value={doc.execucao_id || ""} onValueChange={(v) => updateField("execucao_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{execs.map((x) => <SelectItem key={x.id} value={x.id}>{x.titulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>OS vinculada</Label>
                <Select value={doc.os_id || ""} onValueChange={(v) => updateField("os_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{oss.map((x) => <SelectItem key={x.id} value={x.id}>{x.numero} — {x.titulo || ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Responsável técnico</Label>
                <Select value={doc.responsavel_tecnico_id || ""} onValueChange={(v) => updateField("responsavel_tecnico_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Responsável pela revisão</Label>
                <Select value={doc.responsavel_revisao_id || ""} onValueChange={(v) => updateField("responsavel_revisao_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{profs.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data de emissão</Label><Input type="date" value={doc.data_emissao || ""} onChange={(e) => updateField("data_emissao", e.target.value)} /></div>
              <div><Label>Data de vencimento</Label><Input type="date" value={doc.data_vencimento || ""} onChange={(e) => updateField("data_vencimento", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Observações internas</Label>
                <Textarea value={doc.observacoes_internas || ""} onChange={(e) => updateField("observacoes_internas", e.target.value)} />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Checkbox id="vc" checked={!!doc.visivel_para_cliente} onCheckedChange={(v) => updateField("visivel_para_cliente", !!v)} />
                <Label htmlFor="vc" className="cursor-pointer">Visível para o cliente (Portal do Cliente — futuro)</Label>
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* EDITOR */}
          <TabsContent value="editor">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Use a barra superior para inserir títulos, tabelas, imagens e campos variáveis.</div>
                <Dialog open={revOpen} onOpenChange={setRevOpen}>
                  <DialogTrigger asChild><Button variant="outline" size="sm"><GitBranch className="h-4 w-4 mr-1" />Nova revisão</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Criar nova revisão</DialogTitle></DialogHeader>
                    <div className="py-2">
                      <Label>Descrição da revisão</Label>
                      <Textarea value={revDesc} onChange={(e) => setRevDesc(e.target.value)} placeholder="Ex.: Ajuste solicitado pelo cliente" />
                      <p className="text-xs text-muted-foreground mt-2">Um snapshot do conteúdo atual será preservado como Rev. {String((doc.revisao || 0) + 1).padStart(2, "0")}.</p>
                    </div>
                    <DialogFooter><Button onClick={criarRevisao}>Gerar revisão</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <DocEditor value={html} onChange={setHtml} variaveis={variaveis} />
            </div>
          </TabsContent>

          {/* REVISÕES */}
          <TabsContent value="revisoes">
            <Card><CardContent className="p-0">
              {revisoes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground"><History className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhuma revisão registrada.</div>
              ) : (
                <ul className="divide-y">
                  {revisoes.map((r) => (
                    <li key={r.id} className="p-4 flex items-start gap-3">
                      <Badge variant="outline">Rev. {String(r.numero_revisao).padStart(2, "0")}</Badge>
                      <div className="flex-1">
                        <div className="font-medium">{r.descricao || "Revisão"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")} {r.status && `• ${statusLabel(r.status)}`}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ANEXOS */}
          <TabsContent value="anexos">
            <Card><CardContent className="p-4 space-y-3">
              <div>
                <Label className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 rounded-md border border-dashed px-4 py-2 hover:bg-accent">
                    <Upload className="h-4 w-4" /> Enviar anexo
                  </div>
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAnexo(e.target.files[0])} />
                </Label>
              </div>
              {anexos.length === 0 ? (
                <div className="text-center text-muted-foreground py-6"><Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />Sem anexos.</div>
              ) : (
                <ul className="divide-y">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <button className="text-left text-sm hover:underline" onClick={() => baixarAnexo(a)}>{a.nome}</button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize">{a.origem}</span>
                        <Button size="sm" variant="ghost" onClick={() => removerAnexo(a)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ASSINATURA */}
          <TabsContent value="assinatura">
            <Card><CardContent className="p-6 grid gap-4 md:grid-cols-2">
              <div><Label>Registro profissional</Label><Input value={doc.assinatura_registro || ""} onChange={(e) => updateField("assinatura_registro", e.target.value)} /></div>
              <div><Label>Cargo</Label><Input value={doc.assinatura_cargo || ""} onChange={(e) => updateField("assinatura_cargo", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>ART (quando aplicável)</Label><Input value={doc.assinatura_art || ""} onChange={(e) => updateField("assinatura_art", e.target.value)} /></div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                Assinatura eletrônica e upload de imagem de assinatura serão habilitados em etapa futura.
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* APROVAÇÃO */}
          <TabsContent value="aprovacao">
            <Card><CardContent className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm">Status atual: <Badge className={statusColor(doc.status)} variant="outline">{statusLabel(doc.status)}</Badge></div>
                {proximoStatus(doc.status) && (
                  <Button size="sm" onClick={avancarStatus}><Send className="h-4 w-4 mr-1" />Avançar para “{statusLabel(proximoStatus(doc.status)!)}”</Button>
                )}
                <Dialog open={aprovOpen} onOpenChange={setAprovOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Check className="h-4 w-4 mr-1" />Registrar aprovação</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Aprovar documento</DialogTitle></DialogHeader>
                    <div className="py-2"><Label>Observações</Label><Textarea value={aprovObs} onChange={(e) => setAprovObs(e.target.value)} /></div>
                    <DialogFooter><Button onClick={aprovar}>Confirmar aprovação</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="text-sm font-semibold mt-2">Histórico de aprovações</div>
              {aprov.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma aprovação registrada.</div>
              ) : (
                <ul className="divide-y">
                  {aprov.map((a) => (
                    <li key={a.id} className="py-2 text-sm">
                      <div className="font-medium">Aprovado em {new Date(a.aprovado_em).toLocaleString("pt-BR")}</div>
                      {a.observacoes && <div className="text-muted-foreground">{a.observacoes}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico">
            <Card><CardContent className="p-0">
              {timeline.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Sem eventos.</div>
              ) : (
                <ul className="divide-y">
                  {timeline.map((t) => (
                    <li key={t.id} className="p-4">
                      <div className="font-medium text-sm">{t.evento}</div>
                      {t.detalhe && <div className="text-sm text-muted-foreground">{t.detalhe}</div>}
                      <div className="text-xs text-muted-foreground mt-1">{new Date(t.created_at).toLocaleString("pt-BR")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}