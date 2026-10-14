/* Casca do app: sessão, estado, mercado e carregamento — port do app.js.
 *
 * O estado de verdade continua sendo o objeto mutável `FC.estado`, com a mesma
 * forma do site (base, prefs, mercado, dados, perfil…), porque os modelos e as
 * peças compartilhadas leem dele. O Zustand aqui só guarda o que a interface
 * precisa observar (fase da sessão, privado, carregando) e um contador `versao`
 * que `FC.rerender()` incrementa — é o "repinta" do app.
 *
 * Fluxo (igual ao site): sem sessão → login. Com sessão → abre com o cache
 * local em blur, carrega as tabelas (rápido), pinta e só então busca o mercado
 * (lento), repintando quando chega. */
import { create } from "zustand";
import { AppState } from "react-native";
import FC from "../nucleo";

export type Fase = "iniciando" | "login" | "mfa" | "app";

interface EstadoUI {
  versao: number;
  fase: Fase;
  avisoLogin: string | null;
  privado: boolean;
  carregandoDados: boolean;
  carregandoMercado: boolean;
  admin: boolean;
}

export const useApp = create<EstadoUI>(() => ({
  versao: 0,
  fase: "iniciando",
  avisoLogin: null,
  privado: !!FC.local.ler("privado", false),
  carregandoDados: false,
  carregandoMercado: false,
  admin: false,
}));

/** repinta: toda tela que usa `useEstado()` renderiza de novo */
export function rerender() {
  useApp.setState((s) => ({ versao: s.versao + 1, carregandoMercado: !!estado.carregandoMercado, admin: !!estado.admin }));
}

/** `FC.estado` observado: re-renderiza a cada `rerender()`. */
export function useEstado(): any {
  useApp((s) => s.versao);
  return FC.estado;
}

// ---------------------------------------------------------------- rotas
export interface Rota { id: string; nome: string; icone: string; oculta?: boolean }
export const ROTAS: Rota[] = [
  { id: "inicio", nome: "Início", icone: "inicio" },
  { id: "ativos", nome: "Investimentos", icone: "ativos" },
  { id: "agro", nome: "Agro", icone: "agro" },
  { id: "aportes", nome: "Aportes", icone: "aportes" },
  { id: "dividendos", nome: "Dividendos", icone: "moeda" },
  { id: "irpf", nome: "Imposto de renda", icone: "recibo" },
  { id: "salario", nome: "Salário", icone: "carteira" },
  { id: "renda", nome: "Renda", icone: "renda" },
  { id: "simular", nome: "Simular", icone: "simular" },
  { id: "projecoes", nome: "Projeções", icone: "projecoes" },
  { id: "ajustes", nome: "Ajustes", icone: "ajustes", oculta: true },
  { id: "retrospectiva", nome: "Retrospectiva", icone: "play", oculta: true },
  { id: "perfil", nome: "Perfil do investidor", icone: "bussola", oculta: true },
  { id: "admin", nome: "Administração", icone: "escudo", oculta: true },
];
FC.ROTAS = ROTAS;

// layout salvo (preferencias.layout) resolvido contra o que está ligado agora:
// a ordem do topo e as 4 primeiras abas, que formam a barra do celular
export const layoutAtual = () =>
  FC.layout.resolve(((FC.estado || {}).prefs || {}).layout, { rotas: ROTAS, ligada: FC.rotaLigada });
FC.layoutAtual = layoutAtual;

export function rotasLigadas(): Rota[] {
  const ordem: string[] = layoutAtual().nav.ordem;
  const pos = (id: string) => { const k = ordem.indexOf(id); return k < 0 ? 1e6 : k; };
  return ROTAS.filter((x) => FC.rotaLigada(x.id) && (x.id !== "admin" || estado.admin)).sort((a, b) => pos(a.id) - pos(b.id));
}
export const noCelular = (): string[] => layoutAtual().nav.celular;

/** a rota pedida, se ligada (senão, o Início) — mesma regra do site */
export function rotaValida(id: string): string {
  return ROTAS.some((r) => r.id === id) && FC.rotaLigada(id) && (id !== "admin" || estado.admin) ? id : "inicio";
}

// ---------------------------------------------------------------- estado
const estado: any = (FC.estado = {
  base: null, prefs: null, mercado: { universo: null, historicos: {}, spot: {} }, dados: null,
  carregandoMercado: false, erroMercado: null, spotEm: null, proventos: null, proventosEm: null,
});

