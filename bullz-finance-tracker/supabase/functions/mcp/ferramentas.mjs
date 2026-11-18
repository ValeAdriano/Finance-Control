/* As ferramentas do MCP do Bullz: o que uma IA pode consultar e editar.
 *
 * Cada ferramenta é um objeto { nome, titulo, descricao, entrada(z), escreve,
 * destrutiva, executa(ctx, args) }. `ctx.FC` é um núcleo NOVO, criado para
 * esta chamada (supabase/functions/mcp/nucleo.gen.mjs) com o cliente do
 * Supabase que carrega o token do usuário: toda leitura e toda gravação
 * passam pela RLS, e o cálculo é o mesmo do app (FC.base.carrega).
 *
 * Sem imports de plataforma: o `z` (zod) vem de quem chama, para o mesmo
 * arquivo rodar na Edge Function (Deno) e nos testes (Node). */
import { CLASSES, PILARES, LISTAS, TIPOS_RF, INDEXADORES, CATEGORIAS_GANHO, TIPOS_GANHO, REGRAS_DIA, TIPOS_MOV, REGIMES_PJ, CATEGORIAS_DESPESA,
  CATEGORIAS_GADO, CATEGORIAS_CUSTO, TABELAS, pecas, camposPorTabela } from "./esquemas.mjs";

/** erro que vai para a IA como texto, sem pilha */
export class ErroMcp extends Error {}

const PILAR_PADRAO = { acao_br: "acoes", acao_us: "acoes", fii: "real_estate", etf_br: "alternativos", etf_us: "alternativos", cripto: "alternativos" };
const SO_CONSULTA = "Esta conexão está autorizada só para consulta. Para permitir edições, abra o Bullz em Ajustes → Segurança → Conexões com IA.";

// ---------------------------------------------------------------- números
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const n2 = (v) => (fin(v) ? Math.round(v * 100) / 100 : null);
const n8 = (v) => (fin(v) ? Math.round(v * 1e8) / 1e8 : null);
// preço: centavos para o que vale reais, mais casas para o que vale frações
const np = (v) => (!fin(v) ? null : Math.abs(v) >= 1 ? n2(v) : n8(v));

/** arredonda em profundidade (2 casas; quantidades com 8) e corta listas longas */
function enxuga(o, max = 60) {
  if (Array.isArray(o)) return o.slice(0, max).map((x) => enxuga(x, max));
  if (o && typeof o === "object") {
    const s = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "function" || v === undefined) continue;
      s[k] = typeof v === "number" ? (/^(q|q_rest|quantidade|cabecas)$/.test(k) ? n8(v) : /preco|por_acao/.test(k) ? np(v) : n2(v)) : enxuga(v, max);
    }
    return s;
  }
  return o;
}

// ---------------------------------------------------------------- carga
async function carrega(ctx, opcoes) {
  const e = await ctx.FC.base.carrega(opcoes);
  return e;
}
const avisoMercado = (e) => (e.erroMercado ? { aviso: "Cotações indisponíveis agora (" + e.erroMercado + "): valores de bolsa e cripto podem estar faltando." } : {});

function tipoLancamento(a) {
  if (a.tipo === "provento") return "provento";
  if (a.tipo === "caixa") return a.valor < 0 ? "resgate_renda_fixa" : "aporte_renda_fixa";
  return a.venda || a.quantidade < 0 ? "venda" : "compra";
}
const lancamento = (a) => ({ id: a.id, data: a.data, tipo: tipoLancamento(a), ticker: a.ticker || null, titulo: a.titulo || null,
  quantidade: n8(a.quantidade), preco: np(a.preco), valor: n2(a.valor), observacao: a.observacao || "", importado_de_extrato: !!a.origem });

function posicao(a) {
  const p = a.posicao;
  return { id: a.id, ticker: a.ticker, classe: a.classe, pilar: a.pilar, lista: a.lista, preco: np(a.preco), variacao_dia_pct: n2(a.variacao_dia),
    quantidade: p ? n8(p.quantidade) : 0, preco_medio: p ? np(p.preco_medio) : null, custo: p ? n2(p.custo) : null, valor: p ? n2(p.atual) : 0,
    resultado: p ? n2(p.resultado) : null, resultado_pct: p ? n2(p.variacao) : null,
    nota: n2(a.score), leitura: a.veredito || null, ...(a.erro ? { erro: a.erro } : {}),
    // preço de empate (Marco 9): o preço médio; quanto falta subir para chegar nele
    preco_empate: p && p.preco_medio > 0 ? np(p.preco_medio) : null,
    alta_necessaria_pct: p && p.preco_medio > 0 && a.preco > 0 ? n2(a.preco < p.preco_medio ? (p.preco_medio / a.preco - 1) * 100 : 0) : null,
    ...(p && p.custo_estimado ? { custo_estimado: true } : {}), ...(a.cotacao_quebrada ? { cotacao_quebrada: true, nota_sem_cotacao: n2(a.score_bruto) } : {}) };
}
const rent = (r) => r && ({ aplicado: n2(r.aplicado), devolvido: n2(r.devolvido), valor_atual: n2(r.valor_atual), ganho: n2(r.ganho),
  retorno_pct: n2(r.periodo_pct), tir_anual_pct: n2(r.xirr), desde: r.desde || null, dias: r.dias ?? null,
  ...(r.periodo_motivo ? { retorno_motivo: r.periodo_motivo } : {}) });

const entre = (d, de, ate) => (!de || d >= de) && (!ate || d <= ate);

// ---------------------------------------------------------------- potes
const pote = (p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, saldo: n2(p.saldo), meta: n2(p.meta_valor), falta_para_meta: n2(p.falta_para_meta),
  em_titulos: n2(p.valor_titulos), fora_de_titulos: n2(p.valor_movimentos), proventos: n2(p.valor_proventos),
  titulos: (p.titulos || []).map((t) => ({ id: t.id, nome: t.nome, valor: n2(t.valor) })), ...(p.comprometido ? { comprometido: true } : {}) });
const resumoPotes = (pts) => pts && ({ total: n2(pts.total), comprometido_com_ir: n2(pts.comprometido),
  reserva: { saldo: n2(pts.reserva.saldo), meta: n2(pts.reserva.meta), meses_cobertos: n2(pts.reserva.meses_cobertos), abaixo_da_meta: pts.reserva.abaixo_da_meta },
  potes: pts.potes.map(pote) });
const MIGRATION = (n, t) => `A tabela ${t} ainda não existe no banco desta conta: aplique a migration ${n} (supabase/migrations/) e tente de novo.`;

// ---------------------------------------------------------------- movimento interno
const TIPOS_PONTA = ["ativo", "titulo_rf", "pote", "agro_lote"];
const efeitoMov = (ef) => ({
  origem: ef.origem, destino: ef.destino, bruto: n2(ef.bruto), custos: n2(ef.custos), liquido: n2(ef.liquido),
  preco_medio_da_baixa: np(ef.preco_medio_da_baixa), resultado_realizado: n2(ef.resultado_realizado),
  patrimonio_antes: n2(ef.patrimonio_antes), patrimonio_depois: n2(ef.patrimonio_depois),
  alocacao_antes_pct: enxuga(ef.alocacao_antes_pct), alocacao_depois_pct: enxuga(ef.alocacao_depois_pct),
  ordem_rf_acoes_cripto: { respeitada_antes: ef.ordem.respeitada_antes, respeitada_depois: ef.ordem.respeitada_depois, efeito: ef.ordem.efeito,
    antes: enxuga(ef.ordem.antes), depois: enxuga(ef.ordem.depois) },
  como_ler: "Não é aporte nem resgate: o Salário e a TIR total ignoram. A origem realiza resultado pelo preço médio; o destino entra com custo = líquido.",
});
function entradaMov(z, { data, positivo, naoNegativo, texto }) {
  return {
    data: data.optional().describe("AAAA-MM-DD (padrão: hoje)"),
    origem_tipo: z.enum(TIPOS_PONTA), origem_id: texto(80).min(1).describe("ativo: ticker · titulo_rf: nome ou id · pote: tipo, nome ou id"),
    origem_quantidade: positivo.describe("ativo: cotas · titulo_rf e pote: valor em reais"), origem_preco: positivo.optional().describe("ativo: preço da venda (padrão: o de agora)"),
    destino_tipo: z.enum(["ativo", "titulo_rf", "pote"]), destino_id: texto(80).min(1),
    destino_quantidade: positivo.optional().describe("ativo: cotas compradas"), destino_preco: positivo.optional().describe("ativo: preço da compra"),
    destino_classe: z.enum(CLASSES).optional().describe("só para ativo de destino ainda não cadastrado"),
    custos: z.object({ taxa: naoNegativo.optional(), spread: naoNegativo.optional(), saque: naoNegativo.optional(), impostos: naoNegativo.optional() }).strict().optional(),
    observacao: texto(160).optional(),
    parcelamento_id: z.string().uuid().optional().describe("executa a parcela pendente deste parcelamento (salario_e_plano.parcelas_pendentes)"),
  };
}
function planejaMov(FC, e, a) {
  try { return FC.movimentos.planeja(e, a); } catch (x) { throw new ErroMcp(x.message); }
}

// ---------------------------------------------------------------- hierarquia
const divisao = (x) => x && { rf: n2(x.rf), acoes: n2(x.acoes), cripto: n2(x.cripto) };
function hierarquiaResumo(FC, e) {
  try {
    const h = FC.hierarquia.analisa(e);
    return {
      modo_alocacao: h.modo, ordem_respeitada: h.ordem_respeitada, meses_para_corrigir: h.meses_para_corrigir,
      divisao_sugerida_aporte: { ...divisao(h.divisao_sugerida_aporte), motivo: h.divisao_sugerida_aporte.motivo },
      hierarquia: { carteira_pct: divisao(h.carteira.pct), faixas: h.faixas, aporte_mensal: n2(h.aporte_mensal),
        plano: h.plano ? { divisao: divisao(h.plano.divisao), valido: h.plano.ok, violacoes: h.plano.violacoes.map((v) => v.texto), divisao_valida_mais_proxima: divisao(h.plano.mais_proxima) } : null,
        reserva: h.reserva },
    };
  } catch (x) { console.error(x); return {}; }
}

// ---------------------------------------------------------------- projeção mensal
const TIPOS_EVENTO = ["venda_agro", "mudanca_renda", "aporte_extra", "resgate"];
function entradaEvento(z, { data, naoNegativo, texto }) {
  return { data, tipo: z.enum(TIPOS_EVENTO),
    valor: naoNegativo.optional().describe("venda_agro, aporte_extra, resgate: o valor"), destino: texto(80).optional().describe("ticker, rf:<título> ou caixa (padrão: a divisão do plano)"),
    cabecas: z.number().int().positive().optional().describe("venda_agro: cabeças vendidas"), aporte_mensal: naoNegativo.optional().describe("mudanca_renda: o aporte mensal a partir da data"),
    descricao: texto(160).optional() };
}
const eventoDe = (a) => ({ data: a.data, tipo: a.tipo, descricao: a.descricao || "",
  parametros: Object.fromEntries(["valor", "destino", "cabecas", "aporte_mensal"].filter((k) => a[k] != null).map((k) => [k, a[k]])) });

// ---------------------------------------------------------------- plano mensal
const MES = (z) => z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mês no formato AAAA-MM");
const planoDoMesSalvo = (e, mes) => (e.base.planosMensais || []).find((p) => p.mes === mes) || null;
function resumoPlanoMensal(FC, e, p, detalhe = false) {
  const i = FC.planoMensal.indicadores(p, e);
  const r = { id: p.id || null, mes: p.mes, status: p.status, origem: p.origem, meta: n2(i.meta), aportado: n2(i.aportado), pct_executado: n2(i.pct_executado),
    renda_prevista: n2(i.renda_prevista), renda_real: n2(i.renda_real), sobra_prevista: n2(i.sobra_prevista), sobra_real: n2(i.sobra_real),
    fora_do_plano: n2(i.fora_do_plano), hierarquia_respeitada: i.hierarquia_respeitada,
    selos: [i.cem_por_cento ? "100% executado" : null, i.fora_do_plano > 0.5 ? `R$ ${n2(i.fora_do_plano)} fora do plano` : null,
      i.hierarquia_respeitada === true ? "hierarquia respeitada" : i.hierarquia_respeitada === false ? "hierarquia violada" : null].filter(Boolean) };
  if (!detalhe) return r;
  return { ...r, modo: p.modo, valor_fixo: n2(p.valor_fixo), impostos_previstos: n2(p.impostos_previstos), despesas_previstas: n2(p.despesas_previstas),
    renda_detalhe: enxuga(p.renda_prevista || []),
    destinos: (p.destinos || []).map((d, idx) => { const x = i.execucao.find((y) => y.idx === idx) || {}; return { idx, tipo: d.tipo, alvo: d.alvo, pct: n2(d.pct), previsto: n2(d.valor),
      aportado: n2(x.aportado), desvio: n2(x.desvio), ...(d.sugestao ? { sugestao: d.sugestao } : {}), aportes: enxuga(x.aportes || []) }; }),
    fora_do_plano_itens: enxuga(i.fora), contexto: enxuga(p.contexto || {}), regras_snapshot: enxuga(p.regras_snapshot || null, 100),
    log: enxuga((e.base.planosLog || []).filter((l) => l.plano_id === p.id)) };
}
const entradaDestino = (z, texto) => z.object({ tipo: z.enum(["categoria", "ativo", "titulo_rf", "pote", "parcela"]), alvo: texto(80).min(1),
  pct: z.number().min(0).max(100).nullable().optional(), valor: z.number().min(0) }).strict();
