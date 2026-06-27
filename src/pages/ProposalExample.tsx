import ProposalDocument from "@/components/proposal/ProposalDocument";

export default function ProposalExample() {
  const proposal = {
    numero: "PROP-EXEMPLO-001",
    created_at: new Date().toISOString(),
    validade: null,
    desconto: 0,
    observacoes_comerciais: "",
    escopo_geral: "",
    condicoes_pagamento: "A combinar.",
    outras_condicoes: "",
  };
  const client = {
    razao_social: "Cliente Exemplo Ltda.",
    nome_fantasia: "Cliente Exemplo",
    cnpj_cpf: "",
    qtd_funcionarios: null,
    endereco: "",
    cidade: "",
    uf: "",
    solicitante: "",
    cargo: "",
    telefone: "",
    email: "",
  };
  const items = [
    { id: "1", numero_item: 1, descricao_comercial: "Serviço de exemplo", categoria: "Categoria", escopo_tecnico: "Descrição técnica do serviço prestado, com detalhamento das atividades, entregas e prazos previstos.", quantidade: 1, unidade: "un", valor_unitario: 0, valor_total: 0 },
    { id: "2", numero_item: 2, descricao_comercial: "Segundo serviço de exemplo", categoria: "Categoria", escopo_tecnico: "Descrição técnica do segundo serviço.", quantidade: 1, unidade: "un", valor_unitario: 0, valor_total: 0 },
  ];
  return (
    <div style={{ background: "#eef2f7", padding: 16, minHeight: "100vh" }}>
      <ProposalDocument proposal={proposal} client={client} items={items} revisions={[]} />
    </div>
  );
}