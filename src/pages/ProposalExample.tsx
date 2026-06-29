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
    {
      id: "1", numero_item: 1, descricao_comercial: "Dosimetrias de Ruído", categoria: "Medições Ambientais",
      escopo_tecnico: "Realização de avaliações ocupacionais de exposição ao ruído, contemplando medições individuais, análise dos resultados e emissão de relatório técnico conforme metodologia aplicável.",
      entregaveis: "Relatório técnico de medição\nRegistro dos resultados\nRecomendações técnicas, quando aplicável",
      observacoes_escopo: "",
      quantidade_tecnica: "8 dosimetrias",
      quantidade: 8, valor_unitario: 0, valor_total: 0,
    },
    {
      id: "2", numero_item: 2, descricao_comercial: "Elaboração de PGR", categoria: "Documentos Técnicos",
      escopo_tecnico: "Elaboração do Programa de Gerenciamento de Riscos conforme NR-01, incluindo inventário de riscos e plano de ação.",
      entregaveis: "Documento PGR\nInventário de riscos\nPlano de ação",
      observacoes_escopo: "Validade de 24 meses a partir da emissão.",
      quantidade_tecnica: "1 unidade avaliada",
      quantidade: 1, valor_unitario: 0, valor_total: 0,
    },
  ];
  return (
    <div style={{ background: "#eef2f7", padding: 16, minHeight: "100vh" }}>
      <ProposalDocument proposal={proposal} client={client} items={items} revisions={[]} />
    </div>
  );
}