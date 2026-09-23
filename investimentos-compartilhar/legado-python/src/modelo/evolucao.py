"""Evolução histórica da carteira, reconstruída dos aportes.

A curva sai do cruzamento de duas coisas que a ferramenta já tem: as
datas e quantidades de cada compra, e o histórico de preços de cada
ativo. Para qualquer dia do passado dá para saber quantas cotas você
tinha e quanto elas valiam naquele dia.

Duas linhas são desenhadas juntas, e é a distância entre elas que
interessa:

- o VALOR da carteira naquele dia;
- o CUSTO acumulado, ou seja, quanto dinheiro você tinha colocado até
  ali.

Sozinha, a linha do valor confunde crescimento por aporte com
crescimento por rendimento — uma carteira que só recebe dinheiro sobe
igual a uma que rende. Com as duas, o ganho é a distância entre elas.
"""
import datetime as dt

PASSO_DIAS = 7          # um ponto por semana; o suficiente para a curva


def _mapa_de_precos(serie):
    """{data: preço} + a lista ordenada de datas, para busca rápida."""
    return {d: p for d, p in serie}


def _preco_em(mapa, datas_ordenadas, alvo):
    """Preço do dia, ou o do pregão anterior mais próximo.

    Fim de semana, feriado e dia sem negócio não têm cotação — usar o
    último preço conhecido é o que qualquer extrato faz.
    """
    if alvo in mapa:
        return mapa[alvo]
    anterior = None
    for d in datas_ordenadas:
        if d > alvo:
            break
        anterior = d
    return mapa.get(anterior) if anterior else None


def serie_da_carteira(aportes_ativos, aportes_caixa, ativos, hoje=None):
    """Reconstrói valor e custo da carteira, semana a semana.

    aportes_ativos: [{data, ticker, quantidade, preco}]
    aportes_caixa:  [{data, valor}]  (entradas em renda fixa)
    ativos:         resultado da coleta, para pegar as séries de preço
    """
    if not aportes_ativos and not aportes_caixa:
        return {"pontos": [], "primeiro_aporte": None}

    hoje = hoje or dt.date.today()
    compras = sorted(aportes_ativos, key=lambda a: a["data"])
    caixa = sorted(aportes_caixa, key=lambda a: a["data"])

    datas = [a["data"] for a in compras] + [a["data"] for a in caixa]
    inicio = min(datas)

    precos = {}
    for a in ativos:
        serie = a.get("serie_preco") or []
        if serie:
            mapa = _mapa_de_precos(serie)
            precos[a["ticker"]] = (mapa, sorted(mapa))

    def ponto_em(dia):
        """Quanto a carteira valia, e quanto tinha custado, naquele dia."""
        posicao = {}
        custo = 0.0
        for c in compras:
            if c["data"] > dia:
                break
            posicao[c["ticker"]] = posicao.get(c["ticker"], 0.0) + c["quantidade"]
            custo += c["quantidade"] * c["preco"]
        for c in caixa:
            if c["data"] > dia:
                break
            custo += c["valor"]

        valor = 0.0
        faltou = False
        for ticker, qtd in posicao.items():
            dados = precos.get(ticker)
            if not dados:
                faltou = True
                continue
            p = _preco_em(dados[0], dados[1], dia)
            if p is None:
                faltou = True
                continue
            valor += qtd * p

        # o caixa entra pelo valor aportado: não há histórico de saldo
        # diário de CDB, e inventar um seria pior que somar o principal
        valor += sum(c["valor"] for c in caixa if c["data"] <= dia)

        return {"data": dia, "valor": valor, "custo": custo,
                "incompleto": faltou}

    pontos = []
    dia = inicio
    while dia <= hoje:
        pontos.append(ponto_em(dia))
        dia += dt.timedelta(days=PASSO_DIAS)

    # O último ponto tem de ser HOJE, e calculado - não copiado do último
    # ponto semanal. Copiando, uma compra feita depois da última semana
    # cheia não aparecia na curva: o gráfico ficava congelado até a
    # semana seguinte, mesmo com o aporte já registrado.
    if not pontos or pontos[-1]["data"] != hoje:
        pontos.append(ponto_em(hoje))

    return {
        "pontos": pontos,
        "primeiro_aporte": inicio,
        "valor_final": pontos[-1]["valor"] if pontos else 0.0,
        "custo_final": pontos[-1]["custo"] if pontos else 0.0,
        "ganho": (pontos[-1]["valor"] - pontos[-1]["custo"]) if pontos else 0.0,
        "algum_incompleto": any(p["incompleto"] for p in pontos),
    }
