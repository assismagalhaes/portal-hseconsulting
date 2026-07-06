import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  user_id: string | null;
  acao: string;
  detalhe: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { nome: string | null; email: string | null } | null;
};

const acaoLabel: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-success/15 text-success" },
  logout: { label: "Logout", color: "bg-muted text-muted-foreground" },
  usuario_criado: { label: "Usuário criado", color: "bg-primary/15 text-primary" },
  admin_reset_password: { label: "Reset de senha", color: "bg-primary/15 text-primary" },
  admin_resend_invite: { label: "Reenvio de convite", color: "bg-primary/15 text-primary" },
  admin_block: { label: "Usuário bloqueado", color: "bg-danger/15 text-danger" },
  admin_unblock: { label: "Usuário desbloqueado", color: "bg-success/15 text-success" },
  admin_delete: { label: "Usuário excluído", color: "bg-danger/15 text-danger" },
};

export default function UsuariosLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Trilha de acessos | Portal HSE Consulting";
    (async () => {
      const { data } = await supabase
        .from("internos_logs_acesso")
        .select("*, profiles:profiles!internos_logs_acesso_user_id_fkey(nome, email)")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as any) || []);
    })();
  }, []);

  const filtered = rows.filter((r) =>
    !q ||
    [r.acao, r.detalhe, r.profiles?.nome, r.profiles?.email].some((s) => (s || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        title="Trilha de acessos"
        subtitle="Últimos 500 eventos de login, logout e ações administrativas."
        actions={<Button asChild variant="outline"><Link to="/usuarios">← Usuários</Link></Button>}
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por usuário, ação, detalhe..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const meta = acaoLabel[r.acao] || { label: r.acao, color: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.profiles?.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.profiles?.email || ""}</div>
                    </TableCell>
                    <TableCell><Badge className={meta.color + " border-0"}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.detalhe || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum evento registrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}