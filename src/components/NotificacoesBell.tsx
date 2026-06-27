import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { PRIORIDADE_COLOR, PRIORIDADE_LABEL } from "@/lib/automacoes";

interface Notif {
  id: string;
  titulo: string;
  mensagem: string | null;
  modulo: string;
  prioridade: string;
  status: string;
  link: string | null;
  created_at: string;
}

export default function NotificacoesBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("id,titulo,mensagem,modulo,prioridade,status,link,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as Notif[]) ?? []);
    setUnread(((data as Notif[]) ?? []).filter((n) => n.status === "nao_lida").length);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function marcarLida(id: string) {
    await supabase.from("notificacoes").update({ status: "lida", lida_em: new Date().toISOString() }).eq("id", id);
    load();
  }
  async function marcarResolvida(id: string) {
    await supabase.from("notificacoes").update({ status: "resolvida", resolvida_em: new Date().toISOString() }).eq("id", id);
    load();
  }
  async function marcarTodasLidas() {
    if (!user) return;
    await supabase.from("notificacoes").update({ status: "lida", lida_em: new Date().toISOString() })
      .eq("user_id", user.id).eq("status", "nao_lida");
    load();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Notificações</SheetTitle>
            <Button variant="ghost" size="sm" onClick={marcarTodasLidas}>
              <CheckCheck className="h-4 w-4 mr-1" /> Marcar todas
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16 gap-2">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">Sem notificações</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id} className={`p-3 ${n.status === "nao_lida" ? "bg-muted/30" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={PRIORIDADE_COLOR[n.prioridade] ?? ""}>{PRIORIDADE_LABEL[n.prioridade] ?? n.prioridade}</Badge>
                        <span className="text-[11px] text-muted-foreground uppercase">{n.modulo}</span>
                      </div>
                      <div className="font-medium text-sm mt-1">{n.titulo}</div>
                      {n.mensagem && <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {n.link && (
                          <Button asChild size="sm" variant="outline" onClick={() => setOpen(false)}>
                            <Link to={n.link}>Abrir</Link>
                          </Button>
                        )}
                        {n.status !== "lida" && n.status !== "resolvida" && (
                          <Button size="sm" variant="ghost" onClick={() => marcarLida(n.id)}>
                            <Check className="h-3 w-3 mr-1" /> Lida
                          </Button>
                        )}
                        {n.status !== "resolvida" && (
                          <Button size="sm" variant="ghost" onClick={() => marcarResolvida(n.id)}>
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}