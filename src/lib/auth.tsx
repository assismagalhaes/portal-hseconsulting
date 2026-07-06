import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "comercial" | "tecnico" | "financeiro";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  isInternal: boolean;   // admin || comercial — CRM/propostas/precificação
  isAdmin: boolean;
  isComercial: boolean;
  isFinanceiro: boolean;
  isTecnico: boolean;    // técnico puro (sem admin/comercial/financeiro)
  canSeeComercial: boolean;   // admin || comercial
  canSeeFinanceiro: boolean;  // admin || financeiro
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, roles: [], loading: true,
  isInternal: false, isAdmin: false, isComercial: false, isFinanceiro: false, isTecnico: false,
  canSeeComercial: false, canSeeFinanceiro: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRoles(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data || []).map((r: any) => r.role as Role));
  }

  const isInternal = roles.includes("admin") || roles.includes("comercial");
  const isAdmin = roles.includes("admin");
  const isComercial = roles.includes("comercial");
  const isFinanceiro = roles.includes("financeiro");
  const isTecnico = roles.includes("tecnico") && !isInternal && !isFinanceiro;
  const canSeeComercial = isAdmin || isComercial;
  const canSeeFinanceiro = isAdmin || isFinanceiro;

  return (
    <Ctx.Provider value={{
      user, session, roles, loading,
      isInternal, isAdmin, isComercial, isFinanceiro, isTecnico,
      canSeeComercial, canSeeFinanceiro,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);