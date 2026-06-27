import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { validadeDocumento, registrarLogCliente } from "@/lib/cliente";
import { toast } from "sonner";

export default function ClienteDocumentos() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    document.title = "Documentos | Portal do Cliente";
    supabase.from("documentos_tecnicos")
      .select("id, numero, tipo, titulo, versao, revisao, data_emissao, data_vencimento, arquivo_final_path, status")
      .order("data_emissao", { ascending: false })
      .then(({ data }) => setItems(data || []));
  }, []);

  async function baixar(d: any) {
    if (!d.arquivo_final_path) return toast.info("Arquivo ainda não disponibilizado.");
    const { data, error } = await supabase.storage.from("documentos-tecnicos").createSignedUrl(d.arquivo_final_path, 60);
    if (error) return toast.error(error.message);
    await registrarLogCliente("documento_baixado", d.numero);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <PageHeader title="Documentos técnicos" subtitle="Documentos liberados pela HSE" />
      <div className="p-6 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhum documento liberado.</div>}
        {items.map(d => {
          const v = validadeDocumento(d.data_vencimento);
          return (
            <Card key={d.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{d.tipo}</Badge>
                    <span className="font-semibold">{d.numero}</span>
                    <Badge variant="secondary">v{d.versao || 1}.{d.revisao || 0}</Badge>
                  </div>
                  <div className="text-sm mt-1">{d.titulo}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Emissão: {d.data_emissao || "—"} • Validade: {d.data_vencimento || "—"} • <span>{v.emoji} {v.label}</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => baixar(d)}>
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}