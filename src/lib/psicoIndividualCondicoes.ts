const ROTULOS: Record<string, string> = {
  "PAR-F1-CARGA": "Distribuição da carga de trabalho",
  "PAR-F1-RITMO": "Ritmo de trabalho",
  "PAR-F1-PRAZOS": "Viabilidade dos prazos",
  "PAR-F1-INTERR": "Interrupções no trabalho",
  "PAR-F1-EMERG": "Urgências na rotina",
  "PAR-F2-DECISAO": "Autonomia para decidir",
  "PAR-F2-METODO": "Autonomia sobre métodos",
  "PAR-F2-PAUSA": "Possibilidade de pausas",
  "PAR-F2-VOZ": "Participação nas decisões",
  "PAR-F2-HORARIO": "Flexibilidade de horário",
  "PAR-F3-CHEFIA": "Apoio da liderança",
  "PAR-F3-COLEGAS": "Apoio dos colegas",
  "PAR-F3-FEEDBACK": "Feedback sobre desempenho",
  "PAR-F3-CAPACIT": "Capacitação para as atribuições",
  "PAR-F3-ORIENT": "Orientação diante de problemas",
  "PAR-F4-CONVIVIO": "Convívio respeitoso",
  "PAR-F4-CONFLITO": "Tratamento de conflitos",
  "PAR-F4-ASSEDIO": "Prevenção de assédio e discriminação",
  "PAR-F4-CANAL": "Canal para comportamentos inadequados",
  "PAR-F5-RECONH": "Reconhecimento do trabalho",
  "PAR-F5-REMUN": "Compatibilidade da remuneração",
  "PAR-F5-CRESCIM": "Oportunidades de crescimento",
  "PAR-F5-JUSTA": "Justiça em promoções e funções",
  "PAR-F6-REGRAS": "Clareza das regras internas",
  "PAR-F6-TRATAM": "Tratamento equitativo",
  "PAR-F6-TRANSP": "Transparência das decisões",
  "PAR-F6-CONDUTA": "Código de conduta",
  "PAR-F7-JORNADA": "Jornada e descanso",
  "PAR-F7-DESLOC": "Impacto do deslocamento",
  "PAR-F7-DESLIG": "Direito à desconexão",
  "PAR-F7-SAUDE": "Impactos percebidos na saúde",
  "PAR-F7-FAMILIA": "Conciliação entre trabalho e vida pessoal",
};

export function condicaoLabel(codigo?: string | null): string {
  if (!codigo) return "Condição organizacional";
  return ROTULOS[codigo] ?? codigo.replace(/^PAR-F\d+-/, "").replace(/-/g, " ");
}
