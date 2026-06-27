import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, Inbox, ClipboardList, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_DOCUMENTO, STATUS_DOCUMENTO, statusLabel, statusColor, tipoLabel, statusValidade } from "@/lib/documentos";

export default function Documentos() {
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [modelos, setModelos] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fTipo, setFTipo] = useState<string>("all");
  const [fCliente, setFCliente] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<any>({ tipo: "PGR", titulo: "", status: "rascunho" });
  const navigate = useNavigate();

  const load = async () => {
    const [d, c, p, m] = await Promise.all([
      supabase.from("documentos_tecnicos").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
      supabase.from("execucao_profissionais").select("id, nome").order("nome"),
      supabase.from("documentos_modelos").select("id, nome, tipo, validade_padrao_dias, responsavel_padrao_id").eq("ativo", true),
    ]);
    if (d.error) toast.error(d.error.message); else setItems(d.data || []);
    setClientes(c.data || []); setProfs(p.data || []); setModelos(m.data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((d) => {
    if (fStatus !== "all" && d.status !== fStatus) return false;
    if (fTipo !== "all" && d.tipo !== fTipo) return false;
    if (fCliente !== "all" && d.client_id !== fCliente) return false;
    if (q) {
      const s = (d.numero + " " + d.titulo + " " + (d.cliente_nome || "")).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [items, fStatus, fTipo, fCliente, q]);

  const counters = useMemo(() => {
    const c = { elab: 0, rev: 0, cli: 0, emit: 0, entreg: 0, prox: 0, venc: 0 };
    for (const d of items) {
      if (d.status === "em_elaboracao") c.elab++;
      if (d.status === "em_revisao") c.rev++;
      if (d.status === "aguardando_cliente") c.cli++;
      if (d.status === "emitido") c.emit++;
      if (d.status === "entregue") c.entreg++;
      const v = statusValidade(d.data_vencimento);
      if (v.dias !== null && v.dias < 0) c.venc++;
      else if (v.dias !== null && v.dias <= 30) c.prox++;
    }
    return c;
  }, [items]);

  const criar = async () => {
    if (!novo.titulo?.trim()) return toast.error("Informe o título");
    const modelo = novo.modelo_id ? modelos.find((m) => m.id === novo.modelo_id) : null;
    const payload: any = {
      tipo: novo.tipo,
      titulo: novo.titulo,
      status: "rascunho",
      modelo_id: novo.modelo_id || null,
      client_id: novo.client_id || null,
      responsavel_tecnico_id: modelo?.responsavel_padrao_id || null,
      conteudo_json: { html: "" },
    };
    if (modelo?.validade_padrao_dias) {
      const d = new Date(); d.setDate(d.getDate() + modelo.validade_padrao_dias);
      payload.data_vencimento = d.toISOString().slice(0, 10);
    }
    const { data, error } = await supabase.from("documentos_tecnicos").insert(payload).select().single();
    if (error) return toast.error(error.message);
    toast.success("Documento criado");
    setOpen(false); setNovo({ tipo: "PGR", titulo: "", status: "rascunho" });
    navigate(`/documentos/${data.id}`);
  };

  const card = (label: string, value: number, cor = "text-foreground") => (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cor}`}>{value}</div>
    </CardContent></Card>
  );

  return (
    <>
      <PageHeader title="Documentos Técnicos" subtitle="Emissão, controle e versionamento de documentos de SST"
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/documentos/modelos"><SettingsIcon className="h-4 w-4 mr-1.5" />Modelos</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/documentos/recebidos"><Inbox className="h-4 w-4 mr-1.5" />Recebidos</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/documentos/pendentes"><ClipboardList className="h-4 w-4 mr-1.5" />Pendentes</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo documento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo documento técnico</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Tipo</Label>
                    <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Título</Label><Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></div>
                  <div><Label>Cliente</Label>
                    <Select value={novo.client_id || ""} onValueChange={(v) => setNovo({ ...novo, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Modelo (opcional)</Label>
                    <Select value={novo.modelo_id || ""} onValueChange={(v) => setNovo({ ...novo, modelo_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Em branco" /></SelectTrigger>
                      <SelectContent>
                        {modelos.filter((m) => m.tipo === novo.tipo).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={criar}>Criar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid gap-3 md:grid-cols-7">
          {card("Em elaboração", counters.elab)}
          {card("Em revisão", counters.rev, "text-amber-600")}
          {card("Aguard. cliente", counters.cli, "text-purple-600")}
          {card("Emitidos", counters.emit, "text-emerald-600")}
          {card("Entregues", counters.entreg, "text-green-600")}
          {card("Próx. vencimento", counters.prox, "text-amber-600")}
          {card("Vencidos", counters.venc, "text-red-600")}
        </div>

        <Card><CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número, título ou cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_DOCUMENTO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Rev.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />Nenhum documento.
                </TableCell></TableRow>
              )}
              {filtered.map((d) => {
                const v = statusValidade(d.data_vencimento);
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-accent/40"
                    onClick={() => navigate(`/documentos/${d.id}`)}>
                    <TableCell className="font-mono text-xs">{d.numero}</TableCell>
                    <TableCell className="text-sm">{tipoLabel(d.tipo)}</TableCell>
                    <TableCell className="font-medium">{d.titulo}</TableCell>
                    <TableCell className="text-sm">{d.cliente_nome || "—"}</TableCell>
                    <TableCell className="text-sm">Rev. {String(d.revisao).padStart(2, "0")}</TableCell>
                    <TableCell><Badge className={statusColor(d.status)} variant="outline">{statusLabel(d.status)}</Badge></TableCell>
                    <TableCell><Badge className={v.cor} variant="outline">{v.rotulo}</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </>
  );
}