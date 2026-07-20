// Fase 9 — Wizard de Importação de Avaliações Históricas (Modo Bruto)
// Fluxo:
//  1) Contexto: cliente, questionário legado, metodologia, observação
//  2) Upload do arquivo (CSV/XLSX)
//  3) Mapeamento de colunas → tipo (data, função, setor, unidade) e pergunta→coluna
//  4) Validação (staging técnico) + resumo de erros/avisos
//  5) Confirmação da avaliação histórica + commit
//  6) Sucesso ou cancelamento
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BASE, callFn, PrivacyAlert, StepIndicator,
  type Cliente, type Questionario, type UploadResp, type ValidarResp,
} from "./importacao/shared";
import { MapeamentoStep } from "./importacao/MapeamentoStep";
import { ValidacaoResumo } from "./importacao/ValidacaoResumo";

const sb: any = supabase;

export default function PsicoImportacaoHistorica() {
  const nav = useNavigate();
  const call = callFn;

  function baixarTemplateAgregado() {
    const header = "numero,quantidade_nunca,quantidade_raramente,quantidade_as_vezes,quantidade_frequentemente,quantidade_sempre\n";
    const exemplo = Array.from({ length: 35 }, (_, i) => `${i + 1},0,0,0,0,0`).join("\n");
    const blob = new Blob([header + exemplo + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-importacao-agregada.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState<"bruta_respondentes" | "agregada_perguntas">("bruta_respondentes");

  // Passo 1: contexto
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [questionarios, setQuestionarios] = useState<Questionario[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [questId, setQuestId] = useState("");
  const [obsOrigem, setObsOrigem] = useState("Coleta realizada em campo antes do Portal HSE (Google Forms / planilha).");

  // Passo 2: upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadResp, setUploadResp] = useState<UploadResp | null>(null);
  const [perguntasNumeros, setPerguntasNumeros] = useState<number[]>([]);

  // Passo 3: mapeamento
  const [mapData, setMapData] = useState("none");
  const [mapFuncao, setMapFuncao] = useState("none");
  const [mapSetor, setMapSetor] = useState("none");
  const [mapUnidade, setMapUnidade] = useState("none");
  const [mapPerguntas, setMapPerguntas] = useState<Record<string, string>>({}); // numero → header
  const [ignoradas, setIgnoradas] = useState<Set<string>>(new Set());

  // Passo 4: validação
  const [validarResp, setValidarResp] = useState<ValidarResp | null>(null);
  // Confirmações de privacidade obrigatórias (Fase 9A) — quando o arquivo tem nome/função
  const [confirmNome, setConfirmNome] = useState(false);
  const [confirmFuncao, setConfirmFuncao] = useState(false);
  const [errosDetalhados, setErrosDetalhados] = useState<any[]>([]);

  // Passo 5: commit
  const [avalTitulo, setAvalTitulo] = useState("");
  const [avalUnidade, setAvalUnidade] = useState("Geral");
  const [avalDataInicio, setAvalDataInicio] = useState("");
  const [avalDataFim, setAvalDataFim] = useState("");
  const [commitResult, setCommitResult] = useState<any>(null);

  useEffect(() => {
    document.title = "Importar Avaliação Histórica | Portal HSE";
    (async () => {
      const [c, q] = await Promise.all([
        supabase.from("clients").select("id, razao_social, nome_fantasia").order("razao_social"),
        sb.from("psico_questionarios_versoes")
          .select("id, codigo, nome, versao, vigente, metodologia_versao_id")
          .order("codigo"),
      ]);
      setClientes((c.data as Cliente[]) || []);
      setQuestionarios((q.data as Questionario[]) || []);
      const legado = (q.data as Questionario[] || []).find(x => x.codigo?.startsWith("QPPOT-1.0-LEGADO"));
      if (legado) setQuestId(legado.id);
    })();
  }, []);

  useEffect(() => {
    if (!questId) { setPerguntasNumeros([]); return; }
    (async () => {
      const { data } = await sb.from("psico_perguntas")
        .select("numero").eq("questionario_versao_id", questId).order("numero");
      setPerguntasNumeros((data || []).map((p: any) => p.numero));
    })();
  }, [questId]);

  useEffect(() => {
    if (clienteId && !avalTitulo) {
      const c = clientes.find(x => x.id === clienteId);
      const nome = c?.nome_fantasia || c?.razao_social || "";
      if (nome) setAvalTitulo(`Avaliação histórica — ${nome} — ${new Date().getFullYear() - 1}`);
    }
  }, [clienteId, clientes]);

  const questSelecionado = useMemo(
    () => questionarios.find(q => q.id === questId) || null,
    [questionarios, questId]
  );

  // ---------------- ações ----------------
  async function doUpload() {
    if (!file || !clienteId || !questSelecionado) { toast.error("Selecione cliente, questionário e arquivo"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Arquivo maior que 25 MB"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("arquivo", file);
    fd.append("cliente_id", clienteId);
    fd.append("tipo", tipo);
    fd.append("questionario_versao_id", questSelecionado.id);
    fd.append("metodologia_versao_id", questSelecionado.metodologia_versao_id);
    fd.append("idempotency_key", crypto.randomUUID());
    try {
      const r = await call("psico-importacao-upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha no upload");
      setUploadResp(j as UploadResp);
      // Modo agregado: pula mapear/validar (colunas fixas) e vai para confirmação (step 5)
      setStep(tipo === "agregada_perguntas" ? 5 : 3);
    } catch (e: any) { toast.error(e.message || "Falha no upload"); }
    finally { setBusy(false); }
  }

  async function doValidar() {
    if (!uploadResp) return;
    if (Object.values(mapPerguntas).filter(Boolean).length === 0) {
      toast.error("Mapeie ao menos uma pergunta"); return;
    }
    setBusy(true);
    const payload = {
      importacao_id: uploadResp.importacao_id,
      mapeamento: {
        data_resposta: mapData !== "none" ? mapData : undefined,
        funcao: mapFuncao !== "none" ? mapFuncao : undefined,
        setor: mapSetor !== "none" ? mapSetor : undefined,
        unidade: mapUnidade !== "none" ? mapUnidade : undefined,
        perguntas: Object.fromEntries(Object.entries(mapPerguntas).filter(([, v]) => !!v)),
        ignoradas: Array.from(ignoradas),
      },
    };
    try {
      const r = await call("psico-importacao-validar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha na validação");
      setValidarResp(j as ValidarResp);
      if (j.resumo?.data_resposta_minima) {
        setAvalDataInicio((atual) => atual || j.resumo.data_resposta_minima);
      }
      if (j.resumo?.data_resposta_maxima) {
        setAvalDataFim((atual) => atual || j.resumo.data_resposta_maxima);
      }
      const { data } = await sb.from("psico_importacoes_erros")
        .select("numero_linha, codigo, campo, severidade, mensagem")
        .eq("importacao_id", uploadResp.importacao_id).order("numero_linha").limit(200);
      setErrosDetalhados(data || []);
      setStep(5);
    } catch (e: any) { toast.error(e.message || "Falha na validação"); }
    finally { setBusy(false); }
  }

  async function doCommit() {
    if (!uploadResp) return;
    if (!avalDataInicio || !avalDataFim) {
      toast.error("Informe o período original da coleta"); return;
    }
    if (avalDataFim < avalDataInicio) {
      toast.error("A data final não pode ser anterior à data inicial"); return;
    }
    setBusy(true);
    try {
      const endpoint = tipo === "agregada_perguntas"
        ? "psico-importacao-agregada-commit"
        : "psico-importacao-commit";
      const r = await call(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importacao_id: uploadResp.importacao_id,
          titulo: avalTitulo,
          unidade: avalUnidade,
          data_inicio: avalDataInicio || null,
          data_fim: avalDataFim || null,
          observacao_origem: obsOrigem,
          purgar_arquivo: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detalhe || j.error || "Falha no commit");
      setCommitResult(j);
      setStep(6);
      toast.success("Importação concluída");
    } catch (e: any) { toast.error(e.message || "Falha no commit"); }
    finally { setBusy(false); }
  }

  async function doCancelar() {
    if (!uploadResp) { nav(BASE); return; }
    setBusy(true);
    try {
      await call("psico-importacao-cancelar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importacao_id: uploadResp.importacao_id, motivo: "cancelado_pelo_usuario" }),
      });
      toast.success("Importação cancelada e arquivo removido");
      nav(BASE);
    } catch { toast.error("Falha ao cancelar"); }
    finally { setBusy(false); }
  }

  // ---------------- render ----------------
  return (
    <div>
      <PageHeader
        title="Importar Avaliação Histórica"
        subtitle="Modo Bruto — uma linha do arquivo = um respondente anônimo."
        actions={
          <Button variant="ghost" onClick={() => nav(BASE)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />
      <div className="p-6 space-y-6 max-w-5xl">
        <StepIndicator step={step} />
        <PrivacyAlert />

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>1. Contexto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Modo de importação *</Label>
                <div className="grid md:grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setTipo("bruta_respondentes")}
                    className={`text-left border rounded p-3 ${tipo === "bruta_respondentes" ? "border-primary bg-primary/5" : "border-muted"}`}
                  >
                    <div className="font-medium text-sm">Bruto (um respondente por linha)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      CSV/XLSX do Google Forms ou export similar. Permite segmentação por função/setor/unidade.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("agregada_perguntas")}
                    className={`text-left border rounded p-3 ${tipo === "agregada_perguntas" ? "border-primary bg-primary/5" : "border-muted"}`}
                  >
                    <div className="font-medium text-sm">Agregado (contagens por pergunta)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Colunas: <code>numero</code>, <code>quantidade_nunca</code> … <code>quantidade_sempre</code>.
                      <b> Sem segmentação</b> e sem % de participação.
                    </div>
                  </button>
                </div>
                {tipo === "agregada_perguntas" && (
                  <p className="text-xs text-amber-700 mt-2">
                    ⚠ No modo agregado a avaliação fica marcada como <code>segmentacao_disponivel=false</code> e
                    <code> participacao_calculavel=false</code>. Nenhuma resposta individual é criada.
                  </p>
                )}
              </div>
              <div>
                <Label>Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Questionário *</Label>
                <Select value={questId} onValueChange={setQuestId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a versão" /></SelectTrigger>
                  <SelectContent>
                    {questionarios.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.codigo} — {q.nome} (v{q.versao}) {q.vigente ? "· vigente" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {questSelecionado?.codigo?.startsWith("QPPOT-1.0-LEGADO") && (
                  <p className="text-xs text-muted-foreground mt-1">
                    QPPOT-1.0-LEGADO — questionário histórico (35 perguntas). Não vigente para novas coletas.
                  </p>
                )}
              </div>
              <div>
                <Label>Observação de origem</Label>
                <Textarea value={obsOrigem} onChange={e => setObsOrigem(e.target.value)} rows={2} />
                <p className="text-xs text-muted-foreground mt-1">Ficará registrada na avaliação criada.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => nav(BASE)}>Cancelar</Button>
                <Button disabled={!clienteId || !questId} onClick={() => setStep(2)}>
                  Próximo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>2. Upload do arquivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {tipo === "agregada_perguntas" && (
                <Alert>
                  <AlertTitle>Modelo esperado</AlertTitle>
                  <AlertDescription className="text-xs">
                    Colunas obrigatórias (CSV ou XLSX):
                    <code className="ml-1">numero,quantidade_nunca,quantidade_raramente,quantidade_as_vezes,quantidade_frequentemente,quantidade_sempre</code>.
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={baixarTemplateAgregado}>
                        Baixar template CSV
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <Label>Arquivo (CSV ou XLSX, até 25 MB)</Label>
                <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} />
                {file && (
                  <div className="text-sm text-muted-foreground mt-2">
                    <b>{file.name}</b> · {(file.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cada linha representa um respondente. Colunas com nome/e-mail/telefone podem existir no arquivo — serão
                marcadas como ignoradas no próximo passo e não serão gravadas.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
                <Button disabled={!file || busy} onClick={doUpload}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Enviar e detectar colunas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && uploadResp && (
          <MapeamentoStep
            headers={uploadResp.cabecalhos}
            amostra={uploadResp.amostra}
            perguntasNumeros={perguntasNumeros}
            mapData={mapData} setMapData={setMapData}
            mapFuncao={mapFuncao} setMapFuncao={setMapFuncao}
            mapSetor={mapSetor} setMapSetor={setMapSetor}
            mapUnidade={mapUnidade} setMapUnidade={setMapUnidade}
            mapPerguntas={mapPerguntas} setMapPerguntas={setMapPerguntas}
            ignoradas={ignoradas} setIgnoradas={setIgnoradas}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>4. Validação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vamos ler o arquivo, normalizar as opções de resposta e gerar um staging técnico sem PII.
                Nenhuma resposta é ainda gravada nas tabelas finais.
              </p>
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
                <Button disabled={busy} onClick={doValidar}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Validar arquivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <>
            {validarResp && (
              <ValidacaoResumo
                validarResp={validarResp}
                errosDetalhados={errosDetalhados}
                confirmNome={confirmNome} setConfirmNome={setConfirmNome}
                confirmFuncao={confirmFuncao} setConfirmFuncao={setConfirmFuncao}
              />
            )}
            {tipo === "agregada_perguntas" && !validarResp && (
              <Alert>
                <AlertTitle>Modo agregado</AlertTitle>
                <AlertDescription className="text-sm">
                  O arquivo será lido no momento do commit: cada linha vira uma contagem por pergunta em
                  <code> psico_dados_agregados_perguntas</code>. Sem staging técnico.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader><CardTitle>Confirmação da avaliação histórica</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input value={avalTitulo} onChange={e => setAvalTitulo(e.target.value)} />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label>Unidade</Label>
                    <Input value={avalUnidade} onChange={e => setAvalUnidade(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data início (coleta original) *</Label>
                    <Input type="date" value={avalDataInicio} onChange={e => setAvalDataInicio(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data fim (coleta original) *</Label>
                    <Input type="date" value={avalDataFim} onChange={e => setAvalDataFim(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" onClick={doCancelar} disabled={busy}>
                    <X className="h-4 w-4 mr-2" /> Cancelar importação
                  </Button>
                  <div className="flex gap-2">
                    {tipo === "bruta_respondentes" && (
                      <Button variant="outline" onClick={() => setStep(3)} disabled={busy}>Ajustar mapeamento</Button>
                    )}
                    <Button
                      disabled={
                        busy || !avalTitulo || !avalDataInicio || !avalDataFim || avalDataFim < avalDataInicio ||
                        (validarResp !== null && validarResp.resumo.linhas_validas === 0) ||
                        (!!validarResp?.resumo?.nome_presente && !confirmNome) ||
                        (!!validarResp?.resumo?.funcao_presente && !confirmFuncao)
                      }
                      onClick={doCommit}
                    >
                      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Concluir importação
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === 6 && commitResult && (
          <Card>
            <CardHeader><CardTitle>Importação concluída</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-green-700">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  {tipo === "bruta_respondentes" ? (
                    <>
                      <div className="font-medium">{commitResult.respondentes_importados} respondentes importados</div>
                      <div className="text-sm text-muted-foreground">{commitResult.total_itens_importados} respostas gravadas</div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{commitResult.perguntas_gravadas} perguntas com dados agregados</div>
                      <div className="text-sm text-muted-foreground">
                        Avaliação criada como agregada (segmentação e % de participação indisponíveis).
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => nav(`${BASE}/avaliacoes/${commitResult.avaliacao_id}`)}>Abrir avaliação</Button>
                <Button variant="outline" onClick={() => nav(BASE)}>Voltar à lista</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
