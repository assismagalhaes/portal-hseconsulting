import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

const BASE = "/operacoes/avaliacao-fatores-psicossociais";

const schema = z.object({
  cliente_id: z.string().uuid({ message: "Selecione um cliente" }),
  titulo: z.string().trim().min(3, "Título é obrigatório").max(200),
  unidade: z.string().trim().max(100).optional(),
  data_inicio_prevista: z.string().optional().nullable(),
  data_fim_prevista: z.string().optional().nullable(),
  quantidade_participantes_prevista: z.number().int().min(1, "Mínimo 1 participante"),
  responsavel_hse_id: z.string().uuid({ message: "Selecione um responsável" }),
  observacoes_internas: z.string().max(2000).optional().nullable(),
}).refine((d) => !d.data_inicio_prevista || !d.data_fim_prevista || d.data_fim_prevista >= d.data_inicio_prevista, {
  message: "Data final não pode ser anterior à data inicial",
  path: ["data_fim_prevista"],
});

export default function PsicoAvaliacaoNova() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [resps, setResps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [metodId, setMetodId] = useState<string | null>(null);
  const [questId, setQuestId] = useState<string | null>(null);
  const [vigente, setVigente] = useState<any>(null);

  const [form, setForm] = useState({
    cliente_id: "",
    titulo: "",
    unidade: "Geral",
    data_inicio_prevista: "",
    data_fim_prevista: "",
    quantidade_participantes_prevista: 1,
    responsavel_hse_id: user?.id || "",
    observacoes_internas: "",
  });

  useEffect(() => {
    document.title = "Nova Avaliação Psicossocial | Portal HSE";
    (async () => {
      const [c, p, v] = await Promise.all([
        supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
        supabase.from("profiles").select("id, nome, email").order("nome"),
        (supabase as any).from("psico_questionarios_versoes").select("id, codigo, nome, versao, vigente, metodologia_versao_id").eq("vigente", true).maybeSingle(),
      ]);
      setClientes(c.data || []);
      setResps(p.data || []);
      setVigente(v.data || null);
      setMetodId(v.data?.metodologia_versao_id || null);
      setQuestId(v.data?.id || null);
    })();
  }, []);

  useEffect(() => {
    if (form.cliente_id && !form.titulo) {
      const cli = clientes.find((c) => c.id === form.cliente_id);
      const nome = cli?.nome_fantasia || cli?.razao_social;
      if (nome) {
        setForm((f) => ({ ...f, titulo: `Avaliação de Fatores Psicossociais — ${nome} — ${new Date().getFullYear()}` }));
      }
    }
  }, [form.cliente_id, clientes]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const parsed = schema.safeParse({
      ...form,
      quantidade_participantes_prevista: Number(form.quantidade_participantes_prevista),
      data_inicio_prevista: form.data_inicio_prevista || null,
      data_fim_prevista: form.data_fim_prevista || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Verifique os campos");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("psico_avaliacoes").insert({
      cliente_id: parsed.data.cliente_id,
      titulo: parsed.data.titulo,
      unidade: parsed.data.unidade || "Geral",
      data_inicio_prevista: parsed.data.data_inicio_prevista,
      data_fim_prevista: parsed.data.data_fim_prevista,
      quantidade_participantes_prevista: parsed.data.quantidade_participantes_prevista,
      responsavel_hse_id: parsed.data.responsavel_hse_id,
      observacoes_internas: parsed.data.observacoes_internas || null,
      metodologia_versao_id: metodId,
      questionario_versao_id: questId,
      status: "rascunho",
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Avaliação criada em rascunho");
    nav(`${BASE}/avaliacoes/${data!.id}`);
  }

  const showAviso1 = Number(form.quantidade_participantes_prevista) === 1;

  return (
    <div>
      <PageHeader
        title="Nova Avaliação"
        subtitle="Cadastro inicial (rascunho) da Avaliação de Fatores Psicossociais."
        actions={
          <Button variant="outline" asChild>
            <Link to={`${BASE}/avaliacoes`}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link>
          </Button>
        }
      />
      <div className="p-6 max-w-3xl">
        {vigente ? (
          <Card className="mb-4 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10">
            <CardContent className="py-4 text-sm flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div><strong>Questionário:</strong> {vigente.codigo} — {vigente.nome}</div>
                <div className="text-xs text-muted-foreground mt-1">Versão vigente vinculada automaticamente à nova avaliação.</div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">Vigente</Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-900/10">
            <CardContent className="py-4 text-sm">
              Nenhuma versão do questionário está vigente. Publique a versão em Configurações antes de coletar respostas.
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="py-6">
            <form onSubmit={salvar} className="space-y-5">
              <div>
                <Label>Cliente *</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  Precisa cadastrar um novo cliente? <Link to="/clientes" target="_blank" rel="noopener noreferrer" className="underline">Abrir cadastro de clientes</Link>
                </div>
              </div>

              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} maxLength={200} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Unidade</Label>
                  <Input value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="Geral" />
                </div>
                <div>
                  <Label>Quantidade prevista de participantes *</Label>
                  <Input type="number" min={1} value={form.quantidade_participantes_prevista}
                    onChange={(e) => setForm((f) => ({ ...f, quantidade_participantes_prevista: Number(e.target.value) || 1 }))} />
                </div>
              </div>

              {showAviso1 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>A metodologia atual exige no mínimo 2 respondentes para emissão do resultado coletivo. A avaliação poderá ser preparada, mas não poderá gerar o relatório quantitativo enquanto esse requisito não for atendido.</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Data prevista de início</Label>
                  <Input type="date" value={form.data_inicio_prevista} onChange={(e) => setForm((f) => ({ ...f, data_inicio_prevista: e.target.value }))} />
                </div>
                <div>
                  <Label>Data prevista de encerramento</Label>
                  <Input type="date" value={form.data_fim_prevista} onChange={(e) => setForm((f) => ({ ...f, data_fim_prevista: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label>Responsável HSE *</Label>
                <Select value={form.responsavel_hse_id} onValueChange={(v) => setForm((f) => ({ ...f, responsavel_hse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                  <SelectContent>
                    {resps.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações internas</Label>
                <Textarea value={form.observacoes_internas} onChange={(e) => setForm((f) => ({ ...f, observacoes_internas: e.target.value }))}
                  rows={3} maxLength={2000} placeholder="Uso interno. Não é enviado ao cliente." />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => nav(`${BASE}/avaliacoes`)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar como rascunho"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
