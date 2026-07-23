import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Wand2, Save, FileDown, Eye, CheckCircle2, Lock, AlertTriangle,
  RefreshCw, Upload, ShieldCheck,
} from "lucide-react";

type Gates = {
  pode_emitir: boolean;
  erros: Array<{ codigo: string; mensagem: string }>;
  revisao_id?: string | null;
};

type Parecer = {
  sintese_caso?: string;
  interpretacao_convergencia?: string;
  prioridades?: string;
  recomendacoes_organizacionais?: string;
  limitacoes?: string;
  conclusao?: string;
};

type Revisao = {
  id: string;
  parecer: Parecer | null;
  parecer_versao: number;
  prompt_codigo: string | null;
  modelo_ia: string | null;
  status: string;
  imutavel: boolean;
  aprovado_em: string | null;
  responsavel_profissional_id: string | null;
  assinatura_storage_path: string | null;
  assinatura_mime_type: string | null;
  assinatura_hash_sha256: string | null;
};

type Relatorio = {
  id: string; versao: number; codigo: string; codigo_validacao: string;
  status: string; storage_path: string | null; nome_arquivo: string | null;
  emitido_em: string | null;
};

type ProfOption = { id: string; label: string };

const CAMPOS: Array<[keyof Parecer, string]> = [
  ["sintese_caso", "Síntese do caso"],
  ["interpretacao_convergencia", "Interpretação — convergências e divergências"],
  ["prioridades", "Prioridades de intervenção"],
  ["recomendacoes_organizacionais", "Recomendações organizacionais (eixos NR-01)"],
  ["limitacoes", "Limitações metodológicas"],
  ["conclusao", "Conclusão"],
];

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function PsicoIndividualRelatorioTab({ avaliacaoId }: { avaliacaoId: string }) {
  const [loading, setLoading] = useState(true);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  const [gates, setGates] = useState<Gates | null>(null);
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [parecer, setParecer] = useState<Parecer>({});
  const [dirty, setDirty] = useState(false);
  const [responsaveis, setResponsaveis] = useState<ProfOption[]>([]);
  const [selRespId, setSelRespId] = useState<string>("");
  const [assinaturaFile, setAssinaturaFile] = useState<File | null>(null);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: gatesData, error: gatesErr }, revRes, relRes, profs, users] = await Promise.all([
        supabase.rpc("psico_ind_gates_emissao", { p_avaliacao: avaliacaoId }),
        supabase.from("psico_individual_revisoes")
          .select("*").eq("avaliacao_id", avaliacaoId).eq("ativa", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc("psico_ind_listar_relatorios", { p_avaliacao: avaliacaoId }),
        supabase.from("execucao_profissionais").select("id,nome,cargo").order("nome"),
        supabase.from("profiles").select("id,full_name,cargo").order("full_name"),
      ]);
      if (gatesErr) throw gatesErr;
      setGates(gatesData as Gates);
      const rev = (revRes.data as any) || null;
      setRevisao(rev);
      setParecer((rev?.parecer as Parecer) || {});
      setSelRespId(rev?.responsavel_profissional_id || "");
      setDirty(false);
      setRelatorios((relRes.data as Relatorio[]) || []);
      const opts: ProfOption[] = [];
      (profs.data || []).forEach((p: any) => opts.push({ id: p.id, label: `${p.nome}${p.cargo ? ` — ${p.cargo}` : ""}` }));
      (users.data || []).forEach((u: any) => opts.push({ id: u.id, label: `${u.full_name || "Usuário"}${u.cargo ? ` — ${u.cargo}` : ""}` }));
      setResponsaveis(opts);
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [avaliacaoId]);

  useEffect(() => { load(); }, [load]);

  const camposFaltando = useMemo(
    () => CAMPOS.filter(([k]) => !((parecer[k] || "").trim().length >= 20)),
    [parecer],
  );

  const gerarComIA = async (regenerar = false) => {
    setGerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("psico-gerar-parecer-individual", {
        body: { avaliacao_id: avaliacaoId, confirmar_substituicao: regenerar },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error === "CONFIRMACAO_REGENERACAO_NECESSARIA") {
        throw new Error("Já existe parecer — confirme a regeneração.");
      }
      toast.success("Parecer gerado pela IA");
      await load();
    } catch (e: any) {
      toast.error("Falha ao gerar parecer", { description: e.message });
    } finally { setGerandoIA(false); }
  };

  const salvarParecer = async () => {
    if (camposFaltando.length) {
      toast.error("Preencha todos os campos (mín. 20 caracteres)");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("psico_ind_salvar_parecer", {
        p_avaliacao: avaliacaoId,
        p_parecer: parecer,
        p_prompt_codigo: revisao?.prompt_codigo || "MANUAL",
        p_modelo_ia: revisao?.modelo_ia || "manual",
      });
      if (error) throw error;
      toast.success("Parecer salvo");
      setDirty(false);
      await load();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e.message });
    } finally { setSalvando(false); }
  };

  const uploadAssinatura = async (): Promise<{ path: string; mime: string; hash: string } | null> => {
    if (!assinaturaFile) return null;
    const bytes = new Uint8Array(await assinaturaFile.arrayBuffer());
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Assinatura acima de 2 MB");
    if (!/^image\/(png|jpe?g)$/.test(assinaturaFile.type)) throw new Error("Formato deve ser PNG ou JPEG");
    const hash = await sha256Hex(bytes);
    const path = `individual/${avaliacaoId}/${revisao?.id || "temp"}/${hash}.${assinaturaFile.type === "image/png" ? "png" : "jpg"}`;
    const up = await supabase.storage.from("psico-assinaturas").upload(path, bytes, {
      contentType: assinaturaFile.type, upsert: true,
    });
    if (up.error) throw up.error;
    return { path, mime: assinaturaFile.type, hash };
  };

  const salvarResponsavelAssinatura = async () => {
    if (!revisao) { toast.error("Salve o parecer antes"); return; }
    if (!selRespId) { toast.error("Selecione o responsável técnico"); return; }
    setSalvando(true);
    try {
      let updates: any = { responsavel_profissional_id: selRespId };
      if (assinaturaFile) {
        const info = await uploadAssinatura();
        if (info) {
          updates = {
            ...updates,
            assinatura_storage_path: info.path,
            assinatura_mime_type: info.mime,
            assinatura_hash_sha256: info.hash,
          };
        }
      }
      const { error } = await supabase.from("psico_individual_revisoes")
        .update(updates).eq("id", revisao.id);
      if (error) throw error;
      setAssinaturaFile(null);
      toast.success("Responsável e assinatura salvos");
      await load();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e.message });
    } finally { setSalvando(false); }
  };

  const aprovarRevisao = async () => {
    if (!revisao) return;
    setAprovando(true);
    try {
      const { error } = await supabase.rpc("psico_ind_aprovar_revisao", {
        p_revisao: revisao.id,
        p_responsavel_profissional: selRespId,
      });
      if (error) throw error;
      toast.success("Revisão técnica aprovada — imutável");
      await load();
    } catch (e: any) {
      toast.error("Falha ao aprovar", { description: e.message });
    } finally { setAprovando(false); }
  };

  const abrirPrevia = async () => {
    setPreviewing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/psico-gerar-relatorio-individual`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avaliacao_id: avaliacaoId, modo: "preview" }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error("Falha na prévia", { description: e.message });
    } finally { setPreviewing(false); }
  };

  const emitirRelatorio = async () => {
    setEmitindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("psico-gerar-relatorio-individual", {
        body: { avaliacao_id: avaliacaoId, modo: "emitir" },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      toast.success(`Relatório emitido: ${(data as any).codigo}`);
      await load();
    } catch (e: any) {
      toast.error("Falha ao emitir", { description: e.message });
    } finally { setEmitindo(false); }
  };

  const baixarRelatorio = async (rel: Relatorio) => {
    if (!rel.storage_path) return;
    const { data, error } = await supabase.storage.from("psico-relatorios").createSignedUrl(rel.storage_path, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      {/* Gates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Pré-requisitos de emissão
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {gates?.pode_emitir ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Todos os pré-requisitos atendidos</AlertTitle>
              <AlertDescription>A avaliação está pronta para emissão do relatório individual.</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pendências</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  {(gates?.erros || []).map((e, i) => (
                    <li key={i}>• <strong>{e.codigo}</strong>: {e.mensagem}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Parecer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Parecer técnico conclusivo</CardTitle>
            <div className="flex items-center gap-2">
              {revisao?.imutavel && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Aprovado</Badge>}
              {revisao?.parecer_versao ? <Badge variant="outline">v{revisao.parecer_versao}</Badge> : null}
              {revisao?.prompt_codigo && <Badge variant="outline">{revisao.prompt_codigo}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {!revisao?.parecer ? (
              <Button onClick={() => gerarComIA(false)} disabled={gerandoIA || revisao?.imutavel}>
                <Wand2 className="h-4 w-4 mr-2" /> {gerandoIA ? "Gerando…" : "Gerar minuta com IA"}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={gerandoIA || revisao?.imutavel}>
                    <Wand2 className="h-4 w-4 mr-2" /> Regenerar com IA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerar parecer?</AlertDialogTitle>
                    <AlertDialogDescription>O parecer atual será substituído pela nova versão gerada pela IA. Você poderá editar depois.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => gerarComIA(true)}>Regenerar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={salvarParecer} disabled={salvando || !dirty || revisao?.imutavel}>
              <Save className="h-4 w-4 mr-2" /> {salvando ? "Salvando…" : "Salvar edições"}
            </Button>
          </div>

          {CAMPOS.map(([k, label]) => (
            <div key={k as string}>
              <Label>{label}</Label>
              <Textarea
                rows={4}
                value={parecer[k] || ""}
                onChange={(e) => { setParecer((p) => ({ ...p, [k]: e.target.value })); setDirty(true); }}
                disabled={revisao?.imutavel}
                className="mt-1"
                placeholder="Mínimo 20 caracteres"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Responsável e assinatura */}
      <Card>
        <CardHeader><CardTitle>Responsável técnico e assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Responsável técnico</Label>
            <Select value={selRespId} onValueChange={setSelRespId} disabled={revisao?.imutavel}>
              <SelectTrigger><SelectValue placeholder="Selecione o profissional responsável" /></SelectTrigger>
              <SelectContent>
                {responsaveis.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Assinatura (PNG/JPEG, até 2 MB)</Label>
            <Input
              type="file" accept="image/png,image/jpeg"
              onChange={(e) => setAssinaturaFile(e.target.files?.[0] || null)}
              disabled={revisao?.imutavel}
            />
            {revisao?.assinatura_storage_path && !assinaturaFile && (
              <p className="text-xs text-muted-foreground mt-1">Assinatura já anexada (hash {revisao.assinatura_hash_sha256?.slice(0, 12)}…)</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={salvarResponsavelAssinatura} disabled={salvando || revisao?.imutavel}>
              <Upload className="h-4 w-4 mr-2" /> Salvar responsável e assinatura
            </Button>
            {revisao && !revisao.imutavel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    disabled={aprovando || camposFaltando.length > 0 || !selRespId || !revisao.assinatura_storage_path}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar revisão (imutável)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Aprovar e travar revisão?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Após aprovar, o parecer, o responsável e a assinatura ficam imutáveis. Só será possível emitir uma nova revisão criando outra versão.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={aprovarRevisao}>Aprovar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emissão */}
      <Card>
        <CardHeader><CardTitle>Emissão do relatório</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={abrirPrevia} disabled={previewing || !gates?.pode_emitir}>
              <Eye className="h-4 w-4 mr-2" /> {previewing ? "Gerando prévia…" : "Prévia (sem emitir)"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={emitindo || !gates?.pode_emitir}>
                  <FileDown className="h-4 w-4 mr-2" /> {emitindo ? "Emitindo…" : "Emitir relatório oficial"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Emitir relatório individual?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Uma nova versão será gerada, assinada com o responsável aprovado, publicada no storage e receberá um código de validação verificável no portal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={emitirRelatorio}>Emitir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {relatorios.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Versões emitidas</p>
              {relatorios.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">{r.codigo} <Badge variant="outline" className="ml-2">v{r.versao}</Badge> <Badge className="ml-1" variant={r.status === "emitido" ? "default" : "secondary"}>{r.status}</Badge></div>
                    <div className="text-xs text-muted-foreground">
                      Validação: {r.codigo_validacao} {r.emitido_em ? `• ${new Date(r.emitido_em).toLocaleString("pt-BR")}` : ""}
                    </div>
                  </div>
                  {r.storage_path && (
                    <Button size="sm" variant="outline" onClick={() => baixarRelatorio(r)}>
                      <FileDown className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}