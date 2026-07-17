import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/hse-logo-navy.png";

export default function Auth() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Entrar | Portal HSE Consulting"; }, []);
  if (user) return <Navigate to="/" replace />;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav("/");
  }

  return (
    <div className="min-h-dvh grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-hse text-white">
        <div className="flex items-center gap-3">
          <img src={logo} className="h-20 w-20 rounded-md bg-white/10 p-2" alt="HSE Consulting" />
          <div>
            <div className="text-white/70 text-xs uppercase tracking-widest">Portal Interno</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight text-balance">
            Propostas técnicas, precificação e acompanhamento — em um só lugar.
          </h1>
          <p className="text-white/80">
            Cadastre clientes, monte propostas, calcule custos e margens e acompanhe o ciclo comercial completo.
          </p>
        </div>
        <div className="text-white/50 text-xs">© HSE Consulting — Saúde, Segurança e Meio Ambiente</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="space-y-2 mb-6">
            <h2 className="font-display text-2xl font-bold">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">Entre com sua conta de administrador.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2"><Label>E-mail</Label>
              <Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Senha</Label>
              <Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
            <p className="text-xs text-muted-foreground text-center">
              Cadastro de novos usuários temporariamente desativado.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}