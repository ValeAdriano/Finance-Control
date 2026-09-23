"""Análise de empresas para carteira de renda.

Quatro perguntas, na ordem em que importam para quem compra para
segurar:

1. O LUCRO É RECORRENTE? Não há indicador que responda isso — a
   resposta vem da natureza do negócio. Por isso o universo é uma
   lista de setores em que a receita vem de tarifa regulada, contrato
   longo ou spread bancário, e não de uma cotação de commodity que
   sobe e desce sozinha. Quem escolhe o universo é o config.

2. O PAYOUT CABE NO LUCRO? Acima de 100% a empresa distribui mais do
   que ganhou — pode ser evento isolado (venda de ativo, reserva
   acumulada) ou pode ser insustentável. O número sozinho não separa
   os dois casos, mas passa de 100% é o sinal para ir olhar.

3. O PREÇO ESTÁ JUSTO PARA O DY QUE EU QUERO? O "preço justo" aqui é
   simplesmente o preço em que o dividendo de hoje renderia o yield
   desejado. Não é valuation: é uma conta de três linhas que responde
   "a que preço eu compraria".

4. A DÍVIDA É SUPORTÁVEL? DL/EBITDA acima de ~3x costuma apertar a
   capacidade de manter dividendo quando o juro sobe.
"""
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]


