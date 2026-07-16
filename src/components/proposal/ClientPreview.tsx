// Visão do cliente (preview lateral) do ProposalEditor.
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/format";
import logo from "@/assets/hse-logo-navy.png";

export default function ClientPreview({ proposal, client, items }: any) {
  const total = items.reduce((a: number, b: any) => a + Number(b.valor_total || 0), 0);
  return (
    <Card className="shadow-elegant print-page">
      <CardContent className="p-8 space-y-6">
        <header className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <img src={logo} className="h-14 w-14 rounded-md bg-secondary p-1.5" alt="HSE Consulting" />
            <div>
              <div className="font-display text-xl font-bold">HSE Consulting</div>
              <div className="text-xs text-muted-foreground">Saúde, Segurança e Meio Ambiente</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono">Proposta {proposal.numero}</div>
            <div className="text-muted-foreground">{new Date(proposal.created_at).toLocaleDateString("pt-BR")}</div>
            {proposal.validade && <div className="text-muted-foreground">Válida até {new Date(proposal.validade).toLocaleDateString("pt-BR")}</div>}
          </div>
        </header>

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-1">Cliente</h2>
          <div className="font-semibold">{client?.razao_social}</div>
          <div className="text-sm text-muted-foreground">
            {[client?.cnpj_cpf, client?.cidade && `${client.cidade}/${client.uf || ""}`, client?.solicitante && `Contato: ${client.solicitante}${client.cargo ? " (" + client.cargo + ")" : ""}`].filter(Boolean).join(" · ")}
          </div>
        </section>

        {proposal.escopo_geral && (
          <section>
            <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-1">Escopo</h2>
            <p className="text-sm whitespace-pre-line">{proposal.escopo_geral}</p>
          </section>
        )}

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Serviços propostos</h2>
          <ol className="space-y-3">
            {items.map((it: any) => (
              <li key={it.id} className="border border-border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{it.numero_item}. {it.descricao_comercial}</div>
                    {it.categoria && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.categoria}</div>}
                    <div className="text-xs text-muted-foreground">Qtd: {it.quantidade}</div>
                  </div>
                  <div className="font-mono text-right">
                    <div className="text-sm">{brl(it.valor_unitario)}</div>
                    <div className="font-semibold">{brl(it.valor_total)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex justify-end">
          <div className="bg-secondary text-secondary-foreground rounded-md px-6 py-4 text-right">
            <div className="text-xs uppercase tracking-wider opacity-80">Investimento total</div>
            <div className="font-display text-3xl font-bold text-primary">{brl(total)}</div>
          </div>
        </section>

        {(proposal.condicoes_pagamento || proposal.outras_condicoes || proposal.observacoes_comerciais) && (
          <section className="space-y-3 text-sm">
            {proposal.condicoes_pagamento && <div><div className="font-semibold mb-0.5">Condições de pagamento</div><p className="text-muted-foreground whitespace-pre-line">{proposal.condicoes_pagamento}</p></div>}
            {proposal.outras_condicoes && <div><div className="font-semibold mb-0.5">Outras condições</div><p className="text-muted-foreground whitespace-pre-line">{proposal.outras_condicoes}</p></div>}
            {proposal.observacoes_comerciais && <div><div className="font-semibold mb-0.5">Observações</div><p className="text-muted-foreground whitespace-pre-line">{proposal.observacoes_comerciais}</p></div>}
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground border-t border-border pt-4">
          HSE Consulting — Esta proposta é confidencial e dirigida exclusivamente ao destinatário.
        </footer>
      </CardContent>
    </Card>
  );
}