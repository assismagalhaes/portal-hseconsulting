import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { detectarConflitos } from "@/lib/os";
import { toast } from "sonner";

type View = "dia" | "semana" | "mes";

function startOfWeek(d: Date) { const x = new Date(d); const diff = (x.getDay() + 6) % 7; x.setDate(x.getDate() - diff); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function ymdLocal(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function Agenda() {
  const [view, setView] = useState<View>("semana");
  const [cursor, setCursor] = useState<Date>(() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x; });
  const [eventos, setEventos] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [fProf, setFProf] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "dia") return { start: cursor, end: addDays(cursor, 1) };
    if (view === "semana") { const s = startOfWeek(cursor); return { start: s, end: addDays(s, 7) }; }
    const s = startOfMonth(cursor); const e = addDays(endOfMonth(cursor), 1); return { start: s, end: e };
  }, [view, cursor]);

  const load = async () => {
    const [{ data }, { data: p }, { data: roles }] = await Promise.all([
      supabase.from("os_eventos_agenda")
        .select("*, ordens_servico(numero, titulo, cliente_nome, cidade)")
        .gte("start_at", range.start.toISOString())
        .lt("start_at", range.end.toISOString())
        .order("start_at"),
      supabase.from("execucao_profissionais").select("id, nome").order("nome"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin","tecnico","comercial"] as any),
    ]);
    const execList = ((p as any) || []).map((x: any) => ({ id: x.id, nome: x.nome }));
    const userIds = Array.from(new Set(((roles as any) || []).map((r: any) => r.user_id))) as string[];
    let userList: any[] = [];
    if (userIds.length) {
      const { data: pr } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
      userList = (pr || []).map((u: any) => ({ id: u.id, nome: u.nome || u.email }));
    }
    const seen = new Set<string>();
    const combined = [...execList, ...userList].filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    setEventos((data as any) || []); setProfs(combined);
  };
  useEffect(() => { load(); }, [range.start.getTime(), range.end.getTime()]);

  const filtered = useMemo(() => eventos.filter(e => fProf === "all" || e.profissional_id === fProf), [eventos, fProf]);
  const conflitos = useMemo(() => detectarConflitos(filtered), [filtered]);

  const onDropDate = async (newDate: Date, evId: string) => {
    const ev = eventos.find(e => e.id === evId); if (!ev) return;
    // Desloca o evento por dias inteiros, preservando o horário original (evita problemas de fuso).
    const evStart = new Date(ev.start_at);
    const evEnd = new Date(ev.end_at);
    const currentDayUtc = Date.UTC(evStart.getUTCFullYear(), evStart.getUTCMonth(), evStart.getUTCDate());
    const targetDayUtc = Date.UTC(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    const diffMs = targetDayUtc - currentDayUtc;
    if (diffMs === 0) return;
    const start = new Date(evStart.getTime() + diffMs);
    const end = new Date(evEnd.getTime() + diffMs);
    const { error } = await supabase.from("os_eventos_agenda").update({ start_at: start.toISOString(), end_at: end.toISOString() }).eq("id", evId);
    if (error) return toast.error(error.message);
    if (ev.visita_id) {
      await supabase.from("os_visitas").update({ data: ymdLocal(newDate) }).eq("id", ev.visita_id);
    }
    toast.success("Evento movido"); load();
  };

  const navPrev = () => setCursor(addDays(cursor, view === "dia" ? -1 : view === "semana" ? -7 : -30));
  const navNext = () => setCursor(addDays(cursor, view === "dia" ? 1 : view === "semana" ? 7 : 30));
  const navToday = () => { const x = new Date(); x.setHours(0,0,0,0); setCursor(x); };

  const title = view === "dia"
    ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "semana"
    ? `${range.start.toLocaleDateString("pt-BR")} – ${addDays(range.end, -1).toLocaleDateString("pt-BR")}`
    : cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Agenda Operacional" subtitle="Planejamento e distribuição das ordens de serviço" />
      <div className="p-6 space-y-4">
        <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={navToday}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
          <div className="font-display text-lg ml-2 capitalize flex-1">{title}</div>
          <Select value={fProf} onValueChange={setFProf}><SelectTrigger className="w-52"><SelectValue placeholder="Profissional" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select>
          <Select value={view} onValueChange={(v: any) => setView(v)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="dia">Dia</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent></Select>
        </CardContent></Card>

        {view === "dia" && <DayView date={cursor} eventos={filtered} conflitos={conflitos} onDropDate={onDropDate} />}
        {view === "semana" && <WeekView start={range.start} eventos={filtered} conflitos={conflitos} onDropDate={onDropDate} />}
        {view === "mes" && <MonthView cursor={cursor} eventos={filtered} conflitos={conflitos} onDropDate={onDropDate} />}
      </div>
    </>
  );
}

function EventCard({ ev, conflito }: any) {
  return (
    <Link to={`/ordens-servico/${ev.os_id}`}
      draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", ev.id)}
      className={`block text-xs p-1.5 rounded mb-1 cursor-move border-l-4 ${conflito ? "bg-rose-50 border-rose-500" : "bg-emerald-50 border-emerald-500 hover:bg-emerald-100"}`}>
      <div className="font-mono text-[10px] text-muted-foreground">{ev.ordens_servico?.numero}</div>
      <div className="font-medium truncate">{ev.titulo}</div>
      <div className="text-[10px] text-muted-foreground truncate">
        {new Date(ev.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–
        {new Date(ev.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        {ev.cidade && ` • ${ev.cidade}`}
      </div>
      {conflito && <div className="text-[10px] text-rose-700 flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3" />Conflito</div>}
    </Link>
  );
}

function DayView({ date, eventos, conflitos, onDropDate }: any) {
  return (
    <Card><CardContent className="p-4 min-h-[500px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) onDropDate(date, id); }}>
      <div className="font-semibold mb-3">{date.toLocaleDateString("pt-BR", { weekday: "long" })}</div>
      {eventos.map((ev: any) => <EventCard key={ev.id} ev={ev} conflito={conflitos.has(ev.id)} />)}
      {!eventos.length && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
    </CardContent></Card>
  );
}

function WeekView({ start, eventos, conflitos, onDropDate }: any) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDay: Record<string, any[]> = {};
  eventos.forEach((e: any) => { const k = ymd(new Date(e.start_at)); (byDay[k] ||= []).push(e); });
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(d => (
        <Card key={ymd(d)}><CardContent className="p-2 min-h-[300px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) onDropDate(d, id); }}>
          <div className="text-xs font-semibold mb-2 capitalize">{d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}</div>
          {(byDay[ymd(d)] || []).map(ev => <EventCard key={ev.id} ev={ev} conflito={conflitos.has(ev.id)} />)}
        </CardContent></Card>
      ))}
    </div>
  );
}

function MonthView({ cursor, eventos, conflitos, onDropDate }: any) {
  const first = startOfMonth(cursor);
  const startGrid = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(startGrid, i));
  const byDay: Record<string, any[]> = {};
  eventos.forEach((e: any) => { const k = ymd(new Date(e.start_at)); (byDay[k] ||= []).push(e); });
  return (
    <div className="grid grid-cols-7 gap-1">
      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => <div key={d} className="text-xs font-semibold text-center text-muted-foreground">{d}</div>)}
      {days.map(d => {
        const inMonth = d.getMonth() === cursor.getMonth();
        return (
          <div key={ymd(d)} className={`border rounded p-1.5 min-h-[90px] ${inMonth ? "bg-card" : "bg-muted/30"}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) onDropDate(d, id); }}>
            <div className={`text-xs ${inMonth ? "" : "text-muted-foreground"}`}>{d.getDate()}</div>
            {(byDay[ymd(d)] || []).slice(0, 3).map(ev => <EventCard key={ev.id} ev={ev} conflito={conflitos.has(ev.id)} />)}
            {(byDay[ymd(d)] || []).length > 3 && <div className="text-[10px] text-muted-foreground">+{(byDay[ymd(d)] || []).length - 3}</div>}
          </div>
        );
      })}
    </div>
  );
}