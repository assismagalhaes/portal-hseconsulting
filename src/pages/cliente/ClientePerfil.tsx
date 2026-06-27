import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useClienteAuth } from "@/lib/clienteAuth";
import { CLIENTE_PERFIL_LABEL } from "@/lib/cliente";

export default function ClientePerfil() {
  const { clienteUser, user } = useClienteAuth();
  return (
    <div>
      <PageHeader title="Meu Perfil" />
      <div className="p-6 max-w-xl">
        <Card><CardContent className="p-4 space-y-2 text-sm">
          <div><b>Nome:</b> {clienteUser?.nome}</div>
          <div><b>E-mail:</b> {clienteUser?.email || user?.email}</div>
          <div><b>Perfil:</b> {CLIENTE_PERFIL_LABEL[clienteUser?.perfil || ""] || clienteUser?.perfil}</div>
          <div className="text-xs text-muted-foreground pt-3">Para alterar seus dados, fale com a equipe HSE.</div>
        </CardContent></Card>
      </div>
    </div>
  );
}