import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Loader2, AlertTriangle, ThumbsUp, ThumbsDown, FileText, History as HistoryIcon, Check, X as XIcon, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { iaChat } from "@/lib/iaClient";
import {
  SUGESTOES_POR_MODULO, SUGESTOES_CLIENTE,
  aplicarAcao, ignorarAcao, salvarResumoEntidade, enviarFeedback,
  type ModuloIa, type EntidadeTipo, type AcaoSugerida,
} from "@/lib/iaActions";

interface Msg { role: "user" | "assistant"; content: string; interacaoId?: string; acoes?: AcaoSugerida[] }

export interface IaContextDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modulo: ModuloIa;
  entidade_tipo?: EntidadeTipo;
  entidade_id?: string;
  client_id?: string | null;
  titulo?: string;
}

export default function IaContextDrawer({ open, onOpenChange, modulo, entidade_tipo, entidade_id, client_id, titulo }: IaContextDrawerProps) {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [resumos, setResumos] = useState<{ id: string; resumo: string; titulo: string | null; created_at: string }[]>([]);
  const [historico, setHistorico] = useState<{ id: string; pergunta: string; resposta: string | null; created_at: string }[]>([]);
  const [gerandoResumo, setGerandoResumo] = useState(false);

  const sugestoes = entidade_tipo === "cliente" ? SUGESTOES_CLIENTE : SUGESTOES_POR_MODULO[modulo] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    setMessages([]); setInput(""); setTab("chat");
    void loadResumos();
    void loadHistorico();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entidade_id, entidade_tipo]);

  async function loadResumos() {
    if (!entidade_id) { setResumos([]); return; }
    const { data } = await supabase.from("ia_resumos").select("id,resumo,titulo,created_at")
      .eq("entidade_id", entidade_id).order("created_at", { ascending: false }).limit(5);
    setResumos((data ?? []) as typeof resumos);
  }
  async function loadHistorico() {
    if (!entidade_id) { setHistorico([]); return; }
    const { data } = await supabase.from("ia_interacoes").select("id,pergunta,resposta,created_at")
      .eq("entidade_id", entidade_id).order("created_at", { ascending: false }).limit(10);
    setHistorico((data ?? []) as typeof historico);
  }

  async function send(text: string) {
    const pergunta = text.trim();
    if (!pergunta || loading) return;
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: pergunta }]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ia-chat", {
        body: { modulo, entidade_tipo, entidade_id, pergunta, history, request_actions: true },
      });
      if (error) throw error;
      const d = data as { resposta: string; interacao_id?: string; acoes?: AcaoSugerida[]; error?: string };
      if (d.error) throw new Error(d.error);
      setMessages((m) => [...m, { role: "assistant", content: d.resposta, interacaoId: d.interacao_id, acoes: d.acoes ?? [] }]);
      void loadHistorico();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na IA";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally { setLoading(false); }
  }

  async function gerarResumo() {
    setGerandoResumo(true);
    try {
      const pergunta = "Gere um resumo executivo objetivo desta entidade em português. Inclua: visão geral, pontos de atenção e próximas ações recomendadas. Use markdown com seções.";
      const { data, error } = await supabase.functions.invoke("ia-chat", {
        body: { modulo, entidade_tipo, entidade_id, pergunta, request_actions: false },
      });
      if (error) throw error;
      const d = data as { resposta: string };
      await salvarResumoEntidade({
        entidade_tipo: (entidade_tipo ?? "geral") as EntidadeTipo | "geral",
        entidade_id, modulo, titulo: "Resumo IA",
        resumo: d.resposta,
      });
      toast.success("Resumo gerado e salvo");
      await loadResumos();
      setTab("resumos");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar resumo");
    } finally { setGerandoResumo(false); }
  }

  async function onAplicar(acao: AcaoSugerida, edit = false) {
    try {
      let override: Record<string, unknown> | undefined;
      if (edit) {
        const novo = window.prompt("Editar título/descrição:", acao.titulo);
        if (novo === null) return;
        override = { titulo: novo, descricao: novo };
      }
      const payload = { ...(acao.payload ?? {}), client_id: acao.payload?.client_id ?? client_id ?? undefined };
      await aplicarAcao({ ...acao, payload }, override);
      toast.success("Ação aplicada");
      // marca local
      setMessages((ms) => ms.map((m) => ({
        ...m,
        acoes: m.acoes?.map((a) => a.id === acao.id ? { ...a, status: edit ? "editada_aplicada" : "aplicada" } : a),
      })));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar");
    }
  }
  async function onIgnorar(acao: AcaoSugerida) {
    await ignorarAcao(acao.id);
    setMessages((ms) => ms.map((m) => ({
      ...m, acoes: m.acoes?.map((a) => a.id === acao.id ? { ...a, status: "ignorada" } : a),
    })));
  }
  async function feedback(interacaoId: string | undefined, util: boolean) {
    if (!interacaoId) return;
    await enviarFeedback(interacaoId, util);
    toast.success("Obrigado pelo feedback");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente IA HSE
          </SheetTitle>
          <div className="text-xs text-muted-foreground">
            {titulo ?? `Contexto: ${modulo}${entidade_tipo ? ` · ${entidade_tipo}` : ""}`}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Sugestões da IA exigem validação humana.
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 grid grid-cols-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="resumos">Resumos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-3">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-3 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Sugestões rápidas:</p>
                  <div className="flex flex-wrap gap-2">
                    {sugestoes.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted">
                        {s}
                      </button>
                    ))}
                  </div>
                  {entidade_id && (
                    <Button variant="outline" size="sm" onClick={gerarResumo} disabled={gerandoResumo}>
                      {gerandoResumo ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
                      Gerar Resumo IA
                    </Button>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</div>
                  ) : (
                    <>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      {m.acoes && m.acoes.length > 0 && (
                        <div className="space-y-2">
                          {m.acoes.map((a) => (
                            <div key={a.id} className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                                <div className="flex-1 text-sm font-medium">{a.titulo}</div>
                                <Badge variant={a.status === "sugerida" ? "secondary" : "default"} className="text-[10px]">{a.status}</Badge>
                              </div>
                              {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
                              {a.status === "sugerida" && (
                                <div className="flex gap-2 pt-1">
                                  <Button size="sm" variant="default" onClick={() => onAplicar(a, false)}>
                                    <Check className="h-3 w-3 mr-1" /> Aplicar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => onAplicar(a, true)}>
                                    <Pencil className="h-3 w-3 mr-1" /> Editar e aplicar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => onIgnorar(a)}>
                                    <XIcon className="h-3 w-3 mr-1" /> Ignorar
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {m.interacaoId && (
                        <div className="flex items-center gap-1 pt-1">
                          <Button size="sm" variant="ghost" onClick={() => feedback(m.interacaoId, true)}>
                            <ThumbsUp className="h-3 w-3 mr-1" /> Útil
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => feedback(m.interacaoId, false)}>
                            <ThumbsDown className="h-3 w-3 mr-1" /> Ruim
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
                </div>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-border p-3 flex gap-2 items-end">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Pergunte ao copiloto HSE..." rows={2} className="flex-1 resize-none" disabled={loading} />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="resumos" className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 mt-3">
            {entidade_id && (
              <Button size="sm" onClick={gerarResumo} disabled={gerandoResumo}>
                {gerandoResumo ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
                Gerar novo resumo
              </Button>
            )}
            {resumos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resumo salvo ainda.</p>
            ) : resumos.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground mb-2">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{r.resumo}</ReactMarkdown>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="historico" className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 mt-3">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><HistoryIcon className="h-3.5 w-3.5" /> Sem interações registradas para esta entidade.</p>
            ) : historico.map((h) => (
              <div key={h.id} className="rounded-md border border-border bg-card p-3 text-xs space-y-1">
                <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                <div className="font-medium">{h.pergunta}</div>
                {h.resposta && <div className="text-muted-foreground line-clamp-3">{h.resposta}</div>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}