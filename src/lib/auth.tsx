import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "comercial" | "tecnico" | "financeiro";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  senhaProvisoria: boolean;
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
  senhaProvisoria: false,
  isInternal: false, isAdmin: false, isComercial: false, isFinanceiro: false, isTecnico: false,
  canSeeComercial: false, canSeeFinanceiro: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [senhaProvisoria, setSenhaProvisoria] = useState(false);

  useEffect(() => {
    let bootstrapped = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Only re-fetch on real sign-in/refresh, not on the initial event
        // (initial roles/profile are loaded once by getSession below).
        if (bootstrapped) setTimeout(() => bootstrap(s.user.id), 0);
        if (event === "SIGNED_IN") {
          setTimeout(() => {
            supabase.from("internos_logs_acesso").insert({
              user_id: s.user.id,
              acao: "login",
              detalhe: s.user.email || null,
              user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            }).then(() => {});
          }, 0);
        }
      } else {
        setRoles([]);
        setSenhaProvisoria(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await bootstrap(data.session.user.id);
      bootstrapped = true;
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function bootstrap(uid: string) {
    const [rolesRes, profRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("senha_provisoria").eq("id", uid).maybeSingle(),
    ]);
    setRoles((rolesRes.data || []).map((r: any) => r.role as Role));
    setSenhaProvisoria(!!(profRes.data as any)?.senha_provisoria);
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
      user, session, roles, loading, senhaProvisoria,
      isInternal, isAdmin, isComercial, isFinanceiro, isTecnico,
      canSeeComercial, canSeeFinanceiro,
      signOut: async () => {
        if (user) {
          await supabase.from("internos_logs_acesso").insert({
            user_id: user.id, acao: "logout", detalhe: user.email || null,
          });
        }
        await supabase.auth.signOut();
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);