async function salvaPlano(ctx, linha, id) {
  const { FC } = ctx;
  if (!FC.db.temTabela("planos_mensais")) throw new ErroMcp(MIGRATION("0008", "planos_mensais"));
  const { user_id, criado_em, idx, ...l } = linha;
  return id ? grava(() => FC.db.atualizar("planos_mensais", id, l)) : grava(() => FC.db.inserir("planos_mensais", l));
}
async function logPlano(ctx, plano_id, acao, motivo, detalhe = {}) {
  try { await ctx.FC.db.inserir("planos_mensais_log", { plano_id, acao, motivo: motivo || "", quem: ctx.acesso.nome || "assistente", detalhe }); } catch (x) { console.error(x); }
}

// cria os potes padrão de quem ainda não tem nenhum (conta nova)
async function garantePotes(ctx, e) {
  const { FC } = ctx;
  if (e.base.potes && e.base.potes.length) return false;
  if (!FC.db.temTabela("potes")) throw new ErroMcp(MIGRATION("0002", "potes"));
  for (const p of FC.potes.padroes()) await grava(() => FC.db.inserir("potes", p));
  return true;
}

// ---------------------------------------------------------------- gravação
function traduz(erro) {
  const m = (erro && erro.message) || String(erro);
  if ((erro && erro.code === "42501") || /row-level security/i.test(m)) return new ErroMcp(SO_CONSULTA);
  if (erro && (erro.code === "PGRST205" || erro.code === "42P01")) return new ErroMcp("Tabela ausente no banco: aplique as migrations pendentes (supabase/migrations/). " + m);
  if (erro && erro.code === "PGRST116") return new ErroMcp("Registro não encontrado. Confira o id com uma ferramenta de listagem.");
  if (erro && erro.code === "23505") return new ErroMcp("Já existe um registro com essa chave (ticker ou nome repetido).");
  if (erro && (erro.code === "23514" || erro.code === "22P02")) return new ErroMcp("O banco recusou os valores: " + m);
  return erro instanceof ErroMcp ? erro : new ErroMcp(m);
}
async function grava(f) { try { return await f(); } catch (e) { throw traduz(e); } }

function exigeEscrita(ctx) { if (!ctx.acesso.escrita) throw new ErroMcp(SO_CONSULTA); }

// cada gravação fica no Log do sistema do app (Ajustes), com quem a fez
async function audita(ctx, evento, detalhe) {
  try {
    await ctx.FC.sb.from("log_sistema").insert({ user_id: ctx.usuario.id, origem: "mcp", evento,
      detalhe: { ...detalhe, cliente: ctx.acesso.nome || ctx.acesso.cliente || "cliente de IA" } });
  } catch (e) { console.error("auditoria do MCP falhou:", e); }
}

