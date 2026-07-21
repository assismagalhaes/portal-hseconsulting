import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Copy, RefreshCw, Link2, Users, Eye, EyeOff, QrCode, Download, Radio } from "lucide-react";
import QRCode from "qrcode";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid, LabelList } from "recharts";

type CampoCfg = { ativo: boolean; obrigatorio: boolean };
type CamposIdent = { nome: CampoCfg; funcao: CampoCfg; setor: CampoCfg; unidade: CampoCfg };

const DEFAULT_CAMPOS: CamposIdent = {
  nome:    { ativo: true,  obrigatorio: true  },
  funcao:  { ativo: true,  obrigatorio: true  },
  setor:   { ativo: true,  obrigatorio: false },
  unidade: { ativo: false, obrigatorio: false },
};

const CAMPO_LABELS: Record<keyof CamposIdent, string> = {
  nome: "Nome completo",
  funcao: "Função / Cargo",
  setor: "Setor / Área",
  unidade: "Unidade",
};

export default function PsicoLinkPublicoTab({ av, onReload }: { av: any; onReload: () => void }) {
  const [modo, setModo] = useState<string>(av?.modo_coleta || "nominal");
  const [token, setToken] = useState<string | null>(av?.link_publico_token || null);
  const [campos, setCampos] = useState<CamposIdent>({ ...DEFAULT_CAMPOS, ...(av?.campos_identificacao || {}) });
  const [registrar, setRegistrar] = useState<boolean>(!!av?.registrar_participacao);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Mantém o estado local sincronizado quando `av` é recarregado pelo pai.
  useEffect(() => {
    setCampos({ ...DEFAULT_CAMPOS, ...(av?.campos_identificacao || {}) });
    setRegistrar(!!av?.registrar_participacao);
  }, [av?.id, av?.campos_identificacao, av?.registrar_participacao]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<{ nome: string; created_at: string }[]>([]);
  const [totalRespostas, setTotalRespostas] = useState<number>(0);
  const [respostas, setRespostas] = useState<Array<{ id: string; funcao: string | null; setor: string | null; unidade: string | null; funcao_normalizada: string | null; setor_normalizada: string | null; unidade_normalizada: string | null; created_at: string }>>([]);
  const [realtimeAtivo, setRealtimeAtivo] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [mostrarNomes, setMostrarNomes] = useState(false);
  const [confirmarRotacao, setConfirmarRotacao] = useState(false);

  const publicUrl = useMemo(() => {
    if (!token) return null;
    // Sempre publicar com o domínio institucional (não com URLs de preview do Lovable)
    // e com rota curta /p#TOKEN para facilitar compartilhamento e QR Code.
    const host = typeof window !== "undefined" && /(^|\.)hseconsulting\./.test(window.location.hostname)
      ? window.location.origin
      : "https://portal.hseconsulting.com.br";
    return `${host}/p#${encodeURIComponent(token)}`;
  }, [token]);

  const coletaAberta = av?.status === "coleta_em_andamento";
  const podeCompartilhar = !!publicUrl && coletaAberta;

  useEffect(() => {
    if (!publicUrl) { setQrDataUrl(null); return; }
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [publicUrl]);

  async function carregarAdesao() {
    const [{ data: parts }, { count: qtdResp }, { data: resps }] = await Promise.all([
      supabase.from("psico_registro_participacao")
        .select("nome, created_at", { count: "exact" })
        .eq("avaliacao_id", av.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("psico_respostas_publicas")
        .select("id", { count: "exact", head: true })
        .eq("avaliacao_id", av.id),
      supabase.from("psico_respostas_publicas")
        .select("id, funcao, setor, unidade, funcao_normalizada, setor_normalizada, unidade_normalizada, created_at")
        .eq("avaliacao_id", av.id)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    setParticipantes((parts || []) as any);
    setTotalRespostas(qtdResp || 0);
    setRespostas((resps || []) as any);
    setUltimaAtualizacao(new Date());
  }
  useEffect(() => { if (modo === "publico_anonimo") carregarAdesao(); }, [modo, av?.id]);

  // Fase 4 — Realtime: escuta inserts em psico_respostas_publicas e psico_registro_participacao.
  useEffect(() => {
    if (modo !== "publico_anonimo" || !av?.id) return;
    const channel = supabase
      .channel(`psico-adesao-${av.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "psico_respostas_publicas", filter: `avaliacao_id=eq.${av.id}` }, () => carregarAdesao())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "psico_registro_participacao", filter: `avaliacao_id=eq.${av.id}` }, () => carregarAdesao())
      .subscribe((status) => setRealtimeAtivo(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); setRealtimeAtivo(false); };
  }, [modo, av?.id]);

  // Agregações por dimensão (usa rótulo original quando disponível, senão normalizado).
  const agregados = useMemo(() => {
    function agg(dim: "funcao" | "setor" | "unidade") {
      const map = new Map<string, { rotulo: string; total: number }>();
      for (const r of respostas) {
        const norm = (r as any)[`${dim}_normalizada`] as string | null;
        const rot = ((r as any)[dim] as string | null) || norm || "Não informado";
        const key = norm || "__na__";
        const cur = map.get(key) || { rotulo: rot, total: 0 };
        cur.total += 1;
        map.set(key, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }
    return { funcao: agg("funcao"), setor: agg("setor"), unidade: agg("unidade") };
  }, [respostas]);

  function exportarCsv() {
    const header = ["created_at", "funcao", "setor", "unidade"];
    const linhas = respostas.map((r) => [
      new Date(r.created_at).toISOString(),
      (r.funcao || "").replace(/"/g, '""'),
      (r.setor || "").replace(/"/g, '""'),
      (r.unidade || "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...linhas].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adesao-${av.codigo || av.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function ativarModoPublico() {
    setSaving(true);
    const { data, error } = await supabase.rpc("psico_gerar_link_publico", { p_avaliacao_id: av.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setToken(data as any);
    setModo("publico_anonimo");
    toast.success("Modo público ativado e link gerado");
    onReload();
  }

  async function rotacionarLink() {
    setConfirmarRotacao(true);
  }

  async function persistirConfig(next: { campos: CamposIdent; registrar: boolean }, opts?: { silencioso?: boolean }) {
    setSaving(true);
    const { error } = await supabase.from("psico_avaliacoes")
      .update({ campos_identificacao: next.campos, registrar_participacao: next.registrar })
      .eq("id", av.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date());
    if (!opts?.silencioso) toast.success("Configuração salva");
    onReload();
  }
  async function salvarConfig() {
    await persistirConfig({ campos, registrar });
  }

  function copiarLink() {
    if (!podeCompartilhar || !publicUrl) {
      toast.info("Abra a coleta antes de compartilhar o link público.");
      return;
    }
    navigator.clipboard.writeText(publicUrl).then(() => toast.success("Link copiado"));
  }

  function baixarQR() {
    if (!podeCompartilhar || !qrDataUrl) {
      toast.info("Abra a coleta antes de baixar o QR Code.");
      return;
    }
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qrcode-${av.codigo || av.id}.png`;
    a.click();
  }

  function toggleCampo(k: keyof CamposIdent, chave: "ativo" | "obrigatorio") {
    setCampos((c) => {
      const atual = c[k];
      const proximo: CampoCfg = {
        ...atual,
        [chave]: !atual[chave],
        ...(chave === "ativo" && atual.ativo ? { obrigatorio: false } : {}),
      };
      const next = { ...c, [k]: proximo };
      // Auto-save para evitar perda de configuração caso o usuário esqueça de clicar em "Salvar".
      const nextRegistrar = k === "nome" && chave === "ativo" && !proximo.ativo ? false : registrar;
      if (k === "nome" && chave === "ativo" && !proximo.ativo) setRegistrar(false);
      void persistirConfig({ campos: next, registrar: nextRegistrar }, { silencioso: true });
      return next;
    });
  }

  function toggleRegistrar(v: boolean) {
    setRegistrar(v);
    void persistirConfig({ campos, registrar: v }, { silencioso: true });
  }

  if (modo !== "publico_anonimo") {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Link público anônimo</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Esta avaliação está no modo <strong>nominal</strong> (convites individuais). Ative o modo <strong>público anônimo</strong> para gerar
            um único link/QR Code que qualquer pessoa da empresa pode acessar sem login.
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
            <li>Ideal para funcionários sem e-mail ou com dificuldade de acesso digital.</li>
            <li>Respostas anônimas: identificação (nome, função, setor) fica em tabela separada das respostas.</li>
            <li>Recortes de resultado com menos de 2 respostas são automaticamente suprimidos.</li>
          </ul>
          <Button onClick={ativarModoPublico} disabled={saving}>
            <Link2 className="h-4 w-4 mr-2" /> Ativar modo público anônimo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Link público</CardTitle>
          <Badge variant={coletaAberta ? "secondary" : "outline"}>
            {coletaAberta ? "Modo público anônimo" : "Aguardando abertura"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {!coletaAberta && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                O link já está reservado, mas só fica acessível para respondentes após clicar em <strong>Abrir coleta</strong> na aba Coleta.
              </div>
            </div>
          )}
          <div>
            <Label>{coletaAberta ? "URL para compartilhar" : "URL reservada"}</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={publicUrl || ""} className="font-mono text-xs" />
              <Button variant="outline" onClick={copiarLink} disabled={!podeCompartilhar}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={rotacionarLink} title="Gerar novo link (invalida o atual)"><RefreshCw className="h-4 w-4" /></Button>
              <AlertDialog open={confirmarRotacao} onOpenChange={setConfirmarRotacao}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar novo link público?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O link atual deixará de funcionar imediatamente. Quem já respondeu não é afetado, mas quem ainda não abriu o link antigo precisará receber o novo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setConfirmarRotacao(false);
                        await ativarModoPublico();
                      }}
                    >
                      Gerar novo link
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {coletaAberta
                ? "Envie por WhatsApp, cole no mural interno ou imprima o QR Code abaixo."
                : "Finalize a abertura da coleta antes de enviar este endereço por WhatsApp, mural interno ou QR Code."}
            </p>
          </div>

          {qrDataUrl && coletaAberta && (
            <div className="border rounded p-4 flex items-center gap-4">
              <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
              <div className="text-xs space-y-2">
                <p><QrCode className="h-3 w-3 inline mr-1" /> QR Code do link público — pode ser impresso e afixado em murais internos.</p>
                <Button size="sm" variant="outline" onClick={baixarQR}>Baixar PNG</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campos da tela de identificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Marque quais informações serão pedidas ao respondente. Campos desativados não aparecem no formulário.
            Recomenda-se manter <strong>Função</strong> e <strong>Setor</strong> ativos para preservar recortes analíticos no relatório.
          </p>
          <div className="divide-y">
            {(Object.keys(campos) as (keyof CamposIdent)[]).map((k) => (
              <div key={k} className="flex items-center justify-between py-3">
                <div className="text-sm">
                  <div className="font-medium">{CAMPO_LABELS[k]}</div>
                  <div className="text-xs text-muted-foreground">
                    {campos[k].ativo
                      ? campos[k].obrigatorio ? "Ativo e obrigatório" : "Ativo e opcional"
                      : "Não aparece no formulário"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={campos[k].ativo} onCheckedChange={() => toggleCampo(k, "ativo")} />
                    Exibir
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={campos[k].obrigatorio} onCheckedChange={() => toggleCampo(k, "obrigatorio")} disabled={!campos[k].ativo} />
                    Obrigatório
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="text-sm">
              <div className="font-medium">Registrar lista de participantes</div>
              <div className="text-xs text-muted-foreground">
                Guarda apenas o nome de quem respondeu, em tabela separada das respostas. Serve para saber quem já participou. Desative para anonimato absoluto.
              </div>
            </div>
            <Switch checked={registrar} onCheckedChange={toggleRegistrar} disabled={!campos.nome.ativo} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {saving ? "Salvando..." : savedAt ? `Salvo automaticamente às ${savedAt.toLocaleTimeString()}` : "As alterações são salvas automaticamente."}
            </span>
            <Button variant="outline" size="sm" onClick={salvarConfig} disabled={saving}>Salvar novamente</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Adesão em tempo real
            {realtimeAtivo && (
              <Badge variant="outline" className="ml-2 border-emerald-400 text-emerald-600 gap-1 text-[10px]">
                <Radio className="h-3 w-3 animate-pulse" /> Ao vivo
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportarCsv} disabled={respostas.length === 0}>
              <Download className="h-3 w-3 mr-1" /> Exportar CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={carregarAdesao}><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border rounded p-3">
              <div className="text-2xl font-semibold">{totalRespostas}</div>
              <div className="text-xs text-muted-foreground">Respostas recebidas</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-2xl font-semibold">{av.quantidade_participantes_prevista || 0}</div>
              <div className="text-xs text-muted-foreground">Previstos</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-2xl font-semibold">
                {av.quantidade_participantes_prevista ? Math.round((totalRespostas / av.quantidade_participantes_prevista) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Adesão</div>
            </div>
          </div>

          {ultimaAtualizacao && (
            <div className="text-[10px] text-muted-foreground text-right">
              Última atualização: {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
            </div>
          )}

          {respostas.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              {(["setor", "funcao", "unidade"] as const).map((dim) => {
                const dados = agregados[dim];
                if (dados.length === 0) return null;
                return (
                  <div key={dim} className="border rounded p-2">
                    <div className="text-xs font-medium mb-1 capitalize">Por {dim === "funcao" ? "função" : dim}</div>
                    <ResponsiveContainer width="100%" height={Math.max(140, dados.length * 26)}>
                      <BarChart data={dados.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis type="category" dataKey="rotulo" width={110} tick={{ fontSize: 10 }} />
                        <RTooltip formatter={(v: any) => [`${v} resposta(s)`, ""]} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]}>
                          <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}

          {registrar ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Já responderam ({participantes.length})</div>
                <Button size="sm" variant="ghost" onClick={() => setMostrarNomes((v) => !v)}>
                  {mostrarNomes ? <><EyeOff className="h-3 w-3 mr-1" /> Ocultar nomes</> : <><Eye className="h-3 w-3 mr-1" /> Mostrar nomes</>}
                </Button>
              </div>
              {participantes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ninguém respondeu ainda.</p>
              ) : mostrarNomes ? (
                <ul className="text-sm divide-y max-h-72 overflow-auto border rounded">
                  {participantes.map((p, i) => (
                    <li key={i} className="px-3 py-2 flex justify-between">
                      <span>{p.nome}</span>
                      <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Nomes ocultos. Clique em "Mostrar nomes" quando precisar consultar.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Registro de participação desativado — anonimato absoluto.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}