// proventos dos ativos que pagam dividendo (carteira e o que já teve aporte)
FC.carregaProventos = async function (forcar = false) {
  if (!estado.base) return null;
  const itens = estado.base.ativos.filter((a: any) => a.classe !== "cripto").map((a: any) => ({ ticker: a.ticker, classe: a.classe }));
  if (!itens.length) { estado.proventos = {}; return estado.proventos; }
  if (!forcar && estado.proventos && Date.now() - estado.proventosEm < 30 * 60 * 1000
      && itens.every((i: any) => estado.proventos[i.ticker])) return estado.proventos;
  try {
    estado.proventos = { ...(estado.proventos || {}), ...(await FC.mercado.proventos(itens, forcar)) };
    estado.proventosEm = Date.now();
    FC.recalcula(); // proventos pagos entram na rentabilidade de cada ativo
    rerender();
  } catch (e) { console.error(e); estado.proventos = estado.proventos || {}; }
  return estado.proventos;
};

// ---------------------------------------------------------------- preferências
FC.montaPrefs = function (brutas: any) {
  return {
    alocacao_alvo: { ...FC.PADRAO_ALOCACAO, ...(brutas.alocacao_alvo || {}) },
    premissas: FC.mescla(FC.PADRAO_PREMISSAS, brutas.premissas),
    // objetivos e dados dos títulos moram no mesmo jsonb, mas não são premissas da projeção
    premissas_salvas: !!brutas.premissas && Object.keys(brutas.premissas).some((k) => k !== "objetivos" && k !== "titulos"),
    regras: brutas.regras ? FC.mescla(FC.PADRAO_REGRAS, brutas.regras) : JSON.parse(JSON.stringify(FC.PADRAO_REGRAS)),
    renda: brutas.renda || JSON.parse(JSON.stringify(FC.PADRAO_RENDA)),
    agro: FC.mescla(FC.PADRAO_AGRO, brutas.agro),
    plano: FC.mescla(FC.PADRAO_PLANO, brutas.plano),
    layout: brutas.layout || null,
  };
};

FC.recalcula = function () {
  if (!estado.base) return;
  estado.dados = FC.carteira.monta(estado.base, estado.mercado, estado.prefs);
};

FC.recarregaBase = async function () {
  estado.base = await FC.db.carregaTudo();
  estado.prefs = FC.montaPrefs(estado.base.prefsBrutas);
  estado.prefs.modulos = FC.resolveModulos(estado.base.prefsBrutas.modulos, estado.base);
  FC.recalcula();
};

// tickers cujo histórico interessa: carteira, watchlist e o que aparece
// nos aportes (para o gráfico de crescimento do patrimônio)
function itensDeMercado() {
  const m = new Map<string, any>();
  for (const a of estado.base.ativos) m.set(a.ticker, { ticker: a.ticker, classe: a.classe });
  for (const a of estado.base.aportes) {
    if (a.tipo === "ativo" && a.ticker && !m.has(a.ticker)) m.set(a.ticker, { ticker: a.ticker, classe: "acao_br" });
  }
  return [...m.values()];
}

function fimDoCarregamentoInicial() {
  if (estado.carregandoInicial) {
    estado.carregandoInicial = false;
    useApp.setState({ carregandoDados: false });
  }
}

