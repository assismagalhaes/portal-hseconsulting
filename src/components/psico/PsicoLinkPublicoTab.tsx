import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, RefreshCw, Link2, Users, Eye, EyeOff, QrCode } from "lucide-react";
import QRCode from "qrcode";

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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<{ nome: string; created_at: string }[]>([]);
  const [totalRespostas, setTotalRespostas] = useState<number>(0);
  const [mostrarNomes, setMostrarNomes] = useState(false);

  const publicUrl = useMemo(() => {
    if (!token) return null;
    return `${window.location.origin}/avaliacao/publica#token=${encodeURIComponent(token)}`;
  }, [token]);

  useEffect(() => {
    if (!publicUrl) { setQrDataUrl(null); return; }
    QRCode.toDataURL(publicUrl, { margin: 1, width: 320 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [publicUrl]);

  async function carregarAdesao() {
    const [{ data: parts, count }, { count: qtdResp }] = await Promise.all([
      supabase.from("psico_registro_participacao")
        .select("nome, created_at", { count: "exact" })
        .eq("avaliacao_id", av.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("psico_respostas_publicas")
        .select("id", { count: "exact", head: true })
        .eq("avaliacao_id", av.id),
    ]);
    setParticipantes((parts || []) as any);
    setTotalRespostas(qtdResp || 0);
  }
  useEffect(() => { if (modo === "publico_anonimo") carregarAdesao(); }, [modo, av?.id]);

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
    if (!confirm("Ao gerar um novo link, o link atual deixará de funcionar. Confirma?")) return;
    await ativarModoPublico();
  }

  async function salvarConfig() {
    setSaving(true);
    const { error } = await supabase.from("psico_avaliacoes")
      .update({ campos_identificacao: campos, registrar_participacao: registrar })
      .eq("id", av.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configuração salva");
    onReload();
  }

  function copiarLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => toast.success("Link copiado"));
  }

  function baixarQR() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qrcode-${av.codigo || av.id}.png`;
    a.click();
  }

  function toggleCampo(k: keyof CamposIdent, chave: "ativo" | "obrigatorio") {
    setCampos((c) => ({
      ...c,
      [k]: {
        ...c[k],
        [chave]: !c[k][chave],
        ...(chave === "ativo" && c[k].ativo ? { obrigatorio: false } : {}),
      },
    }));
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
          <Badge variant="secondary">Modo público anônimo</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL para compartilhar</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={publicUrl || ""} className="font-mono text-xs" />
              <Button variant="outline" onClick={copiarLink}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={rotacionarLink} title="Gerar novo link (invalida o atual)"><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Envie por WhatsApp, cole no mural interno ou imprima o QR Code abaixo. O link só funciona quando a coleta estiver aberta.
            </p>
          </div>

          {qrDataUrl && (
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
            <Switch checked={registrar} onCheckedChange={setRegistrar} disabled={!campos.nome.ativo} />
          </div>
          <div className="flex justify-end">
            <Button onClick={salvarConfig} disabled={saving}>Salvar configuração</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Adesão</CardTitle>
          <Button size="sm" variant="ghost" onClick={carregarAdesao}><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</Button>
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