import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function TrocarSenha() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Trocar Senha | Portal HSE Consulting";
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  const salvar = async () => {
    if (nova.length < 8) return toast.error("A nova senha deve ter no mínimo 8 caracteres.");
    if (nova !== confirmar) return toast.error("A confirmação não confere.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) { setSaving(false); return toast.error(error.message); }
    if (user) {
      await supabase.from("profiles").update({ senha_provisoria: false }).eq("id", user.id);
    }
    toast.success("Senha atualizada com sucesso!");
    setSaving(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Defina sua nova senha</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Este é seu primeiro acesso. Para continuar, escolha uma senha pessoal com no mínimo 8 caracteres.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nova senha</Label>
            <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Confirme a nova senha</Label>
            <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          <Button className="w-full" onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar e continuar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}