"""Yahoo Finance - preco, historico e proventos (Brasil e EUA).

E a unica fonte gratuita testada que devolve o historico de dividendos
com data e valor. Isso permite reconstruir o DY de 12 meses para
qualquer dia do passado - a base da lente historica.
"""
import datetime as dt

from .comum import http_json

URL = ("https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
       "?range={rng}&interval=1d&events=div")


def _simbolo(ticker, classe):
    t = ticker.upper()
    listado_na_b3 = ("fii", "acao_br", "etf_br", "fii_tijolo", "fii_papel")
    if classe in listado_na_b3 and not t.endswith(".SA"):
        return t + ".SA"
    return t


def _sem_outliers(precos, janela=11, tolerancia=0.5):
    """Remove pontos claramente corrompidos do historico de precos.

    O Yahoo devolve, para o XPML11, tres dias de janeiro cotados a ~1,07
    em vez de ~107 - um erro de escala de 100x. Um unico ponto assim
    estraga a minima de 52 semanas e toda a serie de P/VP.

    Cada ponto e comparado com a mediana dos vizinhos, nao com a mediana
    global: assim um ativo que de fato triplicou em tres anos mantem
    todos os seus pontos, enquanto o salto isolado de um dia cai fora.
    """
    if len(precos) < janela:
        return precos, 0
    meio = janela // 2
    limpos = []
    for i, (data, preco) in enumerate(precos):
        ini = max(0, i - meio)
        vizinhos = sorted(p for _, p in precos[ini:ini + janela])
        mediana = vizinhos[len(vizinhos) // 2]
        if mediana and abs(preco / mediana - 1) <= tolerancia:
            limpos.append((data, preco))
    return limpos, len(precos) - len(limpos)


def serie(ticker, classe="acao_br", anos=3, ttl_horas=6):
    """Historico diario + proventos.

    Devolve {'precos': [(date, close)], 'dividendos': [(date, valor)],
             'preco': float, 'moeda': str, 'max_52s': float, 'min_52s': float}
    """
    sym = _simbolo(ticker, classe)
    dados = http_json(URL.format(sym=sym, rng=f"{anos}y"), ttl_horas)
    res = dados["chart"]["result"][0]
    meta = res["meta"]

    carimbos = res.get("timestamp") or []
    fechamentos = res["indicators"]["quote"][0].get("close") or []
    precos = [(dt.date.fromtimestamp(t), c)
              for t, c in zip(carimbos, fechamentos) if c is not None]
    precos, descartados = _sem_outliers(precos)

    divs = sorted((dt.date.fromtimestamp(int(k)), v["amount"])
                  for k, v in res.get("events", {}).get("dividends", {}).items())

    corte = dt.date.today() - dt.timedelta(days=365)
    ult_ano = [p for d, p in precos if d >= corte]

    # média móvel de 200 pregões: para ETF de índice, que não tem P/VP nem
    # DY, é a única referência de "caro ou barato" que dá para calcular
    # com dado gratuito
    ultimos200 = [p for _, p in precos[-200:]]
    media_200d = sum(ultimos200) / len(ultimos200) if len(ultimos200) >= 100 else None

    return {
        "simbolo": sym,
        "precos": precos,
        "precos_descartados": descartados,
        "media_200d": media_200d,
        "dividendos": divs,
        "preco": meta.get("regularMarketPrice"),
        "moeda": meta.get("currency"),
        "max_52s": max(ult_ano) if ult_ano else None,
        "min_52s": min(ult_ano) if ult_ano else None,
    }


def dy_em(data, precos_idx, dividendos, preco_na_data):
    """DY de 12 meses olhando de uma data do passado, em %."""
    if not preco_na_data:
        return None
    ini = data - dt.timedelta(days=365)
    soma = sum(v for d, v in dividendos if ini < d <= data)
    return (soma / preco_na_data) * 100 if soma else None


def serie_dy(dados):
    """Serie historica do DY 12m: [(date, dy_percent)], amostrada por semana."""
    precos = dados["precos"]
    divs = dados["dividendos"]
    if not precos or not divs:
        return []
    inicio = precos[0][0] + dt.timedelta(days=365)   # precisa de 1 ano de lastro
    saida = []
    for i, (d, p) in enumerate(precos):
        if d < inicio or i % 5:                       # 1 ponto por semana
            continue
        dy = dy_em(d, None, divs, p)
        if dy:
            saida.append((d, dy))
    return saida


def serie_premio_media(dados, janela=200):
    """Serie do premio do preco sobre a media movel de N pregoes, em %.

    Para ETF de indice e a unica leitura de "caro ou barato" disponivel:
    nao ha P/VP nem DY. Cuidado na interpretacao - num indice em alta de
    longo prazo, ficar acima da media e o estado normal, nao um alerta.
    """
    precos = [p for _, p in dados["precos"]]
    datas = [d for d, _ in dados["precos"]]
    if len(precos) < janela + 20:
        return []
    saida = []
    soma = sum(precos[:janela])
    for i in range(janela, len(precos)):
        soma += precos[i] - precos[i - janela]
        if i % 5:
            continue
        media = soma / janela
        if media:
            saida.append((datas[i], (precos[i] / media - 1) * 100))
    return saida


def serie_pvp(dados, pvp_hoje):
    """Serie historica APROXIMADA do P/VP.

    O valor patrimonial por cota nao tem historico gratuito, entao
    projeta-se o VPA de hoje para tras: P/VP(t) = preco(t) / VPA_hoje.
    Captura bem o movimento de preco, ignora mudancas do patrimonio.
    Marcada como aproximada na interface.
    """
    if not pvp_hoje or not dados["precos"]:
        return []
    vpa = dados["preco"] / pvp_hoje if dados["preco"] else None
    if not vpa:
        return []
    return [(d, p / vpa) for i, (d, p) in enumerate(dados["precos"]) if not i % 5]