function valida(z, forma, valores, parcial = false) {
  let obj = z.object(forma).strict();
  if (parcial) obj = obj.partial();
  const r = obj.safeParse(valores);
  if (r.success) return r.data;
  throw new ErroMcp("Campos inválidos: " + r.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; "));
}

// ================================================================= ferramentas
export function ferramentas(z) {
  const { data, positivo, naoNegativo, ticker, texto } = pecas(z);
  const campos = camposPorTabela(z);
  const dataOpc = data.optional();
  const limite = z.number().int().min(1).max(200).default(50).describe("quantos itens por página (até 200)");
  const pagina = z.number().int().min(1).default(1);

  const LEITURA = [
    {
      nome: "resumo_patrimonio",
      titulo: "Resumo do patrimônio",
      descricao: "Patrimônio total em reais, quanto há em cada classe (bolsa, cripto, renda fixa, agro), alocação por pilar contra a meta, rentabilidade desde o início e os alertas da carteira. Comece por aqui para qualquer pergunta geral sobre os investimentos.",
      entrada: () => ({}),
      async executa(ctx) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const d = e.dados, r = d.resumo;
        let alertas = [];
        try { alertas = FC.alertas.calcula(d, e.base, e.prefs).map((a) => ({ nivel: a.nivel, titulo: a.titulo, texto: a.texto })); } catch (x) { console.error(x); }
        return {
          patrimonio: n2(r.patrimonio), variacao_hoje: n2(r.variacao_hoje),
          por_classe: { bolsa: n2(r.bolsa), cripto: n2(r.cripto), renda_fixa: n2(r.renda_fixa), agro: n2(r.agro), caixa_de_proventos: n2(r.caixa_proventos) },
          // custo, valor e resultado sobre o MESMO conjunto (posições com custo conhecido);
          // valor_total inclui as sem custo, listadas em sem_custo
          bolsa_e_cripto: { custo: n2(r.investido), valor: n2(r.atual_com_custo ?? r.atual), resultado: n2(r.resultado), resultado_pct: n2(r.variacao),
            valor_total: n2(r.atual), sem_custo: r.sem_custo || [], cotacao_quebrada: r.cotacao_quebrada || [] },
          alocacao: d.alocacao.map((l) => ({ pilar: l.chave, nome: l.nome, valor: n2(l.valor), pct_do_patrimonio: n2(l.pct), meta_pct: n2(l.alvo_pct),
            pct_na_base_da_meta: n2(l.pct_meta), desvio_pct: n2(l.desvio_pct), falta_para_a_meta: n2(l.desvio_reais), fora_da_meta: !!l.fora_meta })),
          rentabilidade_desde_o_inicio: d.rentab ? rent(d.rentab.total) : null,
          potes: resumoPotes(d.potes),
          ...hierarquiaResumo(FC, e),
          alertas, cotacoes_de: d.atualizado, ...avisoMercado(e),
        };
      },
    },
    {
      nome: "listar_posicoes",
      titulo: "Posições em bolsa e cripto",
      descricao: "Ações, FIIs, ETFs e criptomoedas: quantidade, preço médio, preço de agora, valor, resultado e a nota do ativo pelos critérios do dono. Use `lista: \"watchlist\"` para o que está só em observação.",
      entrada: () => ({
        classe: z.enum(CLASSES).optional().describe("filtra por classe"),
        lista: z.enum(["carteira", "watchlist", "todas"]).default("carteira"),
      }),
      async executa(ctx, { classe, lista }) {
        const e = await carrega(ctx, { comMercado: true });
        const itens = e.dados.ativos
          .filter((a) => !classe || a.classe === classe)
          .filter((a) => lista === "todas" || (lista === "carteira" ? a.na_carteira : !a.na_carteira))
          .map(posicao).sort((a, b) => b.valor - a.valor);
        return { total: itens.length, valor_total: n2(itens.reduce((s, x) => s + (x.valor || 0), 0)), posicoes: itens, ...avisoMercado(e) };
      },
    },
    {
      nome: "detalhar_ativo",
      titulo: "Detalhe de um ativo",
      descricao: "Tudo sobre um ticker da carteira ou da watchlist: posição, lotes de compra, vendas realizadas, rentabilidade com proventos, indicadores com nota, proventos recebidos e a receber, e os últimos lançamentos.",
      entrada: () => ({ ticker }),
      async executa(ctx, args) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const a = e.dados.ativos.find((x) => x.ticker === args.ticker);
        if (!a) throw new ErroMcp(`${args.ticker} não está cadastrado. Use listar_posicoes com lista "todas" para ver os códigos.`);
        const r = ((e.dados.rentab || {}).ativos || []).find((x) => x.ticker === a.ticker);
        let prov = null;
        try {
          const dv = FC.dividendos.analisa(e.dados, e.base, e.proventos || {});
          const meu = (dv.porAtivo || []).find((x) => x.ticker === a.ticker);
          const pg = (dv.pagamentos || []).filter((x) => x.ticker === a.ticker);
          const linha = (x) => ({ tipo: x.tipo, data_com: x.data_com, pagamento: x.pagamento, por_cota: np(x.valor_por_acao), quantidade: n8(x.quantidade), valor: n2(x.valor), status: x.status });
          prov = meu && { recebido_12m: n2(meu.recebido_12m), mensal_estimado: n2(meu.mensal_estimado), dy_12m_pct: n2(meu.dy_12m), yield_sobre_o_custo_pct: n2(meu.yoc), frequencia: meu.frequencia,
            a_receber: pg.filter((x) => x.status !== "pago").map(linha), ultimos_pagos: pg.filter((x) => x.status === "pago").slice(-12).reverse().map(linha) };
        } catch (x) { console.error(x); }
        return {
          ...posicao(a), tipo: a.tipo_rotulo, segmento: a.segmento || null, maxima_52_semanas: np(a.max_52s), minima_52_semanas: np(a.min_52s),
          indicadores: (a.metricas || []).map((m) => ({ indicador: m.rotulo, valor: n2(m.valor), nota: n2(m.nota) })),
          avisos: (a.avisos || []).map((x) => (typeof x === "string" ? x : x.texto || x.titulo)).filter(Boolean),
          rentabilidade: r ? { ...rent(r), proventos_recebidos: n2(r.proventos) } : null,
          lotes: r ? enxuga(r.lotes, 40) : [], vendas_realizadas: r ? enxuga(r.realizados, 40) : [],
          proventos: prov,
          ultimos_lancamentos: e.base.aportes.filter((x) => x.ticker === a.ticker).sort((x, y) => y.data.localeCompare(x.data)).slice(0, 20).map(lancamento),
          ...avisoMercado(e),
        };
      },
    },
    {
      nome: "listar_lancamentos",
      titulo: "Lançamentos (aportes, vendas, proventos)",
      descricao: "Histórico de compras, vendas, proventos recebidos e movimentos de renda fixa, do mais recente para o mais antigo. Cada item traz o `id` usado por editar_registro e apagar_registro (tabela \"aportes\").",
      entrada: () => ({
        de: dataOpc, ate: dataOpc, ticker: ticker.optional(), titulo: texto(80).optional().describe("nome do título de renda fixa"),
        tipo: z.enum(["compra", "venda", "provento", "aporte_renda_fixa", "resgate_renda_fixa"]).optional(), limite, pagina,
      }),
      async executa(ctx, f) {
        const e = await carrega(ctx, { comMercado: false });
        const todos = e.base.aportes.filter((a) => entre(a.data, f.de, f.ate) && (!f.ticker || a.ticker === f.ticker)
          && (!f.titulo || (a.titulo || "").toLowerCase() === f.titulo.toLowerCase()) && (!f.tipo || tipoLancamento(a) === f.tipo))
          .sort((a, b) => b.data.localeCompare(a.data));
        const ini = (f.pagina - 1) * f.limite;
        return { total: todos.length, pagina: f.pagina, paginas: Math.max(1, Math.ceil(todos.length / f.limite)),
          soma_dos_valores: n2(todos.reduce((s, a) => s + (Number(a.valor) || 0), 0)), lancamentos: todos.slice(ini, ini + f.limite).map(lancamento) };
      },
    },
    {
      nome: "listar_renda_fixa",
      titulo: "Títulos de renda fixa",
      descricao: "CDBs, LCIs, Tesouro e afins: taxa, vencimento, quanto foi aplicado, saldo de hoje com o rendimento acumulado e o imposto estimado no resgate.",
      entrada: () => ({}),
      async executa(ctx) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true });
        const meta = ((e.base.prefsBrutas || {}).premissas || {}).titulos || {};
        const titulos = e.dados.rendaFixa.map((r) => {
          let ir = null;
          try { ir = FC.impostos.titulo(r, meta[r.id] || {}); } catch (x) { console.error(x); }
          const t = r.rent || {};
          return { id: r.id, nome: r.nome, tipo: r.tipo, taxa: n2(r.taxa), rende: r.base || null, vencimento: r.vencimento || null, pilar: r.pilar,
            aplicado: n2(t.aplicado), saldo_hoje: n2(r.valor_aplicado), rendimento: n2(t.ganho), retorno_pct: n2(t.periodo_pct), tir_anual_pct: n2(t.xirr),
            desde: t.desde || null, isento_de_ir: ir ? !!ir.isento : null, ir_estimado: ir ? n2(ir.ir + (ir.iof || 0)) : null, liquido_estimado: ir ? n2(ir.liquido) : null,
            ...(t.estimado || t.sem_indices ? { observacao: "saldo estimado pela taxa anual (série diária do índice indisponível)" } : {}) };
        });
        return { total: titulos.length, saldo_total: n2(e.dados.resumo.renda_fixa), titulos, ...avisoMercado(e) };
      },
    },
    {
      nome: "rentabilidade",
      titulo: "Rentabilidade da carteira",
      descricao: "Quanto a carteira rendeu desde o primeiro lançamento: aplicado, devolvido (vendas e proventos), valor de hoje, ganho, retorno no período e TIR ao ano. No total, por classe, por ativo e por título de renda fixa.",
      entrada: () => ({}),
      async executa(ctx) {
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const r = e.dados.rentab;
        if (!r) throw new ErroMcp("Não foi possível calcular a rentabilidade agora.");
        return {
          total: rent(r.total),
          por_classe: Object.fromEntries(Object.entries(r.classes || {}).map(([k, v]) => [k, rent(v)])),
          por_ativo: (r.ativos || []).map((a) => ({ ticker: a.ticker, classe: a.classe, ...rent(a), proventos_recebidos: n2(a.proventos) })),
          por_titulo: (r.titulos || []).map((t) => ({ nome: t.nome, ...rent(t) })),
          sem_preco_medio: r.sem_custo || [], sem_cotacao: r.sem_preco || [],
          como_ler: "retorno_pct é o ganho sobre o capital médio aplicado no período (Modified Dietz); tir_anual_pct é a taxa interna de retorno ao ano. Renda fixa em valores brutos, antes de IR.",
          ...avisoMercado(e),
        };
      },
    },
    {
      nome: "dividendos",
      titulo: "Dividendos e proventos",
      descricao: "Proventos da carteira: recebido nos últimos 12 meses e no ano, média mensal estimada, yield, o que cada ativo paga, o total por mês e os pagamentos já anunciados a receber.",
      entrada: () => ({ ano: z.number().int().min(2000).max(2100).optional().describe("ano dos totais por mês (padrão: o atual)") }),
      async executa(ctx, { ano }) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const dv = FC.dividendos.analisa(e.dados, e.base, e.proventos || {});
        const a = String(ano || FC.datas.hoje().slice(0, 4));
        const rs = dv.resumo || {};
        return {
          resumo: { recebido_12m: n2(rs.recebido_12m), recebido_no_ano: n2(rs.no_ano), mensal_estimado: n2(rs.mensal_estimado), a_receber_30_dias: n2(rs.proximos_30d),
            yield_da_carteira_pct: n2(rs.dy_carteira), ativos_que_pagam: rs.n_pagadores ?? null },
          por_mes: (dv.serie || []).filter((m) => m.mes.startsWith(a)).map((m) => ({ mes: m.mes, total: n2(m.total), previsto: !!m.futuro })),
          por_ativo: (dv.porAtivo || []).map((x) => ({ ticker: x.ticker, classe: x.classe, quantidade: n8(x.quantidade), recebido_12m: n2(x.recebido_12m),
            mensal_estimado: n2(x.mensal_estimado), dy_12m_pct: n2(x.dy_12m), yield_sobre_o_custo_pct: n2(x.yoc), frequencia: x.frequencia || null })),
          a_receber: (dv.proximos || []).slice(0, 40).map((x) => ({ ticker: x.ticker, tipo: x.tipo, data_com: x.data_com, pagamento: x.pagamento, valor: n2(x.valor) })),
          ...avisoMercado(e),
        };
      },
    },
    {
      nome: "agro_resumo",
      titulo: "Resumo do agronegócio",
      descricao: "Pecuária: rebanho por categoria, valor de hoje, quanto foi investido, vendas, custos, resultado e os indicadores do negócio (ganho de peso, mortalidade, custo por cabeça).",
      entrada: () => ({}),
      async executa(ctx) {
        const e = await carrega(ctx, { comMercado: false });
        const g = e.dados.agro;
        if (!g.tem_dados) return { tem_dados: false, mensagem: "Nenhum lançamento de agro nesta conta." };
        return {
          tem_dados: true, cabecas: g.total, valor_do_rebanho: n2(g.valorRebanho), avaliado_pelo_custo: !!g.pelo_custo, usa_peso: !!g.usa_peso,
          rendimento_de_carcaca_pct: n2(g.rendimento),
          por_categoria: g.porCategoria.map((c) => ({ categoria: c.categoria, nome: c.nome, cabecas: c.cabecas, peso_kg: n2(c.kg), data_do_peso: c.data_peso || null,
            preco_arroba: n2(c.preco_arroba), valor_por_cabeca: n2(c.valor_cabeca), valor: n2(c.valor) })),
          por_fazenda: g.porFazenda, por_lote: g.porLote,
          financeiro: enxuga(g.financeiro), ganho_de_peso: enxuga(g.gmd, 30),
          lancamentos_inconsistentes: enxuga(g.inconsistentes, 20),
          lotes: g.lotes ? g.lotes.lotes.map((l) => ({ id: l.id, chave: l.chave, nome: l.nome, aberto: l.aberto, aberto_em: l.aberto_em, fechado_em: l.fechado_em, dias: l.dias,
            cabecas_entrada: l.cabecas_entrada, cabecas: l.cabecas, custo_total: n2(l.custo_total), custo_em_aberto: n2(l.custo_em_aberto), custo_medio_cabeca: n2(l.custo_medio_cabeca),
            receita: n2(l.receita), resultado_realizado: n2(l.resultado_realizado), valor_estimado: n2(l.valor_estimado), avaliado_por: l.origem_valor,
            resultado_total: n2(l.resultado_total), custos_inclusos_no_preco: l.custos_inclusos_no_preco, ...(l.alerta_custos ? { alerta: "lote sem custos lançados" } : {}) })) : [],
          vendas_planejadas: g.lotes ? enxuga(g.lotes.vendas_planejadas) : [],
          custos_sem_lote: g.lotes ? n2(g.lotes.custos_sem_lote) : null,
        };
      },
    },
    {
      nome: "agro_lancamentos",
      titulo: "Lançamentos do agro",
      descricao: "Movimentos do rebanho (compra, venda, nascimento, morte…), custos e pesagens por período. Cada item traz o `id` e a `tabela` usados por editar_registro e apagar_registro.",
      entrada: () => ({ especie: z.enum(["movimentos", "custos", "pesagens", "todos"]).default("todos"), de: dataOpc, ate: dataOpc, limite }),
      async executa(ctx, f) {
        const e = await carrega(ctx, { comMercado: false });
        const pega = (lista, tabela) => lista.filter((x) => entre(x.data, f.de, f.ate)).sort((a, b) => b.data.localeCompare(a.data)).slice(0, f.limite)
          .map((x) => { const { user_id, criado_em, ...resto } = x; return { tabela, ...enxuga(resto) }; });
        const s = {};
        if (f.especie === "todos" || f.especie === "movimentos") s.movimentos = pega(e.base.agro.movsBrutos || e.base.agro.movs, "agro_movimentos");
        if (f.especie === "todos" || f.especie === "custos") s.custos = pega(e.base.agro.custos, "agro_custos");
        if (f.especie === "todos" || f.especie === "pesagens") s.pesagens = pega(e.base.agro.pesagens, "agro_pesagens");
        return s;
      },
    },
    {
      nome: "salario_e_plano",
      titulo: "Salário e plano do mês",
      descricao: "Os ganhos cadastrados (salário, bônus, aluguel…), a renda do mês e o plano de investimento: quanto investir, quanto já foi aportado e o que falta.",
      entrada: () => ({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mês no formato AAAA-MM").optional().describe("AAAA-MM (padrão: o mês atual)") }),
      async executa(ctx, args) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: false });
        const mes = args.mes || FC.datas.hoje().slice(0, 7);
        const plano = FC.salario.planoDoMes({ plano: e.prefs.plano, ganhos: e.base.ganhos, base: e.base, mes });
        const fs = plano.fixo_mais_sobra;
        const salvoMes = planoDoMesSalvo(e, mes);
        const custo = FC.rendaMes.custoDeVida(e.base.despesas || [], mes, FC.objetivos(e.prefs).custo_vida_mensal);
        const { itens: itensRenda, ...restoRenda } = plano.renda;
        return {
          mes, renda: enxuga({ ...restoRenda, itens: itensRenda.map((g) => ({ nome: g.nome, categoria: g.categoria, valor: g.valor, valor_no_mes: g.valor_mes,
            ...(g.origem_valor ? { como: g.origem_valor } : {}), ...(g.imposto ? { imposto: g.imposto.valor, imposto_origem: g.imposto.origem || g.imposto.motivo } : {}) })) }),
          plano_configurado: enxuga(e.prefs.plano),
          plano_do_mes: { a_investir: n2(plano.total), ja_aportado: n2(plano.aportado), falta: n2(plano.falta), sobra_da_renda: n2(plano.sobra_renda), destinos: enxuga(plano.destinos),
            ...(fs ? { fixo: n2(fs.valor_fixo), sobra_apurada: n2(fs.sobra), impostos: n2(fs.impostos), despesas: n2(fs.despesas), despesas_origem: fs.despesas_origem,
              apurado_no_fechamento: fs.apurado, falta_para_o_fixo: n2(fs.falta_para_o_fixo) } : {}) },
          parcelas_pendentes: plano.parcelas_pendentes.map((p) => ({ ...enxuga(p), como_executar: "registrar_movimento_interno com origem pote e parcelamento_id" })),
          despesas_do_mes: n2(FC.rendaMes.despesasDoMes(e.base.despesas || [], mes).total), custo_de_vida: { valor: n2(custo.valor), origem: custo.origem },
          // o plano salvo do mês (Marco 8) vale mais que o recalculado com a configuração de hoje
          plano_salvo: !!salvoMes, ...(salvoMes ? { plano_mensal: resumoPlanoMensal(FC, e, salvoMes, true) } : {}),
          ganhos: e.base.ganhos.map((g) => ({ id: g.id, nome: g.nome, categoria: g.categoria, tipo: g.tipo, valor: n2(g.valor), inicio: g.inicio, fim: g.fim || null,
            data_fim_contrato: g.data_fim_contrato || null, data_ultimo_pagamento: g.data_ultimo_pagamento || null,
            dia_regra: g.dia_regra || null, dia_numero: g.dia_numero ?? null, observacao: g.observacao || "",
            ...(g.categoria === "pj" ? { regime: g.regime || null, imposto_fixo_mensal: n2(g.imposto_fixo_mensal), imposto_pct: n2(g.imposto_pct), sem_13_ferias_fgts: g.sem_13_ferias_fgts ?? true } : {}),
            ...(g.proporcional ? { proporcional: true } : {}), ...(g.pagamento_mes_seguinte ? { pagamento_mes_seguinte: true } : {}) })),
        };
      },
    },
    {
      nome: "historico_patrimonio",
      titulo: "Histórico do patrimônio",
      descricao: "A evolução do patrimônio ao longo do tempo, pelas fotos diárias gravadas pelo app: total e cada classe. Períodos longos voltam resumidos em até `max_pontos` datas.",
      entrada: () => ({ de: dataOpc, ate: dataOpc, max_pontos: z.number().int().min(2).max(400).default(60) }),
      async executa(ctx, f) {
        const e = await carrega(ctx, { comMercado: false });
        const h = (e.base.historico || []).filter((x) => entre(x.data, f.de, f.ate));
        if (!h.length) return { pontos: [], mensagem: "Sem registros no período." };
        let escolhidos = h;
        if (h.length > f.max_pontos) {
          const passo = (h.length - 1) / (f.max_pontos - 1);
          escolhidos = Array.from({ length: f.max_pontos }, (_, i) => h[Math.round(i * passo)]);
        }
        const p = h[0], u = h[h.length - 1];
        return {
          de: p.data, ate: u.data, registros_no_periodo: h.length, patrimonio_inicial: n2(p.patrimonio), patrimonio_final: n2(u.patrimonio),
          variacao: n2(u.patrimonio - p.patrimonio), observacao: "a variação inclui aportes e saques, não é rentabilidade (use a ferramenta rentabilidade)",
          pontos: escolhidos.map((x) => ({ data: x.data, patrimonio: n2(x.patrimonio), bolsa: n2(x.renda_variavel), cripto: n2(x.cripto), renda_fixa: n2(x.renda_fixa), agro: n2(x.agro) })),
        };
      },
    },
    {
      nome: "preferencias",
      titulo: "Metas e preferências",
      descricao: "As metas de alocação por pilar, as premissas de projeção, o plano de investimento, a configuração do agro e os módulos ligados. `incluir_regras` traz também os critérios de avaliação dos ativos (resposta longa).",
      entrada: () => ({ incluir_regras: z.boolean().default(false) }),
      async executa(ctx, { incluir_regras }) {
        const e = await carrega(ctx, { comMercado: false });
        const { titulos, ...premissas } = e.prefs.premissas || {};
        return enxuga({ metas_de_alocacao_pct: e.prefs.alocacao_alvo, premissas, plano: e.prefs.plano, agro: e.prefs.agro, proventos: e.prefs.proventos,
          modulos: e.prefs.modulos, ...(incluir_regras ? { regras: e.prefs.regras } : {}) }, 200);
      },
    },
    {
      nome: "listar_potes",
      titulo: "Potes (finalidade do dinheiro)",
      descricao: "A renda fixa separada por finalidade: reserva de emergência, oportunidade, oportunidade do agro, IR a pagar e livre. Saldo de cada pote, títulos dentro dele, meta e quanto falta. A reserva de emergência é medida só pelo pote dela; IR a pagar é dinheiro comprometido.",
      entrada: () => ({}),
      async executa(ctx) {
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const pts = e.dados.potes;
        if (!pts) return { tem_potes: false, mensagem: ctx.FC.db.temTabela("potes") ? "A conta ainda não tem potes: o primeiro mover_entre_potes cria os padrões." : MIGRATION("0002", "potes") };
        return { tem_potes: true, ...resumoPotes(pts), ...avisoMercado(e) };
      },
    },
    {
      nome: "simular_realocacao",
      titulo: "Simular uma realocação",
      descricao: "Mostra o efeito de trocar um ativo por outro (ou por um título, ou mandar para um pote) sem gravar nada: alocação antes e depois, se a ordem RF › Ações › Cripto melhora ou piora, o resultado realizado na origem e o custo do destino.",
      entrada: () => entradaMov(z, { data, positivo, naoNegativo, texto }),
      async executa(ctx, a) {
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const p = planejaMov(ctx.FC, e, a);
        return { simulado: true, ...efeitoMov(p.efeito), ...avisoMercado(e) };
      },
    },
    {
      nome: "projetar",
      titulo: "Projeção mês a mês",
      descricao: "Projeta a carteira mês a mês por ativo e por categoria (renda fixa, ações, cripto, agro), com o aporte de cada mês pelo plano do Salário, a divisão do plano ou da hierarquia, os eventos futuros (vendas planejadas do agro entram sozinhas) e um cenário: `historico` (taxa histórica de cada ativo com proventos reinvestidos), `so_proventos` (preço parado, só DY e CDI) ou `estresse` (histórico com choque na cripto, padrão −30%). Horizonte de 1 a 24 meses (`meses`) ou de 1 a 50 anos (`anos`, resumido por ano). `eventos` acrescenta eventos só nesta chamada. É estimativa, não promessa.",
      entrada: () => ({ meses: z.number().int().min(1).max(24).optional(), anos: z.number().int().min(1).max(50).optional(),
        cenario: z.enum(["historico", "so_proventos", "estresse"]).default("historico"), choque_cripto: z.number().min(-100).max(0).optional(),
        janela_anos: z.number().int().min(1).max(10).optional().describe("janela da taxa histórica (padrão 5)"),
        incluir_vendas_planejadas: z.boolean().default(true),
        eventos: z.array(z.object(entradaEvento(z, { data, naoNegativo, texto })).strict()).max(20).optional() }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (a.meses && a.anos) throw new ErroMcp("Use `meses` ou `anos`, não os dois.");
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const meses = a.anos ? a.anos * 12 : a.meses || 12;
        const r = FC.projecaoMensal.projeta(e, { meses, cenario: a.cenario, choque_cripto: a.choque_cripto, janela_anos: a.janela_anos,
          incluir_vendas_planejadas: a.incluir_vendas_planejadas, eventos: (a.eventos || []).map(eventoDe) });
        const ponto = (p) => ({ mes: p.mes, total: n2(p.total), total_sem_agro: n2(p.total_sem_agro), aporte: n2(p.aporte), por_categoria: enxuga(p.por_categoria),
          ...(p.eventos.length ? { eventos: enxuga(p.eventos) } : {}) });
        return {
          cenario: r.cenario, horizonte: a.anos ? `${a.anos} anos` : `${meses} meses`, de: r.inicio, indicadores: enxuga(r.indicadores), divisao_do_aporte: r.divisao,
          final: { mes: r.final.mes, total: n2(r.final.total), total_sem_agro: n2(r.final.total_sem_agro), por_ativo: enxuga(r.final.por_ativo), por_categoria: enxuga(r.final.por_categoria) },
          serie: a.anos ? FC.projecaoMensal.porAno(r.serie).map((p) => ({ ano: p.ano, total: n2(p.total), total_sem_agro: n2(p.total_sem_agro), por_categoria: enxuga(p.por_categoria) })) : r.serie.map(ponto),
          taxas: enxuga(r.taxas), eventos: enxuga(r.eventos), estimativa: true,
          como_ler: "Estimativa com preços e taxas constantes por cenário. O aporte de cada mês vem do plano do Salário (fixo + sobra usa o custo de vida previsto). Não é recomendação.",
          ...avisoMercado(e),
        };
      },
    },
    {
      nome: "listar_eventos",
      titulo: "Eventos futuros das projeções",
      descricao: "Os eventos que entram nas projeções: vendas planejadas do agro, mudanças de renda, aportes extras e resgates, salvos ou vindos dos lotes. Cada evento salvo traz o `id`.",
      entrada: () => ({ de: dataOpc, ate: dataOpc }),
      async executa(ctx, f) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: false });
        const ev = FC.projecaoMensal.eventosDoPeriodo(e, [], true).filter((x) => entre(String(x.data), f.de, f.ate)).sort((a, b) => String(a.data).localeCompare(String(b.data)));
        return { total: ev.length, eventos: ev.map((x) => ({ id: x.id || null, data: x.data, tipo: x.tipo, descricao: x.descricao || null, origem: x.origem, parametros: enxuga(x.parametros || {}) })) };
      },
    },
    {
      nome: "listar_planos_mensais",
      titulo: "Planos mensais (histórico)",
      descricao: "Resumo de cada mês com plano salvo: status (rascunho, ativo, fechado), meta, aportado, % executado, fora do plano, sobra prevista e real e se a hierarquia foi respeitada. Do mais recente para o mais antigo.",
      entrada: () => ({ de: MES(z).optional(), ate: MES(z).optional() }),
      async executa(ctx, f) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: false });
        const ps = (e.base.planosMensais || []).filter((p) => (!f.de || p.mes >= f.de) && (!f.ate || p.mes <= f.ate)).sort((a, b) => b.mes.localeCompare(a.mes));
        return { total: ps.length, planos: ps.map((p) => resumoPlanoMensal(FC, e, p)), ...(FC.db.temTabela("planos_mensais") ? {} : { aviso: MIGRATION("0008", "planos_mensais") }) };
      },
    },
    {
      nome: "detalhar_plano_mensal",
      titulo: "Detalhe do plano de um mês",
      descricao: "O plano de um mês: de onde vem cada número da renda, os destinos com previsto, aportado e desvio, os aportes atribuídos a cada destino, o que ficou fora do plano, o contexto do mês anterior e o log de reaberturas.",
      entrada: () => ({ mes: MES(z) }),
      async executa(ctx, { mes }) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: false });
        const p = planoDoMesSalvo(e, mes);
        if (!p) throw new ErroMcp(`Não há plano salvo para ${mes}. Gere um com gerar_plano_mensal.`);
        return resumoPlanoMensal(FC, e, p, true);
      },
    },
    {
      nome: "listar_alertas",
      titulo: "Alertas de preço e revisões",
      descricao: "Os alertas de preço cadastrados (acima, abaixo ou empate com o preço médio), com o preço de agora, o alvo e se dispararia hoje; as revisões programadas (as vencidas primeiro) e as notificações recentes. Cada item traz o `id` (tabelas alertas_preco e revisoes em editar_registro e apagar_registro).",
      entrada: () => ({ incluir_feitas: z.boolean().default(false) }),
      async executa(ctx, { incluir_feitas }) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true });
        const av = FC.alertasPreco.avalia(e.base.alertasPreco || [], e.dados);
        const hoje = FC.datas.hoje();
        return {
          alertas: (e.base.alertasPreco || []).map((al) => { const x = av.find((y) => y.alerta === al) || {};
            return { id: al.id, ticker: al.ticker, condicao: al.condicao, valor: np(al.valor), ligado: al.ligado !== false, alvo: np(x.alvo), preco_agora: np(x.preco),
              dispararia_hoje: !!x.dispara, ultimo_disparo: al.ultimo_disparo || null, ...(x.motivo ? { observacao: x.motivo } : {}) }; }),
          revisoes: (e.base.revisoes || []).filter((r) => incluir_feitas || !r.feita).sort((a, b) => a.data.localeCompare(b.data))
            .map((r) => ({ id: r.id, ticker: r.ticker || null, tema: r.tema || null, data: r.data, pergunta: r.pergunta, feita: !!r.feita, vencida: !r.feita && r.data <= hoje })),
          notificacoes: (e.base.notificacoes || []).slice(-20).reverse().map((n) => ({ quando: n.quando, titulo: n.titulo, texto: n.texto, lida: !!n.lida })),
          sugestoes_de_empate: enxuga(FC.alertasPreco.sugereEmpates(e.dados, e.base.alertasPreco || [])),
          ...(FC.db.temTabela("alertas_preco") ? {} : { aviso: MIGRATION("0009", "alertas_preco") }), ...avisoMercado(e),
        };
      },
    },
    {
      nome: "auditar_dados",
      titulo: "Auditar os dados",
      descricao: "Roda as checagens de coerência da conta (custo nulo, resultado que não fecha, retorno sem sentido, aplicado divergente, cotação quebrada, premissa de aporte duplicada, proventos ambíguos, fim de ganho divergente) e devolve as inconsistências encontradas. Só leitura. Lista vazia = nada a apontar.",
      entrada: () => ({}),
      async executa(ctx) {
        const { FC } = ctx;
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const achados = FC.auditoria.verifica(e);
        return { total: achados.length, inconsistencias: enxuga(achados, 200), ...avisoMercado(e) };
      },
    },
  ];

  // ---------------------------------------------------------------- escrita
  const acha = (lista, f) => lista.find(f) || null;

  const ESCRITA = [
    {
      nome: "registrar_lancamento",
      titulo: "Registrar compra, venda, provento ou renda fixa",
      descricao: "Lança uma operação. compra/venda: `ticker`, `quantidade` e `preco` ou `valor` total (ativo novo numa compra precisa de `classe`). provento: `ticker` e `valor`. aporte_renda_fixa/resgate_renda_fixa: `titulo` (já cadastrado, veja listar_renda_fixa) e `valor`. Sempre confirme os números com a pessoa antes de chamar.",
      entrada: () => ({
        operacao: z.enum(["compra", "venda", "provento", "aporte_renda_fixa", "resgate_renda_fixa"]),
        data: dataOpc.describe("AAAA-MM-DD (padrão: hoje)"),
        ticker: ticker.optional(), quantidade: positivo.optional(), preco: positivo.optional().describe("preço por cota"),
        valor: positivo.optional().describe("valor total da operação, sempre positivo"),
        titulo: texto(80).optional().describe("nome do título de renda fixa"),
        classe: z.enum(CLASSES).optional().describe("só para ativo ainda não cadastrado"),
        pilar: z.enum(PILARES).optional(),
        indexador: z.enum(INDEXADORES).optional().describe("renda fixa: taxa própria deste aporte"), taxa: z.number().optional(),
        observacao: texto(160).optional(),
        vender_acima_da_posicao: z.boolean().default(false).describe("permite vender mais do que a posição registrada"),
      }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const dia = a.data || FC.datas.hoje();
        const obs = a.observacao || "";
        let linha;
        if (a.operacao === "compra" || a.operacao === "venda") {
          if (!a.ticker || !a.quantidade) throw new ErroMcp("Informe ticker e quantidade.");
          if (!a.preco && !a.valor) throw new ErroMcp("Informe o preço por cota ou o valor total.");
          const venda = a.operacao === "venda";
          const total = a.valor || a.quantidade * a.preco;
          const item = acha(e.base.ativos, (x) => x.ticker === a.ticker);
          if (venda) {
            if (!item) throw new ErroMcp(`${a.ticker} não está na carteira.`);
            const reg = FC.carteira.consolidadoPorTicker(e.base.aportes)[a.ticker];
            const tem = (Number(item.quantidade) || 0) + (reg ? reg.quantidade : 0);
            if (a.quantidade > tem + 1e-9 && !a.vender_acima_da_posicao) {
              throw new ErroMcp(`A posição registrada de ${a.ticker} é ${n8(tem)} e a venda é de ${a.quantidade}. Confirme com a pessoa e repita com vender_acima_da_posicao: true.`);
            }
          } else if (!item) {
            if (!a.classe) throw new ErroMcp(`${a.ticker} ainda não está cadastrado: informe a classe (${CLASSES.join(", ")}).`);
            await grava(() => FC.db.inserir("ativos", { ticker: a.ticker, classe: a.classe, pilar: a.pilar || PILAR_PADRAO[a.classe], lista: "carteira", quantidade: 0 }));
          } else if (item.lista === "watchlist") {
            await grava(() => FC.db.atualizar("ativos", item.id, { lista: "carteira" }));
          }
          linha = { tipo: "ativo", ticker: a.ticker, quantidade: venda ? -a.quantidade : a.quantidade, preco: total / a.quantidade,
            valor: venda ? -total : total, data: dia, observacao: obs, venda };
        } else if (a.operacao === "provento") {
          if (!a.ticker || !a.valor) throw new ErroMcp("Informe ticker e valor.");
          linha = { tipo: "provento", ticker: a.ticker, valor: a.valor, data: dia, observacao: obs };
        } else {
          if (!a.titulo || !a.valor) throw new ErroMcp("Informe o título e o valor.");
          const t = acha(e.base.rendaFixa, (x) => x.nome.toLowerCase() === a.titulo.toLowerCase());
          if (!t) throw new ErroMcp(`Título "${a.titulo}" não encontrado. Cadastre com salvar_titulo (valor_aplicado 0) e lance o aporte em seguida.`);
          const resgate = a.operacao === "resgate_renda_fixa";
          const propria = !resgate && (a.indexador || a.taxa != null) ? { indexador: a.indexador || t.tipo, taxa: a.taxa ?? t.taxa } : {};
          linha = { tipo: "caixa", titulo: t.nome, valor: resgate ? -a.valor : a.valor, data: dia, observacao: obs, ...propria };
        }
        const salvo = await grava(() => FC.db.inserir("aportes", linha));
        await audita(ctx, "mcp_lancamento", { id: salvo.id, operacao: a.operacao, ticker: linha.ticker || null, titulo: linha.titulo || null, valor: linha.valor, data: dia });
        return { ok: true, tabela: "aportes", registro: lancamento(salvo) };
      },
    },
    {
      nome: "salvar_ativo",
      titulo: "Cadastrar ou atualizar um ativo",
      descricao: "Cria um ativo (carteira ou watchlist) ou atualiza o cadastro de um que já existe, pelo ticker: classe, pilar, lista, posição inicial e preço médio. Compras e vendas do dia a dia vão em registrar_lancamento, não aqui.",
      entrada: () => ({ ticker, classe: z.enum(CLASSES).optional(), pilar: z.enum(PILARES).optional(), lista: z.enum(LISTAS).optional(),
        quantidade: naoNegativo.optional().describe("posição inicial, fora dos lançamentos"), preco_medio: positivo.nullable().optional(), data_base: data.nullable().optional() }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const { ticker: tk, ...resto } = a;
        const item = acha(e.base.ativos, (x) => x.ticker === tk);
        let salvo;
        if (item) {
          if (!Object.keys(resto).length) throw new ErroMcp("Nada para atualizar: informe ao menos um campo.");
          salvo = await grava(() => FC.db.atualizar("ativos", item.id, resto));
        } else {
          if (!a.classe) throw new ErroMcp(`Ativo novo: informe a classe (${CLASSES.join(", ")}).`);
          const lista = a.lista || "carteira";
          salvo = await grava(() => FC.db.inserir("ativos", { ticker: tk, classe: a.classe, pilar: a.pilar || PILAR_PADRAO[a.classe], lista,
            quantidade: lista === "watchlist" ? 0 : a.quantidade || 0, preco_medio: lista === "watchlist" ? null : a.preco_medio ?? null, data_base: a.data_base ?? null }));
        }
        await audita(ctx, item ? "mcp_edicao" : "mcp_cadastro", { tabela: "ativos", id: salvo.id, ticker: tk });
        return { ok: true, criado: !item, tabela: "ativos", registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "salvar_titulo",
      titulo: "Cadastrar ou atualizar um título de renda fixa",
      descricao: "Cria um título de renda fixa ou atualiza um existente, pelo nome. `tipo` cdi ou selic: taxa = % do índice; ipca: taxa = juro real ao ano; prefixado: taxa = % ao ano. Para um título novo que vai receber aportes, deixe valor_aplicado em 0 e lance os aportes com registrar_lancamento.",
      entrada: () => ({ nome: texto(80).min(1), novo_nome: texto(80).min(1).optional().describe("para renomear um título existente"),
        tipo: z.enum(TIPOS_RF).optional(), taxa: z.number().nullable().optional(), vencimento: data.nullable().optional(),
        valor_aplicado: naoNegativo.optional(), pilar: z.enum(PILARES).optional(), data_inicio: data.nullable().optional(),
        pote_id: z.string().uuid().nullable().optional().describe("o pote do título (veja listar_potes); nulo = livre") }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const { nome, novo_nome, ...resto } = a;
        const item = acha(e.base.rendaFixa, (x) => x.nome.toLowerCase() === nome.toLowerCase());
        let salvo;
        if (item) {
          const mudancas = { ...resto, ...(novo_nome ? { nome: novo_nome } : {}) };
          if (!Object.keys(mudancas).length) throw new ErroMcp("Nada para atualizar: informe ao menos um campo.");
          salvo = await grava(() => FC.db.atualizar("renda_fixa", item.id, mudancas));
        } else {
          if (!a.tipo) throw new ErroMcp(`Título novo: informe o tipo (${TIPOS_RF.join(", ")}).`);
          salvo = await grava(() => FC.db.inserir("renda_fixa", { nome, tipo: a.tipo, taxa: a.taxa ?? null, vencimento: a.vencimento ?? null,
            valor_aplicado: a.valor_aplicado || 0, pilar: a.pilar || "caixa", data_inicio: a.data_inicio ?? null, ...(a.pote_id ? { pote_id: a.pote_id } : {}) }));
        }
        await audita(ctx, item ? "mcp_edicao" : "mcp_cadastro", { tabela: "renda_fixa", id: salvo.id, nome: salvo.nome });
        return { ok: true, criado: !item, tabela: "renda_fixa", registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "salvar_ganho",
      titulo: "Cadastrar ou atualizar um ganho",
      descricao: "Cria um ganho (salário, bônus, aluguel…) ou, com `id`, atualiza um existente. `tipo` recorrente vale todo mês entre `inicio` e `fim`; avulso vale só no mês de `inicio`. O valor é o líquido.",
      entrada: () => ({ id: z.string().optional().describe("id do ganho a atualizar (veja salario_e_plano)"),
        nome: texto(80).min(1).optional(), categoria: z.enum(CATEGORIAS_GANHO).optional(), tipo: z.enum(TIPOS_GANHO).optional(),
        valor: positivo.optional(), inicio: dataOpc, fim: data.nullable().optional(), observacao: texto(160).optional(),
        dia_regra: z.enum(REGRAS_DIA).nullable().optional(), dia_numero: z.number().int().min(1).max(31).nullable().optional(),
        data_fim_contrato: data.nullable().optional().describe("recorrente: quando o contrato termina (pode ser depois do último pagamento)"),
        data_ultimo_pagamento: data.nullable().optional().describe("recorrente: a data do último pagamento; vale no lugar de `fim` para a renda do mês"),
        regime: z.enum(REGIMES_PJ).optional().describe("PJ: mei, simples ou outro"), imposto_fixo_mensal: naoNegativo.nullable().optional().describe("PJ: DAS ou imposto fixo por mês"),
        imposto_pct: z.number().min(0).max(100).nullable().optional().describe("PJ: % sobre o faturamento"), sem_13_ferias_fgts: z.boolean().optional().describe("PJ: sem 13º, férias e FGTS (padrão: true)"),
        proporcional: z.boolean().optional().describe("paga pelos dias trabalhados quando começa ou termina no meio do mês"),
        pagamento_mes_seguinte: z.boolean().optional().describe("o trabalho de um mês cai na conta no mês seguinte") }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const { id, ...resto } = a;
        let salvo;
        if (id) {
          if (!Object.keys(resto).length) throw new ErroMcp("Nada para atualizar: informe ao menos um campo.");
          salvo = await grava(() => FC.db.atualizar("ganhos", id, resto));
        } else {
          if (!a.nome || !a.tipo || !a.valor) throw new ErroMcp("Ganho novo: informe nome, tipo e valor.");
          const inicio = a.inicio || FC.datas.hoje();
          if (a.fim && a.fim < inicio) throw new ErroMcp("A data final vem antes da inicial.");
          salvo = await grava(() => FC.db.inserir("ganhos", { nome: a.nome, categoria: a.categoria || "salario", tipo: a.tipo, valor: a.valor, inicio,
            fim: a.tipo === "recorrente" ? a.fim ?? null : null, observacao: a.observacao || "", dia_regra: a.tipo === "recorrente" ? a.dia_regra ?? null : null,
            dia_numero: a.tipo === "recorrente" ? a.dia_numero ?? null : null,
            // só manda as colunas novas quando informadas (o banco pode não ter a migration 0001)
            ...(a.tipo === "recorrente" && a.data_fim_contrato ? { data_fim_contrato: a.data_fim_contrato } : {}),
            ...(a.tipo === "recorrente" && a.data_ultimo_pagamento ? { data_ultimo_pagamento: a.data_ultimo_pagamento } : {}),
            ...Object.fromEntries(["regime", "imposto_fixo_mensal", "imposto_pct", "sem_13_ferias_fgts", "proporcional", "pagamento_mes_seguinte"].filter((k) => a[k] != null).map((k) => [k, a[k]])) }));
        }
        await audita(ctx, id ? "mcp_edicao" : "mcp_cadastro", { tabela: "ganhos", id: salvo.id, nome: salvo.nome });
        return { ok: true, criado: !id, tabela: "ganhos", registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "registrar_agro",
      titulo: "Registrar movimento, custo ou pesagem do gado",
      descricao: "Lança no agro. movimento: `tipo` (compra, venda, troca, nascimento, morte, entrada, saida, reclassificacao), `categoria`, `cabecas` e, em compra e venda, o preço (`preco_arroba` com `peso_medio_kg`, ou `preco_cabeca`, ou `valor_total`). troca: `cabecas_saida`, `cabecas_entrada`, `valor_referencia_saida` e `valor_referencia_entrada` (totais), `categoria` (sai) e `categoria_destino` (entra): fecha o ciclo das cabeças que saem e abre um lote novo. `lote_id` liga ao lote (veja agro_resumo); sem ele, a compra abre um lote e a saída baixa dos lotes mais antigos. venda com `destino` (pote): Funrural retido e o líquido vai para o pote como movimento interno; com `reservar_ir`, o IR estimado vai para o pote IR a pagar. custo: `categoria_custo` e `valor`. pesagem: `categoria`, `cabecas` e `peso_medio_kg`. `simular: true` mostra o efeito sem gravar.",
      entrada: () => ({
        especie: z.enum(["movimento", "custo", "pesagem"]),
        data: dataOpc.describe("AAAA-MM-DD (padrão: hoje)"),
        tipo: z.enum(TIPOS_MOV).optional(), categoria: z.enum(CATEGORIAS_GADO).optional(), categoria_destino: z.enum(CATEGORIAS_GADO).optional().describe("reclassificacao e troca"),
        cabecas: z.number().int().positive().optional(), peso_medio_kg: positivo.optional(),
        preco_arroba: naoNegativo.optional(), preco_cabeca: naoNegativo.optional(), valor_total: naoNegativo.optional(),
        despesas: naoNegativo.optional().describe("frete, comissão, Funrural da operação"),
        reinvestido: naoNegativo.optional().describe("venda: quanto do líquido fica no agro para as próximas compras"),
        categoria_custo: z.enum(CATEGORIAS_CUSTO).optional(), valor: positivo.optional().describe("custo: o valor pago"), descricao: texto(160).optional(),
        fazenda: texto(80).optional(), lote: texto(80).optional(), contraparte: texto(80).optional(), observacao: texto(160).optional(),
        lote_id: z.string().uuid().optional().describe("o lote do movimento ou do custo (agro_resumo.lotes)"),
        cabecas_saida: z.number().int().positive().optional(), cabecas_entrada: z.number().int().positive().optional(),
        valor_referencia_saida: naoNegativo.optional(), valor_referencia_entrada: naoNegativo.optional(),
        destino: texto(80).optional().describe("venda: pote que recebe o líquido (tipo, nome ou id; ex.: oportunidade_agro)"),
        funrural_retido: z.boolean().default(true).describe("venda com destino: o comprador retém o Funrural"),
        reservar_ir: z.boolean().default(true).describe("venda com destino: separa o IR estimado no pote IR a pagar"),
        simular: z.boolean().default(false),
      }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const dia = a.data || FC.datas.hoje();
        let tabela, linha, extra = null;
        if (a.especie === "custo") {
          if (!a.categoria_custo || !a.valor) throw new ErroMcp("Custo: informe categoria_custo e valor.");
          tabela = "agro_custos";
          linha = { data: dia, categoria: a.categoria_custo, descricao: a.descricao || "", valor: a.valor, fazenda: a.fazenda || null, lote: a.lote || null, ...(a.lote_id ? { lote_id: a.lote_id } : {}) };
        } else if (a.especie === "pesagem") {
          if (!a.categoria || !a.cabecas || !a.peso_medio_kg) throw new ErroMcp("Pesagem: informe categoria, cabecas e peso_medio_kg.");
          tabela = "agro_pesagens";
          linha = { data: dia, categoria: a.categoria, lote: a.lote || null, fazenda: a.fazenda || null, cabecas: a.cabecas, peso_medio_kg: a.peso_medio_kg, observacao: a.observacao || "" };
        } else if (a.tipo === "troca") {
          if (!a.categoria || !a.cabecas_saida || !a.cabecas_entrada || a.valor_referencia_saida == null || a.valor_referencia_entrada == null) {
            throw new ErroMcp("Troca: informe categoria, cabecas_saida, cabecas_entrada, valor_referencia_saida e valor_referencia_entrada (valores totais).");
          }
          tabela = "agro_movimentos";
          linha = { data: dia, tipo: "troca", categoria: a.categoria, categoria_destino: a.categoria_destino || a.categoria, cabecas: a.cabecas_saida,
            cabecas_saida: a.cabecas_saida, cabecas_entrada: a.cabecas_entrada, valor_referencia_saida: a.valor_referencia_saida, valor_referencia_entrada: a.valor_referencia_entrada,
            valor_total: 0, despesas: 0, fazenda: a.fazenda || null, lote: a.lote || null, contraparte: a.contraparte || null, observacao: a.observacao || "",
            ...(a.lote_id ? { lote_id: a.lote_id } : {}) };
        } else {
          if (!a.tipo || !a.categoria || !a.cabecas) throw new ErroMcp("Movimento: informe tipo, categoria e cabecas.");
          if (a.tipo === "reclassificacao" && !a.categoria_destino) throw new ErroMcp("Reclassificação: informe categoria_destino.");
          const comPreco = a.tipo === "compra" || a.tipo === "venda";
          const e = await carrega(ctx, { comMercado: false });
          const rend = Number(e.prefs.agro.rendimento_carcaca) || 52;
          const modo = a.preco_arroba != null ? "arroba" : a.preco_cabeca != null ? "cabeca" : "total";
          let total = 0;
          if (comPreco || a.tipo === "entrada") {
            total = FC.agro.valorDaOperacao({ modo, cabecas: a.cabecas, peso_medio_kg: a.peso_medio_kg ?? null, preco_arroba: a.preco_arroba ?? null,
              preco_cabeca: a.preco_cabeca ?? null, valor_total: a.valor_total ?? null }, rend);
          }
          if (comPreco && !(total > 0)) throw new ErroMcp(modo === "arroba" && !a.peso_medio_kg ? "Para fechar por @, informe o peso médio." : "Compra e venda precisam de preço: preco_arroba com peso_medio_kg, preco_cabeca ou valor_total.");
          let despesas = comPreco ? a.despesas || 0 : 0;
          if (a.destino && a.tipo !== "venda") throw new ErroMcp("`destino` só vale para venda.");
          if (a.destino) {
            // impostos rurais: Funrural (retido) e IR estimado; parâmetros do banco
            const imp = FC.lotes.impostosVenda(total, { parametros: e.base.parametros || [], data: dia, funrural_retido: a.funrural_retido,
              ir_modo: e.prefs.agro.ir_modo, ir_aliquota: e.prefs.agro.ir_aliquota });
            if (a.funrural_retido && imp.funrural != null && a.despesas == null) despesas = imp.funrural;
            const liquido = total - despesas;
            const pts = e.dados.potes;
            if (!pts) throw new ErroMcp(FC.db.temTabela("potes") ? "A conta ainda não tem potes: crie com mover_entre_potes ou na tela Potes." : MIGRATION("0002", "potes"));
            const acha = (x) => pts.potes.find((p) => p.id === x || p.tipo === x || String(p.nome).toLowerCase() === String(x).toLowerCase());
            const pd = acha(a.destino);
            if (!pd) throw new ErroMcp(`Pote "${a.destino}" não encontrado.`);
            const pir = acha("ir_a_pagar");
            const ir = a.reservar_ir && imp.ir_estimado > 0 && pir ? Math.min(imp.ir_estimado, liquido) : 0;
            extra = { imp, liquido, pd, pir, ir };
          }
          tabela = "agro_movimentos";
          linha = { data: dia, tipo: a.tipo, categoria: a.categoria, categoria_destino: a.tipo === "reclassificacao" ? a.categoria_destino : null, cabecas: a.cabecas,
            peso_medio_kg: a.peso_medio_kg ?? null, preco_arroba: modo === "arroba" ? a.preco_arroba : null, preco_cabeca: modo === "cabeca" ? a.preco_cabeca : null,
            valor_total: Math.round(total * 100) / 100, despesas: Math.round(despesas * 100) / 100, reinvestido: a.tipo === "venda" && !a.destino ? a.reinvestido ?? null : null,
            fazenda: a.fazenda || null, lote: a.lote || null, contraparte: comPreco ? a.contraparte || null : null, observacao: a.observacao || "",
            ...(a.lote_id ? { lote_id: a.lote_id } : {}) };
        }
        const efeitoVenda = extra && { receita_bruta: n2(extra.imp.receita), funrural: n2(extra.imp.funrural), funrural_retido: extra.imp.funrural_retido,
          liquido: n2(extra.liquido), para_o_pote: { pote: extra.pd.nome, valor: n2(extra.liquido) },
          ir_estimado: n2(extra.imp.ir_estimado), ir_reservado: extra.ir > 0 ? { pote: extra.pir.nome, valor: n2(extra.ir) } : null,
          estimativa: true, parametros_usados: enxuga(extra.imp.parametros_usados), ...(extra.imp.motivo ? { motivo: extra.imp.motivo } : {}) };
        if (a.simular) return { simulado: true, tabela, registro: enxuga(linha), ...(efeitoVenda ? { venda: efeitoVenda } : {}) };
        if (extra) {
          // venda com destino: movimento interno do lote para o pote
          if (!FC.db.temTabela("movimentos_internos")) throw new ErroMcp(MIGRATION("0003", "movimentos_internos"));
          const id = FC.potes.uuid();
          await grava(() => FC.db.inserir("movimentos_internos", { id, data: dia, origem_tipo: "agro_lote", origem_id: a.lote_id || a.lote || a.categoria,
            origem_quantidade: a.cabecas, origem_preco: linha.valor_total / a.cabecas, destino_tipo: "pote", destino_id: extra.pd.id, custos: { impostos: linha.despesas },
            observacao: `venda do gado → ${extra.pd.nome}`.slice(0, 160) }));
          linha.movimento_interno_id = id;
          const salvo = await grava(() => FC.db.inserir(tabela, linha));
          await grava(() => FC.db.inserir("potes_movimentos", { pote_id: extra.pd.id, data: dia, valor: extra.liquido, descricao: "venda do gado", movimento_interno_id: id }));
          if (extra.ir > 0) {
            const t = FC.potes.uuid();
            await grava(() => FC.db.inserir("potes_movimentos", { pote_id: extra.pd.id, data: dia, valor: -extra.ir, descricao: "IR estimado da venda do gado", transferencia_id: t }));
            await grava(() => FC.db.inserir("potes_movimentos", { pote_id: extra.pir.id, data: dia, valor: extra.ir, descricao: "IR estimado da venda do gado", transferencia_id: t }));
          }
          await audita(ctx, "mcp_lancamento", { tabela, id: salvo.id, especie: a.especie, data: dia, movimento_interno_id: id });
          return { ok: true, tabela, registro: enxuga(sem(salvo)), venda: efeitoVenda };
        }
        const salvo = await grava(() => FC.db.inserir(tabela, linha));
        await audita(ctx, "mcp_lancamento", { tabela, id: salvo.id, especie: a.especie, data: dia });
        return { ok: true, tabela, registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "planejar_venda_agro",
      titulo: "Planejar a venda de um lote do gado",
      descricao: "Registra no lote a venda prevista (data, cabeças, preço esperado por cabeça, destino planejado) e, se quiser, a estimativa manual do valor por cabeça e se os custos estão inclusos no preço. Devolve a receita esperada, o Funrural e o IR estimados. A venda planejada alimenta as projeções. `lote` é o id ou o nome do lote (agro_resumo.lotes). `simular: true` não grava.",
      entrada: () => ({ lote: texto(80).min(1), data_prevista: data.optional(), cabecas: z.number().int().positive().optional(),
        preco_esperado_cabeca: naoNegativo.optional(), destino_planejado: texto(80).optional().describe("pote ou ativo de destino"),
        valor_estimado_cabeca: naoNegativo.optional(), custos_inclusos_no_preco: z.boolean().optional(), nome: texto(80).optional().describe("nome do lote, para um lote que ainda não tem"),
        simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const L = (e.dados.agro.lotes || {}).lotes || [];
        const l = L.find((x) => x.id === a.lote || x.chave === a.lote || (x.nome && x.nome.toLowerCase() === a.lote.toLowerCase()));
        if (!l) throw new ErroMcp(`Lote "${a.lote}" não encontrado. Veja agro_resumo.lotes.`);
        if (!l.aberto) throw new ErroMcp("Esse lote já foi todo vendido ou trocado.");
        const cab = a.cabecas || l.cabecas;
        if (cab > l.cabecas) throw new ErroMcp(`O lote tem ${l.cabecas} cabeças.`);
        const receita = a.preco_esperado_cabeca != null ? a.preco_esperado_cabeca * cab : null;
        const imp = receita != null ? FC.lotes.impostosVenda(receita, { parametros: e.base.parametros || [], data: a.data_prevista, ir_modo: e.prefs.agro.ir_modo, ir_aliquota: e.prefs.agro.ir_aliquota }) : null;
        const campos = { ...(a.data_prevista ? { data_prevista: a.data_prevista } : {}), ...(a.cabecas ? { cabecas_previstas: a.cabecas } : {}),
          ...(a.preco_esperado_cabeca != null ? { preco_esperado_cabeca: a.preco_esperado_cabeca } : {}), ...(a.destino_planejado ? { destino_planejado: a.destino_planejado } : {}),
          ...(a.valor_estimado_cabeca != null ? { valor_estimado_cabeca: a.valor_estimado_cabeca, data_estimativa: FC.datas.hoje() } : {}),
          ...(a.custos_inclusos_no_preco != null ? { custos_inclusos_no_preco: a.custos_inclusos_no_preco } : {}) };
        const efeito = { lote: l.nome, cabecas: cab, receita_esperada: n2(receita), funrural: imp ? n2(imp.funrural) : null, liquido: imp ? n2(imp.liquido) : null,
          ir_estimado: imp ? n2(imp.ir_estimado) : null, resultado_esperado: receita != null && l.custo_medio_cabeca != null ? n2(receita - l.custo_medio_cabeca * cab) : null,
          estimativa: true, ...(imp && imp.motivo ? { motivo: imp.motivo } : {}), campos };
        if (a.simular) return { simulado: true, ...efeito };
        if (!Object.keys(campos).length) throw new ErroMcp("Nada para gravar: informe data_prevista, preco_esperado_cabeca, valor_estimado_cabeca…");
        if (!FC.db.temTabela("agro_lotes")) throw new ErroMcp(MIGRATION("0004", "agro_lotes"));
        let id = l.id;
        if (id) await grava(() => FC.db.atualizar("agro_lotes", id, campos));
        else {
          // lote calculado (sem linha): cria a linha e liga a compra que o abriu
          const novo = await grava(() => FC.db.inserir("agro_lotes", { nome: a.nome || l.nome, ...campos }));
          id = novo.id;
          const compra = String(l.chave).startsWith("compra:") ? l.chave.slice(7) : null;
          if (compra) await grava(() => FC.db.atualizar("agro_movimentos", compra, { lote_id: id }));
        }
        await audita(ctx, "mcp_agro_lote", { lote_id: id, campos: Object.keys(campos) });
        return { ok: true, lote_id: id, ...efeito };
      },
    },
    {
      nome: "atualizar_metas",
      titulo: "Atualizar as metas de alocação",
      descricao: "Muda a meta de alocação por pilar, em % do patrimônio. Informe só os pilares que mudam; os outros ficam como estão. O total precisa fechar em 100.",
      entrada: () => ({ metas: z.object({ acoes: z.number().min(0).max(100), real_estate: z.number().min(0).max(100), alternativos: z.number().min(0).max(100),
        caixa: z.number().min(0).max(100), agro: z.number().min(0).max(100) }).partial().strict().describe("pilar → % (acoes, real_estate, alternativos, caixa, agro)") }),
      async executa(ctx, { metas }) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        if (!Object.keys(metas).length) throw new ErroMcp("Informe ao menos um pilar.");
        const e = await carrega(ctx, { comMercado: false });
        const antes = e.prefs.alocacao_alvo;
        const depois = Object.fromEntries(FC.PILARES.map((p) => [p.chave, Number(metas[p.chave] ?? antes[p.chave]) || 0]));
        const soma = Object.values(depois).reduce((s, v) => s + v, 0);
        if (Math.abs(soma - 100) > 0.01) throw new ErroMcp(`As metas precisam somar 100% e somam ${n2(soma)}%: ${JSON.stringify(depois)}.`);
        await grava(() => FC.db.gravaPrefs({ alocacao_alvo: depois }));
        await audita(ctx, "mcp_metas", { antes, depois });
        return { ok: true, antes: enxuga(antes), depois };
      },
    },
    {
      nome: "mover_entre_potes",
      titulo: "Mover dinheiro entre potes",
      descricao: "Muda a finalidade de um valor: tira de um pote e põe em outro (ex.: do livre para a reserva de emergência). O patrimônio e a alocação não mudam. `de` e `para` aceitam o id, o tipo (reserva_emergencia, oportunidade, oportunidade_agro, ir_a_pagar, livre) ou o nome. Com `simular: true` devolve o antes e o depois sem gravar.",
      entrada: () => ({ de: texto(80).min(1), para: texto(80).min(1), valor: positivo, data: dataOpc, descricao: texto(160).optional(),
        simular: z.boolean().default(false).describe("true: mostra o efeito e não grava") }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        let e = await carrega(ctx, { comMercado: true, comProventos: true });
        if (!e.dados.potes) {
          if (a.simular) throw new ErroMcp(FC.db.temTabela("potes") ? "A conta ainda não tem potes; mova sem simular para criar os padrões." : MIGRATION("0002", "potes"));
          await garantePotes(ctx, e);
          e = await carrega(ctx, { comMercado: true, comProventos: true });
        }
        let t;
        try { t = FC.potes.transferencia(e.dados.potes, a); } catch (x) { throw new ErroMcp(x.message); }
        const antes = { origem: n2(t.origem.saldo), destino: n2(t.destino.saldo), patrimonio: n2(e.dados.resumo.patrimonio) };
        const depois = { origem: n2(t.origem.saldo - t.valor), destino: n2(t.destino.saldo + t.valor), patrimonio: n2(e.dados.resumo.patrimonio) };
        const efeito = { de: t.origem.nome, para: t.destino.nome, valor: n2(t.valor), antes, depois };
        if (a.simular) return { simulado: true, ...efeito };
        for (const l of t.linhas) await grava(() => FC.db.inserir("potes_movimentos", l));
        await audita(ctx, "mcp_potes", { de: t.origem.id, para: t.destino.id, valor: t.valor, transferencia_id: t.linhas[0].transferencia_id });
        return { ok: true, ...efeito };
      },
    },
    {
      nome: "registrar_movimento_interno",
      titulo: "Registrar um movimento interno (troca sem dinheiro novo)",
      descricao: "Troca um ativo por outro sem dinheiro novo: BNB → ITUB4, cripto → CDB, saldo de pote → ação. Grava a baixa da origem (com resultado realizado pelo preço médio) e a entrada no destino com custo = valor líquido (bruto − custos), ligados pelo mesmo movimento. Não conta como aporte no Salário nem na TIR total. Use `simular: true` para ver o efeito antes; confirme com a pessoa antes de gravar.",
      entrada: () => ({ ...entradaMov(z, { data, positivo, naoNegativo, texto }), simular: z.boolean().default(false).describe("true: mostra o efeito e não grava") }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: true, comProventos: true });
        const p = planejaMov(FC, e, a);
        if (a.simular) return { simulado: true, ...efeitoMov(p.efeito) };
        if (!FC.db.temTabela("movimentos_internos")) throw new ErroMcp(MIGRATION("0003", "movimentos_internos"));
        if (p.linhas.some((l) => l.cadastrar) && !a.destino_classe) throw new ErroMcp(`${a.destino_id} ainda não está cadastrado: informe destino_classe (${CLASSES.join(", ")}).`);
        await grava(() => FC.db.inserir("movimentos_internos", { ...p.registro, ...(a.parcelamento_id ? { parcelamento_id: a.parcelamento_id } : {}) }));
        for (const l of p.linhas) {
          if (l.cadastrar) {
            await grava(() => FC.db.inserir("ativos", { ticker: a.destino_id, classe: a.destino_classe, pilar: PILAR_PADRAO[a.destino_classe], lista: "carteira", quantidade: 0 }));
          }
          await grava(() => FC.db.inserir(l.tabela, l.linha));
        }
        await audita(ctx, "mcp_movimento_interno", { id: p.registro.id, origem: p.efeito.origem, destino: p.efeito.destino, liquido: p.efeito.liquido });
        return { ok: true, movimento_id: p.registro.id, ...efeitoMov(p.efeito) };
      },
    },
    {
      nome: "registrar_despesa",
      titulo: "Registrar uma despesa",
      descricao: "Lança uma despesa do mês (moradia, alimentação, transporte…). `recorrente: true` repete todo mês a partir da data (até `fim`). O custo de vida do Bullz é a média dos últimos 3 meses de despesas. `simular: true` mostra o efeito sem gravar.",
      entrada: () => ({ data: dataOpc, categoria: z.enum(CATEGORIAS_DESPESA), valor: positivo, descricao: texto(160).optional(),
        recorrente: z.boolean().default(false), fim: data.optional(), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const dia = a.data || FC.datas.hoje(), mes = dia.slice(0, 7);
        const linha = { data: dia, categoria: a.categoria, valor: a.valor, descricao: a.descricao || "", recorrente: a.recorrente, ...(a.fim ? { fim: a.fim } : {}) };
        const antes = FC.rendaMes.despesasDoMes(e.base.despesas || [], mes).total;
        const efeito = { mes, despesas_do_mes_antes: n2(antes), despesas_do_mes_depois: n2(antes + a.valor) };
        if (a.simular) return { simulado: true, registro: linha, ...efeito };
        if (!FC.db.temTabela("despesas")) throw new ErroMcp(MIGRATION("0005", "despesas"));
        const salvo = await grava(() => FC.db.inserir("despesas", linha));
        await audita(ctx, "mcp_lancamento", { tabela: "despesas", id: salvo.id, valor: a.valor, data: dia });
        return { ok: true, tabela: "despesas", registro: enxuga(sem(salvo)), ...efeito };
      },
    },
    {
      nome: "registrar_parcelamento",
      titulo: "Programar um aporte parcelado",
      descricao: "Divide um valor em N parcelas mensais que saem de um pote para um destino (ativo, título ou pote). Cada mês aparece uma parcela pendente em salario_e_plano; executar a parcela é um movimento interno (não é aporte novo). `inicio` é o mês da 1ª parcela. `simular: true` não grava.",
      entrada: () => ({ descricao: texto(160).optional(), valor_total: positivo, n_parcelas: z.number().int().min(1).max(120), inicio: data,
        destino_tipo: z.enum(["ativo", "titulo_rf", "pote"]), destino_id: texto(80).min(1), pote: texto(80).min(1).describe("pote de onde sai (tipo, nome ou id)"),
        simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const pts = e.dados.potes;
        const pote = pts && pts.potes.find((p) => p.id === a.pote || p.tipo === a.pote || String(p.nome).toLowerCase() === a.pote.toLowerCase());
        if (!pote) throw new ErroMcp(`Pote "${a.pote}" não encontrado.`);
        const linha = { descricao: a.descricao || "", valor_total: a.valor_total, n_parcelas: a.n_parcelas, inicio: a.inicio, destino_tipo: a.destino_tipo, destino_id: a.destino_id, pote_id: pote.id };
        const efeito = { parcela: n2(a.valor_total / a.n_parcelas), de: pote.nome, para: a.destino_id, primeira: a.inicio.slice(0, 7) };
        if (a.simular) return { simulado: true, registro: linha, ...efeito };
        if (!FC.db.temTabela("parcelamentos")) throw new ErroMcp(MIGRATION("0005", "parcelamentos"));
        const salvo = await grava(() => FC.db.inserir("parcelamentos", linha));
        await audita(ctx, "mcp_cadastro", { tabela: "parcelamentos", id: salvo.id });
        return { ok: true, tabela: "parcelamentos", registro: enxuga(sem(salvo)), ...efeito };
      },
    },
    {
      nome: "configurar_alocacao",
      titulo: "Configurar o modo de alocação",
      descricao: "Escolhe entre `metas_fixas` (metas por pilar, como sempre) e `hierarquia` (RF › Ações › Cripto com faixas: RF 45–70% com piso de 40%, Ações 22–38% e nunca acima da RF, Cripto 5–17% e nunca acima de Ações). Faixas e meses de reserva para renda PJ são opcionais. `simular: true` mostra a avaliação da carteira e do plano sem gravar.",
      entrada: () => ({ modo_alocacao: z.enum(["metas_fixas", "hierarquia"]),
        faixas: z.object({ rf: z.object({ min: z.number(), max: z.number(), piso: z.number() }).strict(), acoes: z.object({ min: z.number(), max: z.number() }).strict(),
          cripto: z.object({ min: z.number(), max: z.number() }).strict() }).strict().optional(),
        meses_reserva_pj: z.number().int().min(1).max(36).optional(), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: true });
        const nova = { ...e.prefs.hierarquia, modo_alocacao: a.modo_alocacao, ...(a.faixas ? { faixas: a.faixas } : {}), ...(a.meses_reserva_pj ? { meses_reserva_pj: a.meses_reserva_pj } : {}) };
        const f = nova.faixas;
        if (f.rf.min > f.rf.max || f.acoes.min > f.acoes.max || f.cripto.min > f.cripto.max) throw new ErroMcp("Faixa com mínimo acima do máximo.");
        if (!FC.hierarquia.maisProxima({ rf: 0, acoes: 0, cripto: 0 }, f)) throw new ErroMcp("Nenhuma divisão cabe nessas faixas somando 100%.");
        const avaliacao = hierarquiaResumo(FC, { ...e, prefs: { ...e.prefs, hierarquia: nova } });
        if (a.simular) return { simulado: true, hierarquia: nova, ...avaliacao };
        await grava(() => FC.db.gravaPrefs({ hierarquia: nova }));
        await audita(ctx, "mcp_metas", { hierarquia: nova });
        return { ok: true, hierarquia: nova, ...avaliacao };
      },
    },
    {
      nome: "registrar_evento",
      titulo: "Registrar um evento futuro",
      descricao: "Guarda um evento que muda as projeções: venda_agro (valor, cabecas), mudanca_renda (aporte_mensal a partir da data), aporte_extra (valor, destino) ou resgate (valor). `simular: true` devolve o total projetado no mês do evento com e sem ele, sem gravar.",
      entrada: () => ({ ...entradaEvento(z, { data, naoNegativo, texto }), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const ev = eventoDe(a);
        const e = await carrega(ctx, { comMercado: true });
        const atual = FC.datas.hoje().slice(0, 7);
        const [ay, am] = atual.split("-").map(Number), [ey, em] = a.data.slice(0, 7).split("-").map(Number);
        const meses = Math.max(1, Math.min(600, (ey - ay) * 12 + (em - am)));
        const semEv = FC.projecaoMensal.projeta(e, { meses }).final, comEv = FC.projecaoMensal.projeta(e, { meses, eventos: [ev] }).final;
        const efeito = { no_mes: comEv.mes, total_sem_o_evento: n2(semEv.total), total_com_o_evento: n2(comEv.total), diferenca: n2(comEv.total - semEv.total), estimativa: true };
        if (a.simular) return { simulado: true, evento: ev, ...efeito };
        if (!FC.db.temTabela("eventos_futuros")) throw new ErroMcp(MIGRATION("0007", "eventos_futuros"));
        const salvo = await grava(() => FC.db.inserir("eventos_futuros", ev));
        await audita(ctx, "mcp_cadastro", { tabela: "eventos_futuros", id: salvo.id, tipo: a.tipo });
        return { ok: true, tabela: "eventos_futuros", registro: enxuga(sem(salvo)), ...efeito };
      },
    },
    {
      nome: "gerar_plano_mensal",
      titulo: "Gerar o plano de um mês",
      descricao: "Cria o rascunho do plano de um mês a partir dos ganhos previstos (com proporcional e eventos), impostos, despesas (média de 3 meses), o modo do plano global, a divisão sugerida pela hierarquia e pela reserva, as parcelas pendentes e os ativos de maior nota (sem cotação quebrada). Mostra de onde vem cada número e o desvio do mês anterior. Se já existe plano para o mês, devolve o existente. `simular: true` não grava.",
      entrada: () => ({ mes: MES(z), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: true });
        const ja = planoDoMesSalvo(e, a.mes);
        if (ja) return { existente: true, ...resumoPlanoMensal(FC, e, ja, true) };
        const r = FC.planoMensal.gera(e, a.mes);
        if (a.simular) return { simulado: true, ...resumoPlanoMensal(FC, e, r, true) };
        const salvo = await salvaPlano(ctx, r);
        await audita(ctx, "mcp_plano_mensal", { mes: a.mes, acao: "gerar", id: salvo.id });
        return { ok: true, ...resumoPlanoMensal(FC, e, { ...r, ...salvo }, true) };
      },
    },
    {
      nome: "editar_plano_mensal",
      titulo: "Editar o rascunho do plano do mês",
      descricao: "Ajusta um rascunho: destinos (lista completa, com tipo categoria|ativo|titulo_rf|pote|parcela, alvo, pct e valor), meta_total, valor_fixo e observação. Só rascunho: plano ativo ou fechado só muda depois de reabrir. A divisão é validada pela hierarquia (aviso, a trava fica na ativação). `simular: true` não grava.",
      entrada: () => ({ mes: MES(z), destinos: z.array(entradaDestino(z, texto)).max(30).optional(), meta_total: naoNegativo.optional(),
        valor_fixo: naoNegativo.optional(), observacao: texto(300).optional(), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const p = planoDoMesSalvo(e, a.mes);
        if (!p) throw new ErroMcp(`Não há rascunho para ${a.mes}: gere com gerar_plano_mensal.`);
        if (p.status !== "rascunho") throw new ErroMcp(`O plano de ${a.mes} está ${p.status}: só o rascunho é editável (reabra se precisar).`);
        const mud = { ...(a.destinos ? { destinos: a.destinos.map((d) => ({ ...d, pct: d.pct ?? null })) } : {}), ...(a.meta_total != null ? { meta_total: a.meta_total } : {}),
          ...(a.valor_fixo != null ? { valor_fixo: a.valor_fixo } : {}), ...(a.observacao != null ? { observacao: a.observacao } : {}), origem: "manual" };
        const novo = { ...p, ...mud };
        const v = FC.planoMensal.validaDivisao(novo, e);
        const aviso = v.ok ? null : { violacoes: v.violacoes.map((x) => x.texto), divisao_valida_mais_proxima: v.mais_proxima };
        if (a.simular) return { simulado: true, ...resumoPlanoMensal(FC, e, novo, true), ...(aviso ? { alerta_hierarquia: aviso } : {}) };
        await salvaPlano(ctx, mud, p.id);
        await audita(ctx, "mcp_plano_mensal", { mes: a.mes, acao: "editar", campos: Object.keys(mud) });
        return { ok: true, ...resumoPlanoMensal(FC, e, novo, true), ...(aviso ? { alerta_hierarquia: aviso } : {}) };
      },
    },
    {
      nome: "ativar_plano_mensal",
      titulo: "Ativar o plano do mês",
      descricao: "Congela o rascunho: previsto, destinos e o retrato das regras (faixas, reserva, carteira). Depois disso mudar as preferências não altera o mês. Se a divisão viola a hierarquia, só ativa com `aceitar_violacao: true` (fica registrado). Um mês ativo por vez: se outro estiver ativo, ele é fechado antes, com aviso. `simular: true` não grava.",
      entrada: () => ({ mes: MES(z), aceitar_violacao: z.boolean().default(false), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: true });
        const p = planoDoMesSalvo(e, a.mes);
        if (!p) throw new ErroMcp(`Não há rascunho para ${a.mes}.`);
        if (p.status !== "rascunho") throw new ErroMcp(`O plano de ${a.mes} já está ${p.status}.`);
        const v = FC.planoMensal.validaDivisao(p, e);
        if (!v.ok && !a.aceitar_violacao) {
          const m = v.mais_proxima;
          throw new ErroMcp(`A divisão viola a hierarquia: ${v.violacoes.map((x) => x.texto).join("; ")}. A válida mais próxima é RF ${n2(m.rf)}%, Ações ${n2(m.acoes)}%, Cripto ${n2(m.cripto)}%. Ajuste com editar_plano_mensal ou ative com aceitar_violacao: true.`);
        }
        const outro = (e.base.planosMensais || []).find((x) => x.status === "ativo" && x.mes !== a.mes);
        const avisos = outro ? [`O plano de ${outro.mes} estava ativo e foi fechado antes.`] : [];
        const snap = FC.planoMensal.snapshot(e, v, a.aceitar_violacao);
        if (a.simular) return { simulado: true, avisos, regras_snapshot: enxuga(snap, 100), ...resumoPlanoMensal(FC, e, p) };
        if (outro) {
          await salvaPlano(ctx, { status: "fechado", fechado_em: new Date().toISOString(), ...FC.planoMensal.realizado(outro, e) }, outro.id);
          await logPlano(ctx, outro.id, "fechar", `fechado ao ativar ${a.mes}`);
        }
        await salvaPlano(ctx, { status: "ativo", ativado_em: new Date().toISOString(), regras_snapshot: snap }, p.id);
        await logPlano(ctx, p.id, "ativar", a.aceitar_violacao && !v.ok ? "ativado aceitando a violação da hierarquia" : "");
        await audita(ctx, "mcp_plano_mensal", { mes: a.mes, acao: "ativar", aceitar_violacao: a.aceitar_violacao });
        return { ok: true, avisos, ...resumoPlanoMensal(FC, e, { ...p, status: "ativo", regras_snapshot: snap }) };
      },
    },
    {
      nome: "fechar_plano_mensal",
      titulo: "Fechar o plano do mês",
      descricao: "Apura o realizado (renda, impostos, despesas, sobra, aportado, execução por destino e fora do plano) e fecha o mês. Depois de fechado, só muda reabrindo. O agendamento fecha sozinho no dia 1º do mês seguinte. `simular: true` mostra a apuração sem gravar.",
      entrada: () => ({ mes: MES(z), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const p = planoDoMesSalvo(e, a.mes);
        if (!p) throw new ErroMcp(`Não há plano para ${a.mes}.`);
        if (p.status === "fechado" && !(p.contexto && p.contexto.apurar)) throw new ErroMcp(`O plano de ${a.mes} já está fechado.`);
        const rz = FC.planoMensal.realizado(p, e);
        const novo = { ...p, ...rz, status: "fechado" };
        if (a.simular) return { simulado: true, ...resumoPlanoMensal(FC, e, novo, true) };
        const { apurar, ...ctxSem } = p.contexto || {};
        await salvaPlano(ctx, { ...rz, status: "fechado", fechado_em: p.fechado_em || new Date().toISOString(), contexto: ctxSem }, p.id);
        await logPlano(ctx, p.id, "fechar", "");
        await audita(ctx, "mcp_plano_mensal", { mes: a.mes, acao: "fechar" });
        return { ok: true, ...resumoPlanoMensal(FC, e, novo, true) };
      },
    },
    {
      nome: "reabrir_plano_mensal",
      titulo: "Reabrir o plano de um mês",
      descricao: "Reabre um plano fechado (volta a ativo) para corrigir algo. Exige um motivo, que fica no log do mês. `simular: true` não grava.",
      entrada: () => ({ mes: MES(z), motivo: texto(300).min(3), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const p = planoDoMesSalvo(e, a.mes);
        if (!p || p.status !== "fechado") throw new ErroMcp(`Não há plano fechado para ${a.mes}.`);
        const outro = (e.base.planosMensais || []).find((x) => x.status === "ativo");
        if (outro) throw new ErroMcp(`O plano de ${outro.mes} está ativo; feche-o antes de reabrir ${a.mes} (um mês ativo por vez).`);
        if (a.simular) return { simulado: true, mes: a.mes, de: "fechado", para: "ativo", motivo: a.motivo };
        await salvaPlano(ctx, { status: "ativo", fechado_em: null }, p.id);
        await logPlano(ctx, p.id, "reabrir", a.motivo);
        await audita(ctx, "mcp_plano_mensal", { mes: a.mes, acao: "reabrir", motivo: a.motivo });
        return { ok: true, mes: a.mes, status: "ativo", motivo: a.motivo };
      },
    },
    {
      nome: "reconstruir_planos_mensais",
      titulo: "Reconstruir planos de meses passados",
      descricao: "Backfill: para cada mês passado com dados e sem plano salvo, reconstrói o plano como fechado (origem reconstruido) pelos ganhos e lançamentos daquele mês e o plano global. Mês que já tem plano fica como está. `simular: true` não grava.",
      entrada: () => ({ meses: z.array(MES(z)).min(1).max(24), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        const e = await carrega(ctx, { comMercado: false });
        const atual = FC.datas.hoje().slice(0, 7);
        const saida = [];
        for (const mes of a.meses) {
          if (mes > atual) { saida.push({ mes, pulado: "mês futuro" }); continue; }
          if (planoDoMesSalvo(e, mes)) { saida.push({ mes, pulado: "já tem plano" }); continue; }
          const r = FC.planoMensal.reconstroi(e, mes);
          if (!a.simular) { const salvo = await salvaPlano(ctx, r); r.id = salvo.id; (e.base.planosMensais = e.base.planosMensais || []).push({ ...r, ...salvo }); }
          saida.push(resumoPlanoMensal(FC, e, r, true));
        }
        if (!a.simular) await audita(ctx, "mcp_plano_mensal", { acao: "reconstruir", meses: a.meses });
        return { ...(a.simular ? { simulado: true } : { ok: true }), planos: saida };
      },
    },
    {
      nome: "criar_alerta_preco",
      titulo: "Criar um alerta de preço",
      descricao: "Avisa quando o preço de um ativo da carteira passar de um valor (`acima`), cair abaixo dele (`abaixo`) ou voltar ao preço médio da posição (`empate`, sem valor). O aviso aparece nos alertas do app; o agendamento avalia depois de cada registro diário de cotações. `simular: true` mostra se dispararia hoje, sem gravar.",
      entrada: () => ({ ticker, condicao: z.enum(["acima", "abaixo", "empate"]), valor: positivo.optional().describe("acima e abaixo: o preço alvo"), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        if (a.condicao !== "empate" && !a.valor) throw new ErroMcp("Informe o valor do alerta (acima ou abaixo).");
        const e = await carrega(ctx, { comMercado: true });
        const at = e.dados.ativos.find((x) => x.ticker === a.ticker);
        if (!at) throw new ErroMcp(`${a.ticker} não está cadastrado.`);
        if (a.condicao === "empate" && !(at.posicao && at.posicao.preco_medio > 0)) throw new ErroMcp(`${a.ticker} não tem preço médio: o alerta de empate precisa dele.`);
        const linha = { ticker: a.ticker, condicao: a.condicao, valor: a.condicao === "empate" ? null : a.valor, ligado: true };
        const r = FC.alertasPreco.dispara(linha, at.preco, at.posicao ? at.posicao.preco_medio : null);
        const efeito = { alvo: np(r.alvo), preco_agora: np(at.preco), dispararia_hoje: r.dispara };
        if (a.simular) return { simulado: true, registro: linha, ...efeito };
        if (!FC.db.temTabela("alertas_preco")) throw new ErroMcp(MIGRATION("0009", "alertas_preco"));
        const salvo = await grava(() => FC.db.inserir("alertas_preco", linha));
        await audita(ctx, "mcp_cadastro", { tabela: "alertas_preco", id: salvo.id, ticker: a.ticker });
        return { ok: true, tabela: "alertas_preco", registro: enxuga(sem(salvo)), ...efeito };
      },
    },
    {
      nome: "criar_revisao",
      titulo: "Programar uma revisão",
      descricao: "Agenda uma pergunta para rever um ativo ou um tema numa data (ex.: \"o BNB ainda faz sentido?\" em 01/03). Na data, ela aparece nos alertas do resumo até ser marcada como feita (editar_registro, tabela revisoes, campo feita). `simular: true` não grava.",
      entrada: () => ({ ticker: ticker.optional(), tema: texto(80).optional(), data, pergunta: texto(300).min(3), simular: z.boolean().default(false) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        if (!a.simular) exigeEscrita(ctx);
        if (!a.ticker && !a.tema) throw new ErroMcp("Informe o ticker ou o tema da revisão.");
        const linha = { ticker: a.ticker || null, tema: a.tema || null, data: a.data, pergunta: a.pergunta, feita: false };
        if (a.simular) return { simulado: true, registro: linha, aparece_em: a.data };
        if (!FC.db.temTabela("revisoes")) throw new ErroMcp(MIGRATION("0009", "revisoes"));
        const salvo = await grava(() => FC.db.inserir("revisoes", linha));
        await audita(ctx, "mcp_cadastro", { tabela: "revisoes", id: salvo.id });
        return { ok: true, tabela: "revisoes", registro: enxuga(sem(salvo)), aparece_em: a.data };
      },
    },
    {
      nome: "editar_registro",
      titulo: "Corrigir um registro",
      descricao: `Altera campos de um registro existente, pelo id que as ferramentas de listagem devolvem. Tabelas: ${TABELAS.join(", ")}. Informe em \`campos\` só o que muda. Numa venda, quantidade e valor são negativos.`,
      entrada: () => ({ tabela: z.enum(TABELAS), id: z.union([z.string().min(1), z.number().int()]), campos: z.record(z.string(), z.unknown()) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const mudancas = valida(z, campos[a.tabela], a.campos, true);
        if (!Object.keys(mudancas).length) throw new ErroMcp("Nada para atualizar: informe ao menos um campo em `campos`.");
        const salvo = await grava(() => FC.db.atualizar(a.tabela, a.id, mudancas));
        await audita(ctx, "mcp_edicao", { tabela: a.tabela, id: a.id, campos: Object.keys(mudancas) });
        return { ok: true, tabela: a.tabela, registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "apagar_registro",
      titulo: "Apagar um registro",
      descricao: `Apaga UM registro, pelo id. Não tem volta. Tabelas: ${TABELAS.join(", ")}. Apagar um ativo ou um título não apaga os lançamentos dele. Mostre à pessoa o que vai ser apagado e peça a confirmação antes de chamar.`,
      destrutiva: true,
      entrada: () => ({ tabela: z.enum(TABELAS), id: z.union([z.string().min(1), z.number().int()]) }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const apagados = await grava(async () => {
          const { data: linhas, error } = await FC.sb.from(a.tabela).delete().eq("id", a.id).select();
          if (error) throw error;
          return linhas || [];
        });
        if (!apagados.length) throw new ErroMcp("Registro não encontrado (ou esta conexão não pode apagá-lo). Nada foi apagado.");
        await audita(ctx, "mcp_exclusao", { tabela: a.tabela, id: a.id, registro: enxuga(sem(apagados[0])) });
        return { ok: true, tabela: a.tabela, apagado: enxuga(sem(apagados[0])) };
      },
    },
  ];

  return [
    ...LEITURA.map((f) => ({ ...f, escreve: false, destrutiva: false })),
    ...ESCRITA.map((f) => ({ destrutiva: false, ...f, escreve: true })),
  ];
}

// o dono já sabe quem é: user_id não acrescenta nada à resposta
function sem(linha) { const { user_id, ...resto } = linha || {}; return resto; }
