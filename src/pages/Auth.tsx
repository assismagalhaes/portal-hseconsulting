import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/hse-logo.png";

export default function Auth() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { nome } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada. Você já pode entrar.");
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-hse text-white">
        <div className="flex items-center gap-3">
          <img src={logo} className="h-12 w-12 rounded-md bg-white/10 p-1.5" alt="" />
          <div>
            <div className="font-display text-xl font-bold">HSE Consulting</div>
            <div className="text-white/70 text-xs uppercase tracking-widest">Portal Interno</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight text-balance">
            Propostas técnicas, precificação e acompanhamento — em um só lugar.
          </h1>
          <p className="text-white/80">
            Cadastre clientes, monte propostas, calcule custos e margens, e acompanhe o ciclo comercial completo.
          </p>
        </div>
        <div className="text-white/50 text-xs">© HSE Consulting — Saúde, Segurança e Meio Ambiente</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Email</Label>
                  <Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Senha</Label>
                  <Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2"><Label>Nome</Label>
                  <Input required value={nome} onChange={e=>setNome(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label>
                  <Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Senha</Label>
                  <Input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>Criar conta</Button>
                <p className="text-xs text-muted-foreground">O primeiro usuário cadastrado vira admin automaticamente.</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}