FC.carregaMercado = async function (forcar = false) {
  if (estado.carregandoMercado) return;
  estado.carregandoMercado = true;
  estado.erroMercado = null;
  rerender();
  try {
    const anos = estado.prefs.regras.janela_historico_anos || 3;
    const [universo, historicos, indices, cvm] = await Promise.all([
      FC.mercado.universo(forcar),
      FC.mercado.historicos(itensDeMercado(), anos, forcar),
      FC.mercado.indices(forcar).catch((e: any) => { console.error(e); return null; }),
      FC.mercado.fiisCvm(forcar).catch((e: any) => { console.error(e); return null; }),
    ]);
    estado.mercado = { ...estado.mercado, universo, historicos: { ...estado.mercado.historicos, ...historicos } };
    // o raio-x da CVM entra em cada FII do universo (e serve de par para os outros)
    if (cvm && cvm.fundos && universo && universo.fiis) {
      for (const [t, v] of Object.entries<any>(cvm.fundos)) {
        const f = universo.fiis[t];
        if (!f) continue;
        f.cvm = { ...v, fonte: cvm.fonte };
        f.vacancia_financeira = v.vacancia_financeira ?? null;
        f.concentracao = v.tipo === "papel" ? (v.cri || {}).maior : v.tipo === "fof" ? (v.fii || {}).maior
          : v.tipo === "hibrido" ? v.maior_imovel ?? (v.cri || {}).maior ?? null : v.maior_imovel ?? null;
      }
    }
    // sem a série diária (ou com ela incompleta), a renda fixa rende pela
    // taxa anual do Banco Central em vez de ficar parada no valor aplicado
    const reserva = (universo && universo.macro) || {};
    if (indices || (reserva.cdi != null && !(estado.mercado.indices && estado.mercado.indices.tem))) {
      estado.mercado.indices = FC.rentab.preparaIndices(indices || {}, reserva);
    }
    // Ibovespa para as comparações (sem travar o resto)
    if (!estado.bench) FC.mercado.benchmarks(5).then((b: any) => { estado.bench = b; rerender(); }).catch((e: any) => console.error(e));
    await buscaCotacoes();
    FC.recalcula();
    estado.erroMercado = null;
    await gravaRegistroDoDia();
    FC.carregaProventos(forcar);
    if (estado.base) FC.local.gravar("ultimo-cache-base", estado.base);
    FC.local.gravar("ultimo-cache-mercado", { universo: estado.mercado.universo, spot: estado.mercado.spot });
  } catch (e: any) {
    estado.erroMercado = e.message || String(e);
    console.error(e);
  } finally {
    estado.carregandoMercado = false;
    fimDoCarregamentoInicial();
    rerender();
  }
};

// ---------------------------------------------------------------- preço de agora
// A cada minuto, com o app aberto: cripto pelo CoinGecko, bolsa pelo Yahoo.
async function buscaCotacoes() {
  try {
    const itens = estado.base.ativos.map((a: any) => ({ ticker: a.ticker, classe: a.classe }));
    const s = await FC.mercado.cotacoes(itens);
    for (const [t, v] of Object.entries<any>(s)) if (v && !v.erro) estado.mercado.spot[t] = v;
    estado.spotEm = new Date();
    return true;
  } catch (e) { console.error(e); return false; }
}

/** algo está sendo editado (folha aberta, layout em edição): não repintar por baixo */
export const ocupado = { folhas: 0, editandoLayout: false };

let relogio: ReturnType<typeof setInterval> | null = null;
let primeiroPlano = AppState.currentState === "active";
function ligaAtualizacaoAutomatica() {
  if (relogio) clearInterval(relogio);
  relogio = setInterval(async () => {
    if (!primeiroPlano || !estado.base || estado.carregandoMercado || !estado.mercado.universo) return;
    if (!(await buscaCotacoes())) return;
    FC.recalcula();
    gravaRegistroDoDia();
    if (!ocupado.folhas && !ocupado.editandoLayout) rerender();
  }, 60 * 1000);
}

// ---------------------------------------------------------------- registro diário
// Uma foto por dia do patrimônio, cada classe e cada ativo. Grava no máximo a
// cada 15 minutos; no mesmo dia, a mais recente substitui.
let ultimoRegistro = 0;
async function gravaRegistroDoDia(forcar = false) {
  const d = estado.dados;
  if (!d || !estado.mercado.universo || estado.erroMercado) return;
  if (!forcar && Date.now() - ultimoRegistro < 15 * 60 * 1000) return;
  const r = d.resumo;
  if (!(r.patrimonio > 0)) return;
  // se algum ativo da carteira ficou sem preço, a foto sairia menor que a realidade
  if (d.ativos.some((a: any) => a.na_carteira && !a.erro && !FC.ok(a.preco))) return;
  ultimoRegistro = Date.now();
  const hoje = FC.datas.hoje();
  const jaTinha = (estado.base.historico || []).some((h: any) => h.data === hoje);
  const ativos = d.ativos.filter((a: any) => a.posicao).map((a: any) => ({ ticker: a.ticker, classe: a.classe, pilar: a.pilar,
    quantidade: a.posicao.quantidade, preco: a.preco, valor: a.posicao.atual, custo: a.posicao.custo }));
  const linha = { data: hoje, registrado_em: new Date().toISOString(), origem: "app", patrimonio: r.patrimonio,
    renda_variavel: r.bolsa, cripto: r.cripto, renda_fixa: r.renda_fixa, agro: r.agro, investido: r.investido || null,
    por_pilar: Object.fromEntries(d.alocacao.map((l: any) => [l.chave, l.valor])), ativos };
  try {
    const salvo = await FC.db.gravaRegistro(linha);
    const h = estado.base.historico.filter((x: any) => x.data !== hoje);
    h.push({ ...salvo, patrimonio: Number(salvo.patrimonio), renda_variavel: Number(salvo.renda_variavel), cripto: Number(salvo.cripto),
      renda_fixa: Number(salvo.renda_fixa), agro: Number(salvo.agro), investido: salvo.investido == null ? null : Number(salvo.investido) });
    estado.base.historico = h.sort((a: any, b: any) => a.data.localeCompare(b.data));
    d.registros = estado.base.historico;
    if (!jaTinha) FC.db.log("registro_diario", { patrimonio: r.patrimonio, ativos: ativos.length });
  } catch (e) { console.error(e); }
}
FC.gravaRegistroDoDia = gravaRegistroDoDia;

