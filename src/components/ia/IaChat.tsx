import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { iaChat, type IaModulo } from "@/lib/iaClient";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

export default function IaChat({
  modulo = "geral",
  entidade_tipo,
  entidade_id,
  suggestions = [],
  title = "Assistente IA HSE",
  height = "h-[70vh]",
}: {
  modulo?: IaModulo;
  entidade_tipo?: "proposta" | "os" | "documento" | "cliente";
  entidade_id?: string;
  suggestions?: string[];
  title?: string;
  height?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const pergunta = text.trim();
    if (!pergunta || loading) return;
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", content: pergunta }]);
    setInput("");
    setLoading(true);
    try {
      const { resposta } = await iaChat({ modulo, entidade_tipo, entidade_id, pergunta, history });
      setMessages((m) => [...m, { role: "assistant", content: resposta }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na IA";
      toast.error(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex flex-col ${height} rounded-lg border border-border bg-card`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="font-display font-semibold">{title}</div>
        <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3 w-3" /> Sugestões exigem validação humana
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pergunte ao copiloto. Exemplos:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-border p-3 flex gap-2 items-end"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          placeholder="Pergunte algo ao copiloto HSE..."
          rows={2}
          className="flex-1 resize-none"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}