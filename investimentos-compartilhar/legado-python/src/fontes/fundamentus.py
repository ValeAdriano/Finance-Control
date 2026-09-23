"""Fundamentus: tabelao de FIIs e de acoes da B3.

Uma requisicao traz o universo inteiro (561 FIIs, 994 acoes), o que
alimenta de graca a lente de PARES - da para calcular o percentil de
um ativo dentro do segmento dele sem nenhum request extra.
"""
import re

from .comum import http, limpa_html, num_br

URL_FII = "https://www.fundamentus.com.br/fii_resultado.php"
URL_ACAO = "https://www.fundamentus.com.br/resultado.php"


def _tabela(html):
    """Devolve lista de listas de celulas da tabela principal."""
    linhas = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)
    saida = []
    for linha in linhas:
        celulas = [limpa_html(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", linha, re.S)]
        if celulas:
            saida.append(celulas)
    return saida


def fiis(ttl_horas=6):
    """{ticker: {...metricas...}} para todos os FIIs listados."""
    html = http(URL_FII, ttl_horas, encoding="latin-1")
    out = {}
    for c in _tabela(html):
        if len(c) < 13:
            continue
        out[c[0].upper()] = {
            "ticker": c[0].upper(),
            "segmento": c[1] or "Nao informado",
            "cotacao": num_br(c[2]),
            "ffo_yield": num_br(c[3]),
            "dy": num_br(c[4]),
            "pvp": num_br(c[5]),
            "valor_mercado": num_br(c[6]),
            "liquidez": num_br(c[7]),
            "qtd_imoveis": num_br(c[8]),
            "cap_rate": num_br(c[11]),
            "vacancia": num_br(c[12]),
            "_fonte": "fundamentus",
        }
    return out


def acoes(ttl_horas=6):
    """{ticker: {...metricas...}} para todas as acoes da B3."""
    html = http(URL_ACAO, ttl_horas, encoding="latin-1")
    out = {}
    for c in _tabela(html):
        if len(c) < 22:
            continue
        out[c[0].upper()] = {
            "ticker": c[0].upper(),
            "cotacao": num_br(c[1]),
            "pl": num_br(c[2]),
            "pvp": num_br(c[3]),
            "dy": num_br(c[5]),
            # P/EBIT e EV/EBIT juntos dao a divida liquida: EV = valor de
            # mercado + divida, entao EV/EBIT - P/EBIT = DL/EBIT. Com o
            # EV/EBITDA ao lado, fecha o DL/EBITDA sem precisar de balanco.
            "p_ebit": num_br(c[8]),
            "ev_ebit": num_br(c[10]),
            "ev_ebitda": num_br(c[11]),
            "mrg_ebit": num_br(c[13]),
            "mrg_liquida": num_br(c[14]),
            "roic": num_br(c[16]),
            "roe": num_br(c[17]),
            "liquidez": num_br(c[18]),
            "patrimonio": num_br(c[19]),
            "div_liq_pl": num_br(c[20]),
            "cresc_rec_5a": num_br(c[21]),
            "_fonte": "fundamentus",
        }
    return out
