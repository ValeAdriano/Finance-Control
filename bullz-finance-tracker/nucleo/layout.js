/* Layout personalizável: ordem das abas (topo e barra do celular) e dos
 * blocos do Início. Salvo em preferencias.layout:
 *
 *   { nav: { ordem: [rotaId…] },   // as 4 primeiras formam a barra do celular
 *     inicio: { ordem: [blocoId…], ocultos: [blocoId…] } }
 *
 * Sem "inicio" salvo, os blocos com padraoOculto começam desligados.
 *
 * Sem layout salvo vale o padrão do app. A resolução é pura (recebe as
 * rotas e o que está ligado), então roda igual no navegador e nos testes. */
(function () {
  const FC = window.FC;

  const MAX_CELULAR = 4;

  // blocos do Início, na ordem padrão. fixo: não dá para ocultar.
  // padraoOculto: começa desligado (os blocos de números brutos, que têm o
  // seu lugar nas outras telas); quem já salvou um layout mantém o que tinha.
  FC.LAYOUT_INICIO = [
    { id: "perfil", nome: "Perfil do investidor", desc: "convite, revisão ou plano pronto", icone: "bussola" },
    { id: "topo", nome: "Patrimônio e desempenho", desc: "quanto você tem, a nota da carteira e as metas", icone: "inicio", fixo: true },
    { id: "checklist", nome: "Primeiros passos", desc: "checklist de ativação", icone: "check" },
    { id: "comecar", nome: "Comece por aqui", desc: "só aparece com a carteira vazia", icone: "ativos" },
    { id: "curva", nome: "Curva do patrimônio", desc: "o patrimônio no período, em área", icone: "projecoes" },
    { id: "rosca", nome: "Rosca da alocação", desc: "cada pilar contra a meta", icone: "ativos" },
    { id: "barras_proventos", nome: "Barras de proventos", desc: "o que caiu em cada um dos últimos 12 meses", icone: "presente" },
    { id: "destaques", nome: "Melhores e piores", desc: "os que mais subiram e caíram no período", icone: "ativos" },
    { id: "retrospectivas", nome: "Retrospectivas", desc: "mês e ano em vídeo", icone: "play" },
    { id: "plano_realidade", nome: "Plano contra realidade", desc: "aporte do mês e reserva", icone: "alvo", padraoOculto: true },
    { id: "frase", nome: "Rendeu mais que o CDI?", desc: "comparação com CDI e inflação", icone: "projecoes", padraoOculto: true },
    { id: "detalhes", nome: "Detalhes técnicos", desc: "TIR, retorno por classe e juros do dia", icone: "info", padraoOculto: true },
    { id: "proximos30", nome: "Próximos 30 dias", desc: "vencimentos e proventos", icone: "calendario", padraoOculto: true },
    { id: "renda_passiva", nome: "Renda passiva", desc: "proventos por mês e a meta", icone: "moeda", padraoOculto: true },
    { id: "alocacao", nome: "Alocação por pilar", desc: "carteira contra as metas, em barras", icone: "ativos", padraoOculto: true },
    { id: "crescimento", nome: "Crescimento do patrimônio", desc: "gráfico dia a dia, com Selic e Ibovespa", icone: "projecoes", padraoOculto: true },
    { id: "proventos", nome: "Proventos por mês", desc: "o que a carteira depositou, em tabela", icone: "presente", padraoOculto: true },
    { id: "agro", nome: "Agro", desc: "rebanho resumido", icone: "boi", padraoOculto: true },
    { id: "melhores", nome: "Melhores e piores (lista)", desc: "ativos em destaque, com números", icone: "ativos", padraoOculto: true },
  ];
  const unicos = (l) => [...new Set(l)];
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

  // rotas: [{id, oculta?}] na ordem padrão · ligada(id): módulo ligado.
  // A barra do celular são as 4 primeiras abas da ordem (o resto vai para "Mais").
  function resolve(salvo, { rotas = [], ligada = () => true } = {}) {
    salvo = salvo && typeof salvo === "object" ? salvo : {};
    const nav = salvo.nav || {}, ini = salvo.inicio || {};

    // ---- navegação: só abas visíveis e ligadas; as novas entram no fim
    const validas = rotas.filter((r) => !r.oculta && ligada(r.id)).map((r) => r.id);
    const guardada = unicos(lista(nav.ordem)).filter((id) => validas.includes(id));
    const ordem = [...guardada, ...validas.filter((id) => !guardada.includes(id))];
    const celular = ordem.slice(0, MAX_CELULAR);

    // ---- Início: blocos conhecidos, novos entram no fim, fixos nunca somem
    const ids = FC.LAYOUT_INICIO.map((b) => b.id);
    const salvaOrdem = unicos(lista(ini.ordem)).filter((id) => ids.includes(id));
    const ordemInicio = [...salvaOrdem, ...ids.filter((id) => !salvaOrdem.includes(id))];
    const fixos = FC.LAYOUT_INICIO.filter((b) => b.fixo).map((b) => b.id);
    // com o Início já salvo, valem os ocultos dele (vazio = nenhum); sem, os do padrão
    const salvouInicio = !!salvo.inicio && typeof salvo.inicio === "object" && Object.keys(salvo.inicio).length > 0;
    const base = salvouInicio ? lista(ini.ocultos) : FC.LAYOUT_INICIO.filter((b) => b.padraoOculto).map((b) => b.id);
    const ocultos = unicos(base).filter((id) => ids.includes(id) && !fixos.includes(id));

    return { nav: { ordem, celular }, inicio: { ordem: ordemInicio, ocultos } };
  }

  // o que gravar: só o que difere do padrão (vazio = null = padrão)
  function paraSalvar(layout, padrao) {
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const nav = {}, ini = {};
    if (!igual(layout.nav.ordem, padrao.nav.ordem)) nav.ordem = layout.nav.ordem;
    if (!igual(layout.inicio.ordem, padrao.inicio.ordem)) ini.ordem = layout.inicio.ordem;
    // salvando o Início, os ocultos vão sempre (mesmo vazios): sem eles valeria o padrão
    if (ini.ordem || !igual([...layout.inicio.ocultos].sort(), [...padrao.inicio.ocultos].sort())) ini.ocultos = layout.inicio.ocultos;
    const saida = {};
    if (Object.keys(nav).length) saida.nav = nav;
    if (Object.keys(ini).length) saida.inicio = ini;
    return Object.keys(saida).length ? saida : null;
  }

  // move um item de `de` para `para` (índices) sem mutar
  function move(arr, de, para) {
    const a = arr.slice();
    if (de < 0 || de >= a.length) return a;
    const [x] = a.splice(de, 1);
    a.splice(Math.max(0, Math.min(a.length, para)), 0, x);
    return a;
  }

  FC.layout = { resolve, paraSalvar, move, MAX_CELULAR };
})();