// busca só os históricos que faltam (depois de cadastrar um ativo novo)
FC.completaMercado = async function () {
  const faltam = itensDeMercado().filter((i) => !estado.mercado.historicos[i.ticker]);
  if (!faltam.length || !estado.mercado.universo) { await buscaCotacoes(); FC.recalcula(); gravaRegistroDoDia(true); return; }
  try {
    const h = await FC.mercado.historicos(faltam, estado.prefs.regras.janela_historico_anos || 3);
    Object.assign(estado.mercado.historicos, h);
  } catch (e) { console.error(e); }
  await buscaCotacoes();
  FC.recalcula();
  gravaRegistroDoDia(true);
};

/** atualizar cotações (menu "Mais opções") */
export async function atualizaCotacoes(): Promise<string | null> {
  FC.mercado.limpaCacheLocal();
  await FC.carregaMercado(true);
  if (!estado.erroMercado) {
    gravaRegistroDoDia(true);
    FC.db.log("precos", { manual: true, ativos: estado.base.ativos.length, patrimonio: estado.dados.resumo.patrimonio });
    return null;
  }
  FC.db.log("erro", { etapa: "atualizar cotações", erro: estado.erroMercado });
  return estado.erroMercado;
}

// ---------------------------------------------------------------- privado
export function alternaPrivado() {
  const v = !useApp.getState().privado;
  FC.local.gravar("privado", v);
  useApp.setState({ privado: v });
}
FC.aplicaPrivado = () => useApp.setState({ privado: !!FC.local.ler("privado", false) });

// ---------------------------------------------------------------- repintar
FC.rerender = async () => { rerender(); };

// ---------------------------------------------------------------- sair
function limpaSessaoLocal() {
  estado.admin = false;
  estado.adminVerificado = false;
  estado.base = null; estado.dados = null; estado.perfil = null;
  if (relogio) clearInterval(relogio);
  FC.local.apagar("ultimo-uso");
  FC.local.apagar("ultimo-cache-base");
  FC.local.apagar("ultimo-cache-mercado");
  FC.local.apagar("perfil-venceu-sessao");
  FC.mercado.limpaCacheLocal();
}

FC.sair = async function () {
  if (FC.uso && FC.uso.para) FC.uso.para();
  await FC.auth.sair();
  limpaSessaoLocal();
  useApp.setState({ fase: "login", avisoLogin: null, carregandoDados: false, admin: false });
};

// ---------------------------------------------------------------- sessão de 7 dias
// O login fica guardado neste aparelho e só cai depois de 7 dias SEM USO. O
// Supabase renovaria a sessão para sempre, então o app mede o uso e, passado o
// prazo, encerra a sessão — inclusive o token no Supabase.
const INATIVIDADE_MAX = 7 * 24 * 60 * 60 * 1000;
const CHAVE_USO = "ultimo-uso";
const AVISO_INATIVIDADE = "Sua sessão foi encerrada depois de 7 dias sem uso. Entre de novo.";
let ultimaMarca = 0;
export function marcaUso() {
  const agora = Date.now();
  if (agora - ultimaMarca < 60 * 1000) return; // no máximo 1 gravação por minuto
  ultimaMarca = agora;
  FC.local.gravar(CHAVE_USO, agora);
}
FC.marcaUso = () => { ultimaMarca = 0; marcaUso(); };
function expirou() {
  const u = FC.local.ler(CHAVE_USO, null);
  return u != null && Date.now() - u > INATIVIDADE_MAX;
}
async function encerraPorInatividade() {
  try { await FC.sb.auth.signOut(); } catch { /* já sem sessão */ }
  limpaSessaoLocal();
  useApp.setState({ fase: "login", avisoLogin: AVISO_INATIVIDADE, carregandoDados: false });
}

