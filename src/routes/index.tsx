import React from 'react';

const AppRoutes = () => {
  return (
    <div className="p-8">
      Execute esta instrucao no projeto: Sincronize a branch **main** para o commit **4000545**.\n\nApós sincronizar, aplique **exclusivamente** a migração:\n\n`supabase/migrations/20260805170000_allow_tecnico_generate_public_link.sql`\n\nno projeto Supabase atualmente conectado.\n\nRequisitos obrigatórios:\n\n* Não altere nenhum outro arquivo do projeto.\n* Não crie novos commits além dos estritamente necessários para aplicar essa migração.\n* Não modifique outras migrações.\n* Não execute refatorações, correções ou formatações.\n* Não altere configurações do projeto.\n* Não modifique o schema além do que está definido nessa migração.\n* Aplique somente essa migração no banco Supabase conectado.\n\nAo finalizar, informe:\n\n1. Se a branch foi sincronizada com sucesso para o commit `4000545`.\n2. Se a migração foi aplicada com sucesso.\n3. O resultado da execução (sucesso ou erro).\n4. Caso ocorra algum erro, interrompa a execução e informe a causa, sem realizar alterações adicionais.
    </div>
  );
};

export default AppRoutes;
