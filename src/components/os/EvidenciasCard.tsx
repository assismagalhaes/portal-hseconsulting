import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { osEvidenciaTipoLabel } from "@/lib/os";

export function EvidenciasCard({ osId, evidencias, visitas, onChange }: any) {
  const [tipo, setTipo] = useState("foto");
  const [visitaId, setVisitaId] = useState("");
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const e of evidencias) {
        if (e.arquivo_path) {
          const { data } = await supabase.storage.from("os-evidencias").createSignedUrl(e.arquivo_path, 600);
          if (data?.signedUrl) map[e.id] = data.signedUrl;
        }
      }
      setUrls(map);
    })();
  }, [evidencias]);

  const add = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    const p = `${osId}/${Date.now()}-${file.name}`;
    const { error: e1 } = await supabase.storage.from("os-evidencias").upload(p, file);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("os_evidencias").insert({
      os_id: osId, visita_id: visitaId || null, tipo: tipo as any, arquivo_path: p, legenda, tamanho_bytes: file.size,
    });
    if (error) return toast.error(error.message);
    setFile(null); setLegenda(""); onChange();
  };
  const del = async (e: any) => {
    if (e.arquivo_path) await supabase.storage.from("os-evidencias").remove([e.arquivo_path]);
    await supabase.from("os_evidencias").delete().eq("id", e.id); onChange();
  };

  const grupos = evidencias.reduce((acc: any, e: any) => {
    const k = e.visita_id || "sem_visita"; (acc[k] ||= []).push(e); return acc;
  }, {});

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Galeria de evidências</div>
      <div className="flex flex-wrap gap-2">
        <Select value={tipo} onValueChange={setTipo}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osEvidenciaTipoLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={visitaId || "_none"} onValueChange={v => setVisitaId(v === "_none" ? "" : v)}><SelectTrigger className="w-56"><SelectValue placeholder="Visita (opcional)" /></SelectTrigger>
          <SelectContent><SelectItem value="_none">Sem visita</SelectItem>{visitas.map((v: any) => <SelectItem key={v.id} value={v.id}>{formatDate(v.data)} — {v.objetivo || "Visita"}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Legenda" value={legenda} onChange={e => setLegenda(e.target.value)} className="flex-1 min-w-[200px]" />
        <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-auto" />
        <Button onClick={add}><Upload className="h-4 w-4 mr-1" />Enviar</Button>
      </div>
      {Object.entries(grupos).map(([k, arr]: any) => {
        const visita = visitas.find((v: any) => v.id === k);
        return (
          <div key={k}>
            <div className="text-xs uppercase text-muted-foreground mt-3 mb-2">{visita ? `Visita ${formatDate(visita.data)} — ${visita.objetivo || ""}` : "Sem visita vinculada"}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {arr.map((e: any) => (
                <div key={e.id} className="border rounded-lg overflow-hidden bg-card">
                  {e.tipo === "foto" && urls[e.id]
                    ? <img src={urls[e.id]} alt={e.legenda || ""} className="w-full h-32 object-cover" />
                    : <div className="w-full h-32 bg-muted flex items-center justify-center text-3xl">{e.tipo === "video" ? "🎬" : e.tipo === "audio" ? "🎙️" : e.tipo === "pdf" ? "📄" : "📎"}</div>}
                  <div className="p-2 flex items-center gap-2">
                    <div className="text-xs flex-1 truncate">{e.legenda || osEvidenciaTipoLabel[e.tipo]}</div>
                    {urls[e.id] && <a href={urls[e.id]} target="_blank" rel="noreferrer" className="text-xs underline">abrir</a>}
                    <Button size="sm" variant="ghost" onClick={() => del(e)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!evidencias.length && <p className="text-sm text-muted-foreground">Nenhuma evidência ainda.</p>}
    </CardContent></Card>
  );
}