/* A copy da home pública (Marco 13), separada do HTML. O gerador
 * (scripts/gera-home.mjs) lê este arquivo e o content/tour.ts. Mudou um
 * texto? `npm run build` e a home sai nova. Capturas: public/capturas/
 * (npm run capturas), sempre da conta demo. */

export const meta = {
  titulo: "Bullz · seu patrimônio inteiro, num lugar só",
  descricao: "Renda fixa, ações, FIIs, cripto e o gado num painel só. Plano do mês, projeções, alertas e IR estimado, com os seus critérios.",
  imagem: "/og-home.png",
};

export const nav = { links: [{ rotulo: "Como funciona", href: "#como-funciona" }, { rotulo: "Privacidade", href: "#promessas" }, { rotulo: "Perguntas", href: "#perguntas" }], entrar: "Entrar" };

export const hero = {
  titulo: "Seu patrimônio inteiro, num lugar só.",
  sub: "Renda fixa, ações, cripto e o campo, com um plano para cada mês.",
  entrar: "Entrar",
  tour: "Ver o tour (40 s)",
};

export const tour = { titulo: "Quarenta segundos, sete capítulos.", sub: "Clique num capítulo para pular direto para ele." };

// só o que o Bullz de fato usa hoje (extratos importados e fontes públicas de preço e índice)
export const conectaCom = { titulo: "Conecta com", nomes: ["B3 · Área do Investidor", "Binance", "C6", "PicPay", "Banco Central", "CVM", "Fundamentus", "CoinGecko"] };

export const pilares = {
  titulo: "Quatro pilares. Uma cor para cada.",
  itens: [
    { chave: "rf", nome: "Renda fixa", frase: "CDB, LCI e Tesouro rendendo dia a dia, separados por finalidade." },
    { chave: "acoes", nome: "Ações e FII", frase: "Preço médio, proventos e uma nota com os critérios que você define." },
    { chave: "cripto", nome: "Cripto", frase: "O preço em reais de cada dia, com o empate marcado quando está no prejuízo." },
    { chave: "agro", nome: "Agro", frase: "Cada lote do gado com custo, troca, venda e o resultado do ciclo." },
  ],
};

export const funcionalidades = {
  id: "como-funciona",
  itens: [
    { etiqueta: "Plano do mês", titulo: "O mês já começa com o plano pronto.", texto: "Renda, impostos e despesas viram uma meta. O Bullz diz para onde vai cada real e, no fim do mês, mostra o que foi feito. Mudou o plano global? Os meses fechados não mudam junto.", captura: "plano-mensal" },
    { etiqueta: "Hierarquia", titulo: "Renda fixa, depois ações, depois cripto.", texto: "Você define as faixas. O Bullz avisa quando a carteira sai da ordem e sugere a divisão do aporte que corrige, com o número de meses até lá.", captura: "hierarquia" },
    { etiqueta: "Projeções", titulo: "Para onde vai, mês a mês.", texto: "Cada ativo na taxa histórica dele, com proventos reinvestidos. Dá para ver só os proventos ou um choque na cripto. A venda do gado entra no mês certo.", captura: "projecao" },
    { etiqueta: "Agro por lote", titulo: "O campo entra na conta.", texto: "Toda compra abre um lote. Venda e troca fecham o ciclo com resultado. Funrural e IR estimado saem da venda e vão para o pote certo.", captura: "agro-lotes" },
    { etiqueta: "Potes e trocas", titulo: "Cada real com uma finalidade.", texto: "Reserva de emergência, oportunidade, IR a pagar. Trocar um ativo por outro não vira aporte nem distorce a sua rentabilidade.", captura: "potes" },
    { etiqueta: "Alertas", titulo: "Avisa na hora.", texto: "Quando o preço volta ao seu preço médio, quando passa do alvo, ou no dia em que você marcou para rever uma decisão.", captura: "alertas" },
    { etiqueta: "Consultor via MCP", titulo: "Pergunte para a sua IA.", texto: "Conecte um assistente de IA ao Bullz. Ele lê os seus números, simula antes de gravar e só edita se você deixar.", captura: null, conversa: [
      { quem: "você", texto: "Se eu trocar metade do BTC por Tesouro Selic, a ordem melhora?" },
      { quem: "assistente", texto: "Melhora. Cripto cai de 25% para 13% da base e a carteira volta para a ordem RF › Ações › Cripto. O resultado realizado seria de R$ 1.240. Quer que eu registre?" },
    ] },
  ],
};

export const maisCoisas = {
  titulo: "E não é só isso.",
  itens: [
    { titulo: "IR estimado", texto: "Ganho de capital mês a mês, DARF com código e vencimento, IR rural do ano. Sempre marcado como estimativa." },
    { titulo: "Despesas", texto: "O custo de vida sai da média dos últimos três meses, não de um palpite." },
    { titulo: "Proventos", texto: "Quanto cai por mês, quando cai, e de qual ativo." },
    { titulo: "Watchlist com nota", texto: "Quatro lentes por indicador e uma nota de 0 a 100 pelos seus critérios." },
    { titulo: "Auditoria de dados", texto: "Custo faltando, retorno que não fecha, cotação quebrada: aparece como erro, não como número." },
    { titulo: "Backup", texto: "Tudo o que é seu sai num arquivo só, quando você quiser." },
  ],
};

export const promessas = {
  id: "promessas",
  titulo: "Três promessas.",
  itens: [
    { titulo: "Privado.", texto: "Cada linha do banco só abre para a conta dona (RLS em tudo). 2FA exigido pelo próprio banco e nenhuma senha de corretora: os extratos entram por arquivo." },
    { titulo: "Honesto.", texto: "Estimativa é estimativa. Dado errado aparece como errado. Nada é inventado para a tela ficar bonita." },
    { titulo: "Seu.", texto: "Backup completo num arquivo JSON, a qualquer hora. Os dados são seus e saem com você." },
  ],
};

export const perguntas = {
  id: "perguntas",
  titulo: "Perguntas.",
  itens: [
    { p: "O Bullz recomenda investimentos?", r: "Não. Ele aplica os critérios que você define e mostra a conta. A decisão é sua." },
    { p: "Preciso dar a senha da corretora?", r: "Não. Os extratos da B3, da Binance, do C6 e do PicPay entram por arquivo, e o Bullz nunca pede senha de corretora." },
    { p: "Os números de IR valem para declarar?", r: "São estimativas para conferência, com os parâmetros usados listados. O informe da corretora é o que vale." },
    { p: "Funciona com o gado sem balança?", r: "Funciona. O agro pode ser lançado só por cabeça; peso e arroba são opcionais." },
    { p: "O que a IA consegue ver?", r: "Só o que você autorizar, conta por conta. Dá para liberar só a leitura e revogar quando quiser." },
    { p: "Preciso instalar alguma coisa?", r: "Não. Funciona no navegador do celular e do computador." },
  ],
};

export const ctaFinal = { titulo: "Comece pelo mês que vem.", sub: "Cadastre a renda, os ativos e o gado. O primeiro plano sai pronto.", botao: "Entrar" };

export const rodape = { texto: "Bullz. Não é recomendação de investimento.", links: [{ rotulo: "Entrar", href: "/inicio" }, { rotulo: "Privacidade", href: "#promessas" }] };
