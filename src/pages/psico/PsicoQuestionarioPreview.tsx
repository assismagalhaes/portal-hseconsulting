import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const sb: any = supabase;
const BASE = "/operacoes/avaliacao-fatores-psicossociais";

export default function PsicoQuestionarioPreview() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [quest, setQuest] = useState<any>(null);
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [opcoes, setOpcoes] = useState<any[]>([]);
  const [fatores, setFatores] = useState<any[]>([]);
  const [respondidas, setRespondidas] = useState<Set<number>>(new Set());
  const [showMeta, setShowMeta] = useState(false);

  useEffect(() => {
    document.title = "Pré-visualização | Questionário Psicossocial";
    (async () => {
      const { data: q } = await sb.from("psico_questionarios_versoes").select("*").eq("id", id).maybeSingle();
      if (!q) return;
      setQuest(q);
      const [{ data: p }, { data: o }, { data: f }] = await Promise.all([
        sb.from("psico_perguntas").select("*").eq("questionario_versao_id", id).eq("ativa", true).order("numero"),
        sb.from("psico_opcoes_resposta").select("*").eq("metodologia_versao_id", q.metodologia_versao_id).eq("ativo", true).order("ordem"),
        sb.from("psico_fatores").select("*").eq("questionario_versao_id", id),
      ]);
      setPerguntas(p || []); setOpcoes(o || []); setFatores(f || []);
    })();
  }, [id]);

  if (!quest) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const progresso = perguntas.length ? Math.round((respondidas.size / perguntas.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Pré-visualização interna"
        subtitle={`${quest.codigo} · ${quest.nome}`}
        actions={
          <div className="flex items-center gap-3">
            {isAdmin && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={showMeta} onCheckedChange={setShowMeta} />
                Mostrar metadados técnicos
              </label>
            )}
            <Button variant="outline" asChild><Link to={`${BASE}/configuracoes`}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link></Button>
          </div>
        }
      />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="py-3 text-xs text-amber-900 dark:text-amber-200">
            Modo pré-visualização. As respostas não são gravadas. Nenhum dado é enviado.
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6 space-y-3">
            <h1 className="text-2xl font-bold">{quest.nome}</h1>
            {quest.subtitulo && <p className="text-sm text-muted-foreground">{quest.subtitulo}</p>}
            {quest.aviso_nao_avaliacao_psicologica && (
              <div className="border-l-4 border-primary/40 bg-muted/30 p-3 text-sm">{quest.aviso_nao_avaliacao_psicologica}</div>
            )}
            {quest.orientacao_periodo_referencia && (
              <p className="text-sm"><strong>Período de referência:</strong> {quest.orientacao_periodo_referencia}</p>
            )}
            {quest.texto_abertura && <p className="text-sm whitespace-pre-wrap">{quest.texto_abertura}</p>}
          </CardContent>
        </Card>

        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
          <div className="flex items-center gap-3">
            <Progress value={progresso} className="flex-1" />
            <span className="text-xs text-muted-foreground">{respondidas.size} de {perguntas.length}</span>
          </div>
        </div>

        {perguntas.map((p) => {
          const fat = fatores.find((f) => f.id === p.fator_id);
          return (
            <Card key={p.id}>
              <CardContent className="py-5 space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="font-mono">{String(p.numero).padStart(2, "0")}</Badge>
                  <div className="flex-1">
                    <p className="font-medium">{p.texto}</p>
                    {p.texto_apoio_exemplo && <p className="text-xs text-muted-foreground italic mt-1">{p.texto_apoio_exemplo}</p>}
                    {showMeta && (
                      <div className="flex gap-2 mt-2 text-xs">
                        <Badge variant="outline">{fat?.nome}</Badge>
                        <Badge variant={p.sentido_pontuacao === "direta" ? "default" : "secondary"}>{p.sentido_pontuacao}</Badge>
                        <span className="text-muted-foreground">pesos: {opcoes.map((o: any) => p.sentido_pontuacao === "direta" ? o.peso_direta : o.peso_invertida).join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {opcoes.map((o: any) => (
                    <button key={o.id} disabled type="button"
                      onClick={() => setRespondidas((s) => new Set(s).add(p.numero))}
                      className="border rounded-md p-2 text-xs text-center bg-muted/20 cursor-not-allowed opacity-70">
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            Fim da pré-visualização. Nenhuma resposta foi gravada.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}