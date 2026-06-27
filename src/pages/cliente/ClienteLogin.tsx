import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClienteAuth } from "@/lib/clienteAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/hse-logo-navy.png";
import { registrarLogCliente } from "@/lib/cliente";

export default function ClienteLogin() {
  const { user, clienteUser } = useClienteAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Acesso do Cliente | HSE Consulting"; }, []);
  if (user && clienteUser) return <Navigate to="/cliente/dashboard" replace />;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); return toast.error(error.message); }
    // valida que é usuário cliente ativo
    const { data: cu } = await supabase.from("cliente_usuarios")
      .select("id, status").eq("auth_user_id", data.user!.id).maybeSingle();
    setLoading(false);
    if (!cu || (cu as any).status !== "ativo") {
      await supabase.auth.signOut();
      return toast.error("Este acesso não está habilitado para o portal do cliente.");
    }
    await registrarLogCliente("login");
    nav("/cliente/dashboard");
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-hse text-white">
        <div className="flex items-center gap-3">
          <img src={logo} className="h-12 w-12 rounded-md bg-white/10 p-1.5" alt="" />
          <div>
            <div className="font-display text-xl font-bold">HSE Consulting</div>
            <div className="text-white/70 text-xs uppercase tracking-widest">Portal do Cliente</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">Acompanhe seus serviços, documentos e entregas em um só lugar.</h1>
          <p className="text-white/80">Propostas, ordens de serviço, documentos liberados e pendências — tudo seguro e organizado.</p>
        </div>
        <div className="text-white/50 text-xs">© HSE Consulting</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="space-y-2 mb-6">
            <h2 className="font-display text-2xl font-bold">Acesso do Cliente</h2>
            <p className="text-sm text-muted-foreground">Entre com o e-mail cadastrado pela HSE.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2"><Label>E-mail</Label>
              <Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Senha</Label>
              <Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
          </form>
        </div>
      </div>
    </div>
  );
}