AppState.addEventListener("change", (st) => {
  const voltou = st === "active" && !primeiroPlano;
  primeiroPlano = st === "active";
  if (!voltou || !estado.base) return;
  if (expirou()) { encerraPorInatividade(); return; }
  marcaUso();
  // voltou para o app depois de um tempo: atualiza as cotações na hora
  if (estado.spotEm && Date.now() - estado.spotEm > 60 * 1000) {
    buscaCotacoes().then((ok) => { if (ok) { FC.recalcula(); rerender(); } });
  }
});
// app esquecido aberto: confere de tempos em tempos
setInterval(() => { if (estado.base && expirou()) encerraPorInatividade(); }, 10 * 60 * 1000);

// ---------------------------------------------------------------- entrar
/** Ganchos de quem depende da casca montada (perfil, onboarding, telemetria). */
export const aoEntrar: Array<() => void | Promise<void>> = [];

FC.entrarNoApp = async function () {
  useApp.setState({ carregandoDados: true });
  estado.carregandoInicial = true;

  // com o cache local da última sessão, a casca abre na hora com os valores em blur
  const cacheBase = FC.local.ler("ultimo-cache-base", null);
  const cacheMercado = FC.local.ler("ultimo-cache-mercado", null);
  if (cacheBase) {
    estado.base = cacheBase;
    estado.prefs = FC.montaPrefs(cacheBase.prefsBrutas || {});
    estado.prefs.modulos = FC.resolveModulos((cacheBase.prefsBrutas || {}).modulos, estado.base);
    if (cacheMercado) {
      estado.mercado = { ...estado.mercado, ...cacheMercado };
      if (estado.mercado.indices && typeof estado.mercado.indices.fator !== "function") estado.mercado.indices = null;
    }
    try {
      FC.recalcula();
      useApp.setState({ fase: "app" });
      rerender();
    } catch (e) { console.warn("Aviso ao inicializar cache local:", e); }
  }

  try {
    const s = await FC.auth.sessao();
    FC.auth.usuario = s.user;
    FC.marcaUso();
    // o painel de admin só aparece para quem o banco reconhece
    const [, adm] = await Promise.all([
      FC.recarregaBase(),
      FC.sb.rpc("eh_admin").then((res: any) => !res.error && res.data === true, () => false),
    ]);
    estado.admin = adm;
    estado.adminVerificado = true;
    if (estado.base) FC.local.gravar("ultimo-cache-base", estado.base);
  } catch (e: any) {
    estado.carregandoInicial = false;
    limpaSessaoLocal();
    useApp.setState({ fase: "login", carregandoDados: false, avisoLogin: FC.ui.traduzErro(e.message || String(e)) });
    return;
  }

  FC.recalcula();
  useApp.setState({ fase: "app" });
  rerender();

  for (const f of aoEntrar) { try { await f(); } catch (e) { console.error(e); } }
  FC.carregaMercado(false);
  ligaAtualizacaoAutomatica();
};

/** abertura do app: decide entre login, código de 2FA e entrar direto */
export async function inicia() {
  // sessão guardada, mas parada há mais de 7 dias: não entra
  if (expirou()) {
    try { await FC.sb.auth.signOut(); } catch { /* segue */ }
    FC.local.apagar(CHAVE_USO);
    useApp.setState({ fase: "login", avisoLogin: AVISO_INATIVIDADE });
    return;
  }
  let s = null;
  try { s = await FC.auth.sessao(); } catch { /* sem sessão */ }
  if (!s) { useApp.setState({ fase: "login" }); return; }
  // com verificação em duas etapas ligada, a sessão só vale depois do código
  try {
    const n = await FC.auth.nivel();
    if (n.nextLevel === "aal2" && n.currentLevel !== "aal2") { useApp.setState({ fase: "mfa" }); return; }
  } catch { /* segue */ }
  FC.entrarNoApp();
}

FC.sb.auth.onAuthStateChange((ev: string) => {
  if (ev === "SIGNED_OUT" && estado.base) {
    limpaSessaoLocal();
    useApp.setState({ fase: "login" });
  }
});

export { estado };
