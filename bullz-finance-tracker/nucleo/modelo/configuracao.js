/* Onboarding que configura de verdade (Marco 14) e o checklist "Complete a
 * configuração".
 *
 * Nove passos, cada um grava a configuração real e pode ser pulado e
 * retomado. O progresso fica em onboarding_estado (passo atual, feitos,
 * pulados, dispensados); sem a tabela no banco, no armazenamento local.
 *
 * Conta nova (sem ativos, títulos, lançamentos nem ganhos) passa pelo
 * onboarding. Conta que já existia não passa: vê só o checklist com as
 * funcionalidades novas (potes, hierarquia, plano mensal, agro por lote,
 * alertas). Um item do checklist conta como feito pelo DADO (ex.: os potes
 * existem), não só pela marca do passo. */
(function () {
  const FC = window.FC;

  const PASSOS = [
    { id: "boas_vindas", titulo: "Boas-vindas", resumo: "O tour de 40 segundos." },
    { id: "perfil", titulo: "Perfil", resumo: "Conservador, moderado ou arrojado, e o horizonte." },
    { id: "renda", titulo: "Renda", resumo: "Salário, PJ, aluguel: o que entra e quando." },
    { id: "reserva", titulo: "Custo de vida e reserva", resumo: "Quanto custa o seu mês e quantos meses guardar. Cria os potes." },
    { id: "divisao", titulo: "Como dividir", resumo: "Hierarquia RF › Ações › Cripto ou metas fixas." },
    { id: "contas", titulo: "Conectar contas", resumo: "Como trazer os extratos da B3, da Binance e dos bancos." },
    { id: "agro", titulo: "Agro", resumo: "Tem pecuária? Usa peso? Os custos estão no preço?" },
    { id: "plano", titulo: "Primeiro plano do mês", resumo: "O rascunho do mês, com a origem de cada número." },
    { id: "alertas", titulo: "Alertas", resumo: "Alerta de empate para as posições no prejuízo." },
  ];
  // o que a conta que já existia vê no checklist (as novidades)
  const NOVIDADES = ["reserva", "divisao", "plano", "agro", "alertas"];
  const ROTULO_NOVIDADE = { reserva: "Potes com finalidade", divisao: "Hierarquia RF › Ações › Cripto", plano: "Plano mensal", agro: "Agro por lote", alertas: "Alertas de empate" };

  function estadoVazio() { return { passo_atual: PASSOS[0].id, feitos: [], pulados: [], dispensados: [], concluido: false, existente: false }; }

  /** a conta é nova? (nenhum dado financeiro ainda) */
  function contaNova(base) {
    return !((base.ativos || []).length || (base.rendaFixa || []).length || (base.aportes || []).length || (base.ganhos || []).length);
  }

  /** o passo está feito pelo dado (independe da marca) */
  function feitoPeloDado(id, base, prefs) {
    const brutas = base.prefsBrutas || {};
    switch (id) {
      case "renda": return (base.ganhos || []).length > 0;
      case "reserva": return (base.potes || []).length > 0 && !!(((brutas.premissas || {}).objetivos || {}).custo_vida_mensal);
      case "divisao": return !!(brutas.hierarquia && brutas.hierarquia.modo_alocacao);
      case "plano": return (base.planosMensais || []).length > 0;
      case "agro": return !!(brutas.agro && (brutas.agro.usa_peso != null || brutas.agro.tem_pecuaria === false)) || (base.agroLotes || []).length > 0;
      case "alertas": return (base.alertasPreco || []).length > 0;
      case "perfil": return !!((brutas.premissas || {}).perfil_simples);
      default: return false;
    }
  }

  /** junta o estado salvo com o que os dados dizem */
  function normaliza(salvo, base) {
    const e = { ...estadoVazio(), ...(salvo || {}) };
    e.feitos = [...new Set(e.feitos || [])]; e.pulados = [...new Set(e.pulados || [])]; e.dispensados = [...new Set(e.dispensados || [])];
    if (!salvo) e.existente = !contaNova(base);
    return e;
  }

  /** precisa abrir o onboarding? só conta nova que ainda não terminou */
  function precisaOnboarding(estado) { return !estado.existente && !estado.concluido; }

  /** itens do checklist que ainda faltam (pulados ou novidades), cada um com o motivo */
  function checklist(estado, base, prefs) {
    const ids = estado.existente ? NOVIDADES : PASSOS.map((p) => p.id).filter((id) => estado.pulados.includes(id));
    const itens = ids.filter((id) => !estado.dispensados.includes(id) && !feitoPeloDado(id, base, prefs) && !(estado.existente ? false : estado.feitos.includes(id)))
      .map((id) => { const p = PASSOS.find((x) => x.id === id); return { id, titulo: estado.existente ? ROTULO_NOVIDADE[id] || p.titulo : p.titulo, resumo: p.resumo }; });
    return { itens, completo: !itens.length };
  }

  /** marca o passo (feito ou pulado) e anda para o próximo */
  function avanca(estado, id, como) {
    const e = { ...estado, feitos: [...estado.feitos], pulados: [...estado.pulados] };
    if (como === "feito") { if (!e.feitos.includes(id)) e.feitos.push(id); e.pulados = e.pulados.filter((x) => x !== id); }
    else if (!e.feitos.includes(id) && !e.pulados.includes(id)) e.pulados.push(id);
    const i = PASSOS.findIndex((p) => p.id === id);
    const prox = PASSOS[i + 1];
    if (prox) e.passo_atual = prox.id; else { e.passo_atual = id; e.concluido = true; }
    return e;
  }
  function dispensa(estado, id) { return { ...estado, dispensados: [...new Set([...(estado.dispensados || []), id])] }; }

  /** reserva sugerida no passo 4: maior com renda PJ (Marco 6) */
  function reservaSugerida(base, prefs) {
    const mes = FC.datas.hoje().slice(0, 7);
    const r = FC.hierarquia ? FC.hierarquia.reservaSugerida(base.ganhos || [], prefs, mes) : { meses_sugerido: 6 };
    return Math.max(6, r.meses_sugerido || 6);
  }

  // ---------------------------------------------------------------- persistência
  const CHAVE_LOCAL = "onboarding-estado";
  async function carrega(base) {
    let salvo = null;
    if (FC.db.temTabela && FC.db.temTabela("onboarding_estado") && FC.db.opcional) {
      try { const l = await FC.db.opcional("onboarding_estado"); salvo = l[0] || null; } catch (e) { console.error(e); }
    }
    if (!salvo && FC.local) salvo = FC.local.ler(CHAVE_LOCAL, null);
    return normaliza(salvo, base);
  }
  async function salva(estado) {
    const linha = { passo_atual: estado.passo_atual, feitos: estado.feitos, pulados: estado.pulados, dispensados: estado.dispensados, concluido: !!estado.concluido,
      existente: !!estado.existente, atualizado_em: new Date().toISOString() };
    if (FC.local) FC.local.gravar(CHAVE_LOCAL, linha);
    if (FC.db.temTabela && FC.db.temTabela("onboarding_estado")) {
      try { await FC.db.salvaOnboarding(linha); } catch (e) { console.error(e); }
    }
    return estado;
  }

  FC.configuracao = { PASSOS, NOVIDADES, estadoVazio, contaNova, feitoPeloDado, normaliza, precisaOnboarding, checklist, avanca, dispensa, reservaSugerida, carrega, salva };
})();
