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
import { Pencil } from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid, LabelList } from "recharts";
import * as XLSX from "xlsx";

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
  const [ajustarOpen, setAjustarOpen] = useState(false);
  const [novaPrevisao, setNovaPrevisao] = useState<number>(Number(av?.quantidade_participantes_prevista) || 1);
  const [salvandoPrevisao, setSalvandoPrevisao] = useState(false);
  const podeAjustarPrevisao = av?.status !== "cancelada" && av?.status !== "relatorio_emitido";

  async function salvarPrevisao() {
    const val = Math.max(1, Math.floor(Number(novaPrevisao) || 0));
    if (val < totalRespostas) {
      toast.error(`A previsão não pode ser menor que ${totalRespostas} respostas já recebidas.`);
      return;
    }
    setSalvandoPrevisao(true);
    const { error } = await supabase
      .from("psico_avaliacoes")
      .update({ quantidade_participantes_prevista: val })
      .eq("id", av.id);
    setSalvandoPrevisao(false);
    if (error) return toast.error(error.message);
    toast.success("Previsão atualizada");
    setAjustarOpen(false);
    onReload();
  }
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [mostrarNomes, setMostrarNomes] = useState(true);
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

  function exportarXlsx() {
    const wb = XLSX.utils.book_new();

    const partRows = participantes.map((p) => ({
      Nome: p.nome,
      "Data/Hora": new Date(p.created_at).toLocaleString("pt-BR"),
    }));
    const wsPart = XLSX.utils.json_to_sheet(
      partRows.length ? partRows : [{ Nome: "", "Data/Hora": "" }],
    );
    wsPart["!cols"] = [{ wch: 40 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsPart, "Participantes");

    const respRows = respostas.map((r) => ({
      "Data/Hora": new Date(r.created_at).toLocaleString("pt-BR"),
      Função: r.funcao || "",
      Setor: r.setor || "",
      Unidade: r.unidade || "",
    }));
    const wsResp = XLSX.utils.json_to_sheet(
      respRows.length ? respRows : [{ "Data/Hora": "", Função: "", Setor: "", Unidade: "" }],
    );
    wsResp["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsResp, "Respostas");

    XLSX.writeFile(wb, `adesao-${av.codigo || av.id}.xlsx`);
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

  async function baixarFlyer() {
    if (!podeCompartilhar || !publicUrl) {
      toast.info("Abra a coleta antes de gerar o flyer.");
      return;
    }
    try {
      // Busca nome do cliente para personalizar
      let clienteNome = "";
      if (av?.cliente_id) {
        const { data: c } = await supabase.from("clients")
          .select("razao_social, nome_fantasia").eq("id", av.cliente_id).maybeSingle();
        clienteNome = (c?.nome_fantasia || c?.razao_social || "").toUpperCase();
      }

      // QR em alta resolução para impressão
      const qrHi = await QRCode.toDataURL(publicUrl, { margin: 1, width: 1200, errorCorrectionLevel: "H" });

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const W = 210, H = 297;
      const NAVY: [number, number, number] = [15, 44, 74];
      const NAVY_SOFT: [number, number, number] = [30, 64, 100];
      const ACCENT: [number, number, number] = [16, 185, 129]; // emerald
      const MUTED: [number, number, number] = [110, 120, 135];
      const CREAM: [number, number, number] = [248, 245, 240];

      // Fundo
      doc.setFillColor(...CREAM);
      doc.rect(0, 0, W, H, "F");

      // Faixa superior navy
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 55, "F");
      // Faixa fina de sotaque
      doc.setFillColor(...ACCENT);
      doc.rect(0, 55, W, 1.5, "F");

      // Cabeçalho
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("NR-01 · SAÚDE MENTAL NO TRABALHO", 18, 20);
      doc.setFontSize(22);
      doc.text("Sua opinião importa.", 18, 34);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Participe da Avaliação de Fatores Psicossociais.", 18, 44);

      // Bloco cliente
      let y = 70;
      if (clienteNome) {
        doc.setTextColor(...MUTED);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("EMPRESA", 18, y);
        doc.setTextColor(...NAVY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(doc.splitTextToSize(clienteNome, W - 36) as any, 18, y + 6);
        y += 18;
      }

      const unidadeNome = (av?.unidade || "").toString().trim();
      if (unidadeNome) {
        doc.setTextColor(...MUTED);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("UNIDADE", 18, y);
        doc.setTextColor(...NAVY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(doc.splitTextToSize(unidadeNome, W - 36) as any, 18, y + 6);
        y += 16;
      }

      // Texto convite
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Como funciona", 18, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(60, 68, 82);
      const bullets = [
        "É rápido: cerca de 8 a 12 minutos para responder.",
        "É anônimo: suas respostas não são identificadas individualmente.",
        "É importante: os resultados orientam melhorias no ambiente de trabalho.",
        "Não há resposta certa ou errada — responda com sinceridade.",
      ];
      bullets.forEach((b) => {
        doc.setFillColor(...ACCENT);
        doc.circle(20, y - 1.2, 1.1, "F");
        doc.text(b, 25, y);
        y += 6;
      });

      y += 4;

      // Caixa QR
      const boxX = 18, boxY = y, boxW = W - 36, boxH = 100;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 216, 208);
      doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

      // QR à esquerda
      const qrSize = 78;
      const qrX = boxX + 8;
      const qrY = boxY + (boxH - qrSize) / 2;
      doc.addImage(qrHi, "PNG", qrX, qrY, qrSize, qrSize);

      // Texto ao lado
      const tx = qrX + qrSize + 10;
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Aponte a câmera", tx, boxY + 20);
      doc.text("do celular no QR Code", tx, boxY + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text("Ou acesse o endereço:", tx, boxY + 40);
      doc.setFont("courier", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...NAVY);
      const urlLines = doc.splitTextToSize(publicUrl, boxW - (tx - boxX) - 8) as string[];
      urlLines.forEach((line, i) => doc.text(line, tx, boxY + 47 + i * 5));

      // Prazo
      if (av?.data_fim_prevista) {
        const prazo = new Date(av.data_fim_prevista).toLocaleDateString("pt-BR");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...ACCENT);
        doc.text(`Responda até ${prazo}`, tx, boxY + boxH - 10);
      }

      y = boxY + boxH + 10;

      // Rodapé confidencialidade
      doc.setFillColor(...NAVY_SOFT);
      doc.rect(0, H - 30, W, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Confidencialidade garantida", 18, H - 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(220, 228, 240);
      const conf = "As respostas são tratadas de forma agregada e anônima, conforme a NR-01 e a LGPD. Nenhum resultado individual é identificado ou compartilhado com gestores.";
      const confLines = doc.splitTextToSize(conf, W - 36) as string[];
      confLines.forEach((l, i) => doc.text(l, 18, H - 14 + i * 4));

      // Marca inferior
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("HSE CONSULTING", W - 18, H - 4, { align: "right" });

      doc.save(`flyer-avaliacao-${av.codigo || av.id}.pdf`);
    } catch (e: any) {
      toast.error("Falha ao gerar flyer: " + (e?.message || String(e)));
    }
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
              <div className="text-xs space-y-2 flex-1">
                <p><QrCode className="h-3 w-3 inline mr-1" /> QR Code do link público — pode ser impresso e afixado em murais internos.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={baixarFlyer}>
                    <Download className="h-4 w-4 mr-2" /> Baixar flyer (PDF A4)
                  </Button>
                  <Button size="sm" variant="outline" onClick={baixarQR}>Baixar somente QR (PNG)</Button>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  O flyer inclui QR Code, link curto, prazo e instruções — pronto para impressão em murais e comunicados.
                </p>
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
            {podeAjustarPrevisao && (
              <Button size="sm" variant="outline" onClick={() => { setNovaPrevisao(Number(av?.quantidade_participantes_prevista) || 1); setAjustarOpen(true); }}>
                <Pencil className="h-3 w-3 mr-1" /> Ajustar previsão
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportarXlsx} disabled={respostas.length === 0 && participantes.length === 0}>
              <Download className="h-3 w-3 mr-1" /> Exportar Excel
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
              {(() => {
                const prev = Number(av.quantidade_participantes_prevista) || 0;
                const pct = prev ? Math.round((totalRespostas / prev) * 100) : 0;
                const excedeu = prev > 0 && totalRespostas > prev;
                return (
                  <>
                    <div className={`text-2xl font-semibold ${excedeu ? "text-amber-600" : ""}`}>
                      {Math.min(pct, 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {excedeu ? (
                        <span className="text-amber-600">Excedeu previsão (+{totalRespostas - prev})</span>
                      ) : (
                        "Adesão"
                      )}
                    </div>
                  </>
                );
              })()}
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

      <AlertDialog open={ajustarOpen} onOpenChange={setAjustarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ajustar previsão de participantes</AlertDialogTitle>
            <AlertDialogDescription>
              Atualize o número previsto quando a quantidade real diferir do planejado (ex.: mais pessoas responderam do que o estimado). Isso mantém o cálculo de adesão coerente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nova previsão</Label>
            <Input
              type="number"
              min={Math.max(1, totalRespostas)}
              value={novaPrevisao}
              onChange={(e) => setNovaPrevisao(Number(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              Respostas já recebidas: <strong>{totalRespostas}</strong>. A previsão não pode ser menor que esse valor.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvandoPrevisao}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); salvarPrevisao(); }} disabled={salvandoPrevisao}>
              {salvandoPrevisao ? "Salvando…" : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}