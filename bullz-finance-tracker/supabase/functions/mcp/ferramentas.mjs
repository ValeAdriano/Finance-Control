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
import { CLASSES, PILARES, LISTAS, TIPOS_RF, INDEXADORES, CATEGORIAS_GANHO, TIPOS_GANHO, REGRAS_DIA, TIPOS_MOV,
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
        if (f.especie === "todos" || f.especie === "movimentos") s.movimentos = pega(e.base.agro.movs, "agro_movimentos");
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
        return {
          mes, renda: enxuga(plano.renda), plano_configurado: enxuga(e.prefs.plano),
          plano_do_mes: { a_investir: n2(plano.total), ja_aportado: n2(plano.aportado), falta: n2(plano.falta), sobra_da_renda: n2(plano.sobra_renda), destinos: enxuga(plano.destinos) },
          ganhos: e.base.ganhos.map((g) => ({ id: g.id, nome: g.nome, categoria: g.categoria, tipo: g.tipo, valor: n2(g.valor), inicio: g.inicio, fim: g.fim || null,
            data_fim_contrato: g.data_fim_contrato || null, data_ultimo_pagamento: g.data_ultimo_pagamento || null,
            dia_regra: g.dia_regra || null, dia_numero: g.dia_numero ?? null, observacao: g.observacao || "" })),
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
        data_ultimo_pagamento: data.nullable().optional().describe("recorrente: a data do último pagamento; vale no lugar de `fim` para a renda do mês") }),
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
            ...(a.tipo === "recorrente" && a.data_ultimo_pagamento ? { data_ultimo_pagamento: a.data_ultimo_pagamento } : {}) }));
        }
        await audita(ctx, id ? "mcp_edicao" : "mcp_cadastro", { tabela: "ganhos", id: salvo.id, nome: salvo.nome });
        return { ok: true, criado: !id, tabela: "ganhos", registro: enxuga(sem(salvo)) };
      },
    },
    {
      nome: "registrar_agro",
      titulo: "Registrar movimento, custo ou pesagem do gado",
      descricao: "Lança no agro. movimento: `tipo` (compra, venda, nascimento, morte, entrada, saida, reclassificacao), `categoria`, `cabecas` e, em compra e venda, o preço (`preco_arroba` com `peso_medio_kg`, ou `preco_cabeca`, ou `valor_total`). custo: `categoria_custo` e `valor`. pesagem: `categoria`, `cabecas` e `peso_medio_kg`.",
      entrada: () => ({
        especie: z.enum(["movimento", "custo", "pesagem"]),
        data: dataOpc.describe("AAAA-MM-DD (padrão: hoje)"),
        tipo: z.enum(TIPOS_MOV).optional(), categoria: z.enum(CATEGORIAS_GADO).optional(), categoria_destino: z.enum(CATEGORIAS_GADO).optional().describe("só em reclassificacao"),
        cabecas: z.number().int().positive().optional(), peso_medio_kg: positivo.optional(),
        preco_arroba: naoNegativo.optional(), preco_cabeca: naoNegativo.optional(), valor_total: naoNegativo.optional(),
        despesas: naoNegativo.optional().describe("frete, comissão, Funrural da operação"),
        reinvestido: naoNegativo.optional().describe("venda: quanto do líquido fica no agro para as próximas compras"),
        categoria_custo: z.enum(CATEGORIAS_CUSTO).optional(), valor: positivo.optional().describe("custo: o valor pago"), descricao: texto(160).optional(),
        fazenda: texto(80).optional(), lote: texto(80).optional(), contraparte: texto(80).optional(), observacao: texto(160).optional(),
      }),
      async executa(ctx, a) {
        const { FC } = ctx;
        exigeEscrita(ctx);
        const dia = a.data || FC.datas.hoje();
        let tabela, linha;
        if (a.especie === "custo") {
          if (!a.categoria_custo || !a.valor) throw new ErroMcp("Custo: informe categoria_custo e valor.");
          tabela = "agro_custos";
          linha = { data: dia, categoria: a.categoria_custo, descricao: a.descricao || "", valor: a.valor, fazenda: a.fazenda || null, lote: a.lote || null };
        } else if (a.especie === "pesagem") {
          if (!a.categoria || !a.cabecas || !a.peso_medio_kg) throw new ErroMcp("Pesagem: informe categoria, cabecas e peso_medio_kg.");
          tabela = "agro_pesagens";
          linha = { data: dia, categoria: a.categoria, lote: a.lote || null, fazenda: a.fazenda || null, cabecas: a.cabecas, peso_medio_kg: a.peso_medio_kg, observacao: a.observacao || "" };
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
          tabela = "agro_movimentos";
          linha = { data: dia, tipo: a.tipo, categoria: a.categoria, categoria_destino: a.tipo === "reclassificacao" ? a.categoria_destino : null, cabecas: a.cabecas,
            peso_medio_kg: a.peso_medio_kg ?? null, preco_arroba: modo === "arroba" ? a.preco_arroba : null, preco_cabeca: modo === "cabeca" ? a.preco_cabeca : null,
            valor_total: Math.round(total * 100) / 100, despesas: comPreco ? a.despesas || 0 : 0, reinvestido: a.tipo === "venda" ? a.reinvestido ?? null : null,
            fazenda: a.fazenda || null, lote: a.lote || null, contraparte: comPreco ? a.contraparte || null : null, observacao: a.observacao || "" };
        }
        const salvo = await grava(() => FC.db.inserir(tabela, linha));
        await audita(ctx, "mcp_lancamento", { tabela, id: salvo.id, especie: a.especie, data: dia });
        return { ok: true, tabela, registro: enxuga(sem(salvo)) };
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
