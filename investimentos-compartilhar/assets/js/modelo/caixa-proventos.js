/* Caixa de proventos: para onde vão os dividendos até serem reinvestidos.
 *
 * Por padrão ("direto") nada muda: cada provento pago volta ao bolso, como
 * sempre foi. Com destino "caixa", os proventos pagos ficam guardados num
 * lugar escolhido (porquinho/cofrinho do banco, saldo da corretora, conta
 * corrente…), rendendo ou não, até virarem compra. Uma compra pode usar
 * parte desse saldo (aportes.do_provento) e completar com dinheiro do
 * bolso: só o que passa do caixa é dinheiro novo — o mesmo desenho do
 * caixa do agro (FC.agro.caixa).
 *
 * FC.caixaProventos.analisa(base, pagamentos, cfg, ix, hoje) →
 *   { ativo, nome, saldo, saldoEm(d), entradas, saidas, porId, aplicado,
 *     rendimento, meta, falta, pronto, usadoNoMes(mes) }
 */
(function () {
  const FC = (window.FC = window.FC || {});
  const D = () => FC.datas;

  FC.PADRAO_PROVENTOS = {
    destino: "direto",       // "direto" (volta ao bolso) | "caixa" (guarda até reinvestir)
    tipo: "porquinho",       // chave de TIPOS_CAIXA
    nome: "",                // vazio: o nome do tipo
    indexador: "cdi",        // "cdi" | "selic" | "nenhum"
    taxa: 100,               // % do indexador
    meta: 500,               // saldo que dispara o aviso de reinvestir (0: sem aviso)
    inicio: null,            // a partir de quando os proventos vão para o caixa (vazio: todos)
    excecoes: {},            // { TICKER: true }: os proventos desse ativo vão direto
    saldo_informado: null,   // saldo real conferido no banco/corretora…
    saldo_informado_em: null, // …e a data dele
  };

  // pontos de partida da configuração: o nome e o rendimento típico de cada lugar
  const TIPOS = {
    porquinho: { nome: "Porquinho / cofrinho", indexador: "cdi", taxa: 100 },
    corretora: { nome: "Saldo na corretora", indexador: "nenhum", taxa: 0 },
    conta: { nome: "Conta corrente", indexador: "nenhum", taxa: 0 },
    outro: { nome: "Caixa de proventos", indexador: "cdi", taxa: 100 },
  };

  const num = (v) => (v == null || v === "" ? null : Number(v));
  const ativoCfg = (cfg) => !!cfg && cfg.destino === "caixa";
  const nomeDe = (cfg) => (cfg && String(cfg.nome || "").trim()) || (TIPOS[cfg && cfg.tipo] || TIPOS.outro).nome;

  // última análise de cada base (pela lista de aportes), para o Salário saber
  // quanto de uma compra veio do caixa sem refazer a conta
  const cache = new WeakMap();

  function vazio(cfg) {
    return { ativo: false, nome: nomeDe(cfg), saldo: 0, saldoEm: () => 0, entradas: [], saidas: [], porId: {},
      aplicado: 0, rendimento: 0, meta: 0, falta: 0, pronto: false, usadoNoMes: () => 0 };
  }

  // Os proventos que entram no caixa: os pagos calculados pela posição
  // (FC.dividendos.analisa) e os lançados à mão/por extrato que não batem
  // com nenhum deles (ex.: ativo sem dados da fonte). "fluxo" marca os que
  // a rentabilidade já conta como dinheiro que voltou ao bolso.
  function entradasDe(base, pagamentos, cfg) {
    const exc = cfg.excecoes || {};
    const inicio = cfg.inicio || "";
    const vale = (ticker, data) => !!data && data >= inicio && !exc[ticker];
    const pagos = (pagamentos || []).filter((p) => p.status === "pago" && p.valor > 0);
    const out = [];
    for (const p of pagos) {
      const data = p.pagamento || p.data_com;
      if (vale(p.ticker, data)) out.push({ data, ticker: p.ticker, valor: p.valor, origem: p.origem, fluxo: true });
    }
    const origens = new Set(pagos.map((p) => p.origem));
    for (const a of base.aportes) {
      if (a.tipo !== "provento" || !(a.valor > 0)) continue;
      if (a.origem && origens.has(a.origem)) continue;
      if (pagos.some((p) => p.ticker === a.ticker && p.pagamento === a.data && Math.abs(p.valor - a.valor) <= 0.05)) continue;
      if (vale(a.ticker, a.data)) out.push({ data: a.data, ticker: a.ticker, valor: a.valor, origem: a.origem || a.id, fluxo: false });
    }
    return out;
  }

  function analisa(base, pagamentos, cfg, ix, hoje = D().hoje()) {
    if (!ativoCfg(cfg) || !base) { const v = vazio(cfg); if (base) cache.set(base.aportes, v); return v; }
    const indexador = cfg.indexador === "selic" ? "selic" : cfg.indexador === "nenhum" ? null : "cdi";
    const taxa = Number(cfg.taxa) || 0;
    // sem rendimento, o fator é 1: valorTituloEm sem índices
    const ixUsado = indexador && taxa > 0 ? ix : null;
    const lotes = [];
    const informado = num(cfg.saldo_informado);
    if (informado != null && Number.isFinite(informado) && informado >= 0) {
      lotes.manual = { valor: informado, data: cfg.saldo_informado_em || hoje };
    }
    const valorEm = (d) => Math.max(0, FC.rentab.valorTituloEm(lotes, ixUsado, d));

    const entradas = entradasDe(base, pagamentos, cfg);
    const pedidos = base.aportes.filter((a) => !a.historico && (a.tipo === "ativo" || a.tipo === "caixa") && Number(a.do_provento) > 0);
    // no mesmo dia, o provento entra antes da compra que o usa
    const evs = [
      ...entradas.map((e) => ({ data: e.data, ordem: 0, e })),
      ...pedidos.map((a) => ({ data: a.data, ordem: 1, a })),
    ].sort((x, y) => x.data.localeCompare(y.data) || x.ordem - y.ordem || String((x.a || {}).criado_em || "").localeCompare(String((y.a || {}).criado_em || "")));

    const saidas = [], porId = {};
    for (const ev of evs) {
      const lote = { data: ev.data, indexador: indexador || "cdi", taxa };
      if (ev.e) { lotes.push({ ...lote, id: ev.e.origem, origem: "provento", valor: ev.e.valor }); continue; }
      const a = ev.a;
      // não dá para tirar do caixa mais do que ele tem: o resto é dinheiro novo
      const pedido = Math.min(Number(a.do_provento), Math.abs(Number(a.valor) || 0));
      const usado = Math.min(pedido, valorEm(ev.data));
      if (usado > 0) lotes.push({ ...lote, id: a.id, origem: "reinvestimento", valor: -usado });
      const s = { id: a.id, data: a.data, tipo: a.tipo, ticker: a.ticker, titulo: a.titulo, valor: Number(a.valor) || 0, pedido, usado,
        novo: Math.max(0, (Number(a.valor) || 0) - usado) };
      saidas.push(s);
      if (a.id != null) porId[a.id] = s;
    }

    const saldo = valorEm(hoje);
    const aplicado = FC.soma(entradas, (e) => e.valor) - FC.soma(saidas, (s) => s.usado);
    const meta = Number(cfg.meta) || 0;
    const r = {
      ativo: true, nome: nomeDe(cfg), tipo: cfg.tipo, indexador, taxa,
      saldo, saldoEm: valorEm, entradas, saidas, porId, aplicado, rendimento: saldo - aplicado,
      meta, falta: meta > 0 ? Math.max(0, meta - saldo) : 0, pronto: meta > 0 && saldo >= meta - 0.005,
      usadoNoMes: (mes) => FC.soma(saidas.filter((s) => s.data.slice(0, 7) === mes), (s) => s.usado),
    };
    cache.set(base.aportes, r);
    return r;
  }

  // quanto de um aporte saiu do caixa de proventos (0 sem caixa ligado)
  function usado(base, aporte) {
    const r = base && cache.get(base.aportes);
    if (r) return r.ativo && aporte.id != null && r.porId[aporte.id] ? r.porId[aporte.id].usado : 0;
    return 0;
  }

  FC.caixaProventos = { analisa, usado, nome: nomeDe, ativo: ativoCfg, TIPOS };
})();
