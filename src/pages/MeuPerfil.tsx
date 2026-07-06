import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function MeuPerfil() {
  const { user, roles } = useAuth();
  const [p, setP] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Meu Perfil | Portal HSE Consulting";
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setP(data || { id: user.id, email: user.email });
      setLoading(false);
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      nome: p.nome, telefone: p.telefone, cargo: p.cargo, area: p.area,
      registro_profissional: p.registro_profissional, foto_url: p.foto_url,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  }

  async function uploadFoto(file: File) {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatares").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("avatares").getPublicUrl(path);
    const url = data.publicUrl;
    setP({ ...p, foto_url: url });
    await supabase.from("profiles").update({ foto_url: url }).eq("id", user.id);
    toast.success("Foto atualizada");
  }

  if (loading) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;

  return (
    <div>
      <PageHeader title="Meu Perfil" subtitle="Seus dados pessoais e profissionais" />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-elegant">
          <CardHeader><CardTitle className="text-base">Foto</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={p.foto_url || undefined} />
              <AvatarFallback className="text-3xl">{(p.nome || user?.email || "U")[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <input ref={inputFile} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFoto(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => inputFile.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Alterar foto
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              <div>{user?.email}</div>
              <div className="mt-1 capitalize">Perfil: {roles.join(", ") || "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-elegant">
          <CardHeader><CardTitle className="text-base">Dados</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Nome completo</Label><Input value={p.nome || ""} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={p.telefone || ""} onChange={(e) => setP({ ...p, telefone: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={p.cargo || ""} onChange={(e) => setP({ ...p, cargo: e.target.value })} /></div>
            <div><Label>Área</Label><Input value={p.area || ""} onChange={(e) => setP({ ...p, area: e.target.value })} /></div>
            <div><Label>Registro profissional</Label><Input value={p.registro_profissional || ""} onChange={(e) => setP({ ...p, registro_profissional: e.target.value })} /></div>
            <div className="col-span-2 flex justify-end">
              <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}