def carrega_config():
    with open(RAIZ / "config" / "renda.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def divida_sobre_ebitda(d):
    """DL/EBITDA a partir dos múltiplos, sem precisar do balanço.

    EV = valor de mercado + dívida líquida, então:
        EV/EBIT − P/EBIT = DL/EBIT
    e a razão entre os dois múltiplos de EV converte para EBITDA:
        DL/EBITDA = (EV/EBIT − P/EBIT) × (EV/EBITDA) ÷ (EV/EBIT)

    Devolve None quando os múltiplos não existem — é o caso dos
    bancos, que não têm EBITDA.
    """
    p_ebit = d.get("p_ebit")
    ev_ebit = d.get("ev_ebit")
    ev_ebitda = d.get("ev_ebitda")
    if not all(isinstance(x, (int, float)) for x in (p_ebit, ev_ebit, ev_ebitda)):
        return None
    if not ev_ebit or ev_ebit == 0:
        return None
    return (ev_ebit - p_ebit) * (ev_ebitda / ev_ebit)


# Abaixo disto a mediana é de mentirinha: com duas ou três empresas ela
# é só a do meio, e um caso atípico vira "o setor". A tela avisa.
MIN_PARA_MEDIANA = 5

# Faixas em que o indicador ainda diz alguma coisa. Valem só para a
# MEDIANA: a empresa com número fora de faixa continua aparecendo na
# tabela com o seu número (e reprovando, se for o caso) — ela só não
# define a referência das vizinhas. É o caso de uma empresa cujo lucro
# foi a quase zero: o payout dela dispara para dezenas de milhares de
# por cento e, sem este filtro, passa a ser o "normal" do setor.
_PLAUSIVEL_NA_MEDIANA = {
    "dy": (0, 40),
    "payout": (0, 300),
    "lucro_preco": (0, 60),
    "dl_ebitda": (-5, 15),
    "pvp": (0, 15),
    "roe": (-100, 100),
}


def mediana(valores):
    """Mediana, ignorando o que não é número.

    Mediana e não média: um banco com payout de 250% num ano de venda
    de ativo puxaria a média do setor inteiro e estragaria a referência
    de todos os vizinhos. A mediana não se deixa levar pelo extremo.
    """
    v = sorted(x for x in valores if isinstance(x, (int, float)))
    if not v:
        return None
    meio = len(v) // 2
    return v[meio] if len(v) % 2 else (v[meio - 1] + v[meio]) / 2


def medianas_do_setor(linhas_do_setor):
    """O retrato numérico de um setor, campo a campo.

    Só entram empresas que passam do piso de liquidez. Uma ação que
    quase não negocia tem preço parado de semanas atrás, e um preço
    parado contamina TODAS as razões que se apoiam nele — DY, P/L,
    P/VP. Deixá-la na mediana é deixar uma cotação velha dar o tom do
    setor inteiro. Ela continua na tabela, com os números dela e
    reprovando em liquidez; só não vota na referência.
    """
    validas = [l for l in linhas_do_setor
               if not l.get("ausente") and l.get("liquido")]
    fora = {}
    for campo, (piso, teto) in _PLAUSIVEL_NA_MEDIANA.items():
        usaveis = [l.get(campo) for l in validas
                   if isinstance(l.get(campo), (int, float))
                   and piso <= l[campo] <= teto]
        fora[campo] = mediana(usaveis)
        fora["n_" + campo] = len(usaveis)
    return fora


def analisa(universo_fundamentus, config, criterios):
    """Monta a tabela da análise para todas as empresas do universo.

    O preço justo depende de um DY alvo, e esse alvo é POR SETOR. Banco,
    energia, saneamento e telecom vivem em patamares de yield diferentes
    por razões estruturais — regulação, ciclo de capital, crescimento —
    e cobrar 6% de todo mundo reprovaria um setor inteiro e aprovaria
    outro inteiro, sem dizer nada sobre as empresas em si.

    Com `alvo: "setor"` (o padrão) cada empresa é medida contra a
    MEDIANA DE DY DO PRÓPRIO SETOR: a pergunta vira "esta paga mais ou
    menos que as suas pares?", que é a única comparação que se sustenta.
    Com `alvo: "fixo"` volta a valer um número único para todos — útil
    quando o que você quer saber é o contrário: quais empresas, de
    qualquer setor, batem um piso de renda que você estabeleceu.
    """
    payout_max = float(criterios.get("payout_maximo") or 100.0)
    dl_max = float(criterios.get("dl_ebitda_maximo") or 3.0)
    liq_min = float(criterios.get("liquidez_minima") or 0.0) * 1e6
    dy_fixo = float(criterios.get("dy_desejado") or 6.0)
    por_setor = (criterios.get("alvo") or "setor") == "setor"

    # ---- primeira passada: o que não depende de comparação
    linhas = []
    for setor, bloco in (config.get("setores") or {}).items():
        sem_ebitda = bool(bloco.get("sem_ebitda"))
        for ticker, nome in (bloco.get("empresas") or {}).items():
            d = universo_fundamentus.get(ticker)
            if not d:
                linhas.append({"ticker": ticker, "nome": nome, "setor": setor,
                               "ausente": True})
                continue

            pl = d.get("pl") or 0
            dy = d.get("dy") or 0
            cotacao = d.get("cotacao") or 0
            liquidez = d.get("liquidez") or 0

            linhas.append({
                "ticker": ticker, "nome": nome, "setor": setor,
                "ausente": False,
                "cotacao": cotacao,
                # lucro sobre preço: o inverso do P/L, lido como rendimento
                "lucro_preco": (100.0 / pl) if pl and pl > 0 else None,
                # payout = dividendo ÷ lucro = (div/preço) × (preço/lucro)
                "payout": (dy * pl) if (pl and pl > 0 and dy) else None,
                "dividendo": cotacao * dy / 100 if (cotacao and dy) else None,
                "dl_ebitda": None if sem_ebitda else divida_sobre_ebitda(d),
                "sem_ebitda": sem_ebitda,
                "dy": dy or None,
                "pl": pl or None,
                "pvp": d.get("pvp"),
                "roe": d.get("roe"),
                "liquidez": liquidez,
                # decidido já aqui: a mediana do setor precisa saber
                # quem negocia antes de calcular qualquer coisa
                "liquido": liquidez >= liq_min,
            })

    # ---- as medianas de cada setor, agora que há com que compará-las
    setores = {}
    for l in linhas:
        setores.setdefault(l["setor"], []).append(l)
    medianas = {s: medianas_do_setor(ls) for s, ls in setores.items()}

    # ---- segunda passada: preço justo e critérios, já contra o setor
    for l in linhas:
        if l.get("ausente"):
            continue
        med = medianas.get(l["setor"], {})
        alvo = (med.get("dy") if por_setor else dy_fixo) or dy_fixo
        l["dy_alvo"] = alvo
        l["mediana_setor"] = med

        # distância até as pares, em pontos percentuais
        l["dy_vs_setor"] = (l["dy"] - med["dy"]) if (l.get("dy")
                                                    and med.get("dy")) else None
        l["payout_vs_setor"] = ((l["payout"] - med["payout"])
                                if (l.get("payout") is not None
                                    and med.get("payout") is not None) else None)

        preco_justo = (l["dividendo"] / alvo * 100) if l["dividendo"] else None
        l["preco_justo"] = preco_justo
        l["desconto"] = ((preco_justo / l["cotacao"] - 1) * 100
                         if (preco_justo and l["cotacao"]) else None)

        # cada critério vira passa / não passa / não se aplica
        testes = {
            "payout": (None if l["payout"] is None
                       else l["payout"] <= payout_max),
            "preco": (None if preco_justo is None
                      else l["cotacao"] <= preco_justo),
            "divida": (None if (l["sem_ebitda"] or l["dl_ebitda"] is None)
                       else l["dl_ebitda"] <= dl_max),
            "liquidez": l["liquido"],
            "lucrativa": bool(l["pl"] and l["pl"] > 0),
        }
        aplicaveis = [v for v in testes.values() if v is not None]
        l["testes"] = testes
        l["passa"] = all(aplicaveis) if aplicaveis else False
        l["n_reprovados"] = sum(1 for v in testes.values() if v is False)

    # ordenado por DY crescente, como na planilha de referência: sobe
    # do yield mais modesto para o mais alto, e o que aparece lá no fim
    # com DY muito acima dos outros costuma ser o que merece desconfiança
    com_dy = [l for l in linhas if l.get("dy")]
    sem_dy = [l for l in linhas if not l.get("dy")]
    com_dy.sort(key=lambda l: l["dy"])
    return com_dy + sem_dy


def agrupa_por_setor(linhas, config):
    """Quebra a tabela em blocos de setor, cada um com o seu retrato.

    A ordem dos blocos é a do config — é a ordem em que o usuário
    pensou os setores, e não há ordenação automática que signifique
    mais do que isso.
    """
    ordem = list((config.get("setores") or {}).keys())
    por_setor = {}
    for l in linhas:
        por_setor.setdefault(l["setor"], []).append(l)

    blocos = []
    for setor in ordem:
        ls = por_setor.get(setor)
        if not ls:
            continue
        validas = [l for l in ls if not l.get("ausente")]
        aprovadas = [l for l in validas if l.get("passa")]
        med = medianas_do_setor(ls)
        blocos.append({
            "setor": setor,
            "linhas": ls,
            "medianas": med,
            "sem_ebitda": bool((config["setores"][setor] or {}).get("sem_ebitda")),
            "total": len(validas),
            "aprovadas": len(aprovadas),
            "tenho": sum(1 for l in validas if l.get("tenho")),
            # com poucas empresas a mediana não é referência, é anedota
            "mediana_fina": (med.get("n_dy") or 0) < MIN_PARA_MEDIANA,
            "n_dy": med.get("n_dy") or 0,
        })
    return blocos


def resumo(linhas):
    validos = [l for l in linhas if not l.get("ausente")]
    aprovados = [l for l in validos if l["passa"]]
    return {
        "total": len(validos),
        "aprovados": len(aprovados),
        "ausentes": sum(1 for l in linhas if l.get("ausente")),
        "dy_medio": (sum(l["dy"] for l in aprovados if l.get("dy"))
                     / len(aprovados)) if aprovados else 0,
    }


# ---------------------------------------------------------------- retorno
def _normaliza(serie):
    """Transforma valores em base 100 no primeiro ponto."""
    if not serie:
        return []
    base = serie[0][1]
    if not base:
        return []
    return [(d, v / base * 100) for d, v in serie]


def retorno_da_acao(dados_yahoo, reinvestir):
    """Evolução de R$ 100 investidos no primeiro dia.

    Com `reinvestir`, cada dividendo compra mais cotas ao preço daquele
    dia — é o retorno total de quem nunca vende e sempre reinveste, que
    é justamente o caso de quem compra para segurar. Sem reinvestir, a
    curva mostra só o que a cota fez: a distância entre as duas é a
    contribuição do dividendo, e ela costuma ser bem maior do que a
    intuição sugere em prazo longo.
    """
    precos = dados_yahoo.get("precos") or []
    if len(precos) < 2:
        return []
    if not reinvestir:
        return _normaliza(precos)

    divs = dict(dados_yahoo.get("dividendos") or [])
    cotas = 1.0
    saida = []
    for data, preco in precos:
        valor_div = divs.get(data)
        if valor_div and preco:
            cotas += (cotas * valor_div) / preco      # reinveste no dia
        saida.append((data, cotas * preco))
    return _normaliza(saida)


def serie_acumulada_cdi(taxas_diarias, desde):
    """[(data, base 100)] acumulando o CDI dia a dia."""
    acum, saida = 100.0, []
    for data, taxa in taxas_diarias:
        if data < desde:
            continue
        acum *= 1 + taxa / 100
        saida.append((data, acum))
    return saida


def compara(dados_yahoo, cdi_diario=None, ibov=None):
    """As quatro curvas em base 100, começando no mesmo dia."""
    so_preco = retorno_da_acao(dados_yahoo, False)
    com_div = retorno_da_acao(dados_yahoo, True)
    if not so_preco:
        return {}

    inicio = so_preco[0][0]
    fora = {"so_preco": so_preco, "com_dividendos": com_div}

    if cdi_diario:
        fora["cdi"] = serie_acumulada_cdi(cdi_diario, inicio)
    if ibov:
        fora["ibov"] = _normaliza([(d, v) for d, v in ibov if d >= inicio])

    fora["resumo"] = {
        chave: (serie[-1][1] - 100) if serie else None
        for chave, serie in fora.items() if isinstance(serie, list) and serie
    }
    fora["anos"] = (so_preco[-1][0] - inicio).days / 365.25
    return fora
