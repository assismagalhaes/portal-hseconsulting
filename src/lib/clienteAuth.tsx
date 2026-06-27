import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ClienteUsuario = {
  id: string;
  client_id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
};

type ClienteCtx = {
  user: User | null;
  session: Session | null;
  clienteUser: ClienteUsuario | null;
  permissoes: Record<string, boolean>;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<ClienteCtx>({
  user: null, session: null, clienteUser: null, permissoes: {}, loading: true,
  signOut: async () => {},
});

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [clienteUser, setClienteUser] = useState<ClienteUsuario | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => fetchCliente(s.user.id), 0);
      else { setClienteUser(null); setPermissoes({}); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchCliente(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchCliente(uid: string) {
    const { data: cu } = await supabase
      .from("cliente_usuarios")
      .select("id, client_id, nome, email, perfil, status")
      .eq("auth_user_id", uid)
      .eq("status", "ativo")
      .maybeSingle();
    setClienteUser((cu as any) ?? null);
    if (cu) {
      const { data: p } = await supabase
        .from("cliente_permissoes").select("*").eq("cliente_usuario_id", (cu as any).id).maybeSingle();
      setPermissoes((p as any) ?? {});
    } else {
      setPermissoes({});
    }
  }

  return (
    <Ctx.Provider value={{ user, session, clienteUser, permissoes, loading,
      signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useClienteAuth = () => useContext(Ctx);