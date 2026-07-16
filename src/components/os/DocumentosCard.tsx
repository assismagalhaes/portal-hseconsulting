import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2 } from "lucide-react";
import { osDocCategoriaLabel } from "@/lib/os";

export function DocumentosCard({ osId, documentos, onChange }: any) {
  const [cat, setCat] = useState("pendente");
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const add = async () => {
    if (!nome) return;
    let path: string | null = null;
    if (file) {
      const p = `${osId}/${Date.now()}-${file.name}`;
      const { error: e } = await supabase.storage.from("os-documentos").upload(p, file);
      if (e) return toast.error(e.message);
      path = p;
    }
    const { error } = await supabase.from("os_documentos").insert({ os_id: osId, categoria: cat as any, nome, anexo_path: path });
    if (error) return toast.error(error.message);
    setNome(""); setFile(null); onChange();
  };
  const download = async (d: any) => {
    if (!d.anexo_path) return;
    const { data } = await supabase.storage.from("os-documentos").createSignedUrl(d.anexo_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const del = async (d: any) => {
    if (d.anexo_path) await supabase.storage.from("os-documentos").remove([d.anexo_path]);
    await supabase.from("os_documentos").delete().eq("id", d.id); onChange();
  };
  const byCat = documentos.reduce((a: any, d: any) => { (a[d.categoria] ||= []).push(d); return a; }, {});
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold">Documentos</div>
      <div className="flex flex-wrap gap-2">
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(osDocCategoriaLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Nome do documento" value={nome} onChange={e => setNome(e.target.value)} className="flex-1 min-w-[200px]" />
        <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-auto" />
        <Button onClick={add}><Upload className="h-4 w-4 mr-1" />Adicionar</Button>
      </div>
      {["recebido", "gerado", "pendente"].map(k => (
        <div key={k}>
          <div className="text-xs uppercase text-muted-foreground mt-2 mb-1">{osDocCategoriaLabel[k]}</div>
          {(byCat[k] || []).map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-2 rounded">
              <span className="flex-1">{d.nome}</span>
              {d.anexo_path && <Button size="sm" variant="ghost" onClick={() => download(d)}>Baixar</Button>}
              <Button size="sm" variant="ghost" onClick={() => del(d)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {!(byCat[k] || []).length && <p className="text-xs text-muted-foreground">—</p>}
        </div>
      ))}
    </CardContent></Card>
  );
}