"""Junta fontes + lentes e produz o veredito de cada ativo.

IMPORTANTE: o veredito e a aplicacao mecanica dos criterios que estao
em config/regras.yaml. Nao e recomendacao de investimento - e o seu
proprio checklist, calculado rapido e sempre do mesmo jeito.
"""
from pathlib import Path

import yaml

from .. import armazem
from ..fontes import bcb, fundamentus, yahoo
from .lentes import lente_historica, lente_macro, lente_pares, lente_regra

RAIZ = Path(__file__).resolve().parents[2]


def carrega_config():
    with open(RAIZ / "config" / "regras.yaml", encoding="utf-8") as f:
        regras = yaml.safe_load(f)
    return regras, armazem.carteira()


# ----------------------------------------------------------------- perfis
def perfil_do_fii(ticker, segmento, regras):
    """Decide se o FII e de tijolo ou de papel."""
    if ticker in (regras.get("override_perfil") or {}):
        return regras["override_perfil"][ticker]
    if segmento in (regras.get("segmentos_papel") or []):
        return "fii_papel"
    return "fii_tijolo"


def perfil_do_ativo(ticker, classe, universo, regras):
    if classe == "fii":
        seg = (universo["fiis"].get(ticker) or {}).get("segmento", "")
        return perfil_do_fii(ticker, seg, regras)
    return classe          # acao_br, acao_us, etf_us


# ----------------------------------------------------------------- coleta
def monta_universo(ttl_horas=6):
    """Baixa os dois tabeloes uma unica vez - alimenta a lente de pares."""
    return {
        "fiis": fundamentus.fiis(ttl_horas),
        "acoes": fundamentus.acoes(ttl_horas),
        "macro": bcb.macro(ttl_horas),
    }


# ----------------------------------------------------------------- limpeza
# Metricas em que o Fundamentus escreve 0 querendo dizer "nao se aplica"
# ou "nao informado". Se nao tratar, a mediana do setor vira 0 e a lente
# de pares reprova quem tem o dado bom.
ZERO_E_AUSENTE = {"vacancia", "cap_rate", "dy", "pvp", "pl", "roe",
                  "ffo_yield", "ev_ebitda", "roic", "liquidez"}

# Metricas do tipo "menor e melhor" em que numero negativo NAO e barato:
# P/L negativo significa prejuizo, P/VP negativo significa patrimonio
# negativo. Sem esse tratamento a lente inverteria o julgamento.
NEGATIVO_E_RUIM = {"pl", "pvp", "ev_ebitda"}

# Faixas em que o numero ainda pode ser verdade. Fora delas o mais
# provavel e erro da fonte - o Fundamentus publica vacancia de 91,81%
# para o XPML11, um FII de shoppings, que e a taxa de OCUPACAO invertida.
# Nao da para adivinhar o valor certo, entao a metrica e descartada e o
# motivo aparece na tela: melhor uma lente calada que uma nota errada.
PLAUSIVEL = {
    "vacancia": (0, 60),
    "cap_rate": (0, 30),
    "dy": (0, 40),
    "pvp": (0, 5),
    "ffo_yield": (0, 40),
}


def sanitiza(chave, valor):
    """(valor_utilizavel, e_sinal_ruim, motivo_do_descarte)."""
    if valor is None:
        return None, False, None
    if chave in NEGATIVO_E_RUIM and valor <= 0:
        return None, True, None    # existe o dado, e ele e pessimo
    if chave in ZERO_E_AUSENTE and valor == 0:
        return None, False, None   # dado ausente disfarcado de zero
    faixa = PLAUSIVEL.get(chave)
    if faixa and not (faixa[0] <= valor <= faixa[1]):
        return None, False, ("valor implausível na fonte: %s"
                             % ("%.2f" % valor).replace(".", ","))
    return valor, False, None


def _grupo_de_pares(ticker, classe, perfil, universo, regras):
    """Devolve (nome_do_grupo, {metrica: [valores dos pares]})."""
    if classe == "fii":
        seg = (universo["fiis"].get(ticker) or {}).get("segmento", "")
        pares = [v for k, v in universo["fiis"].items()
                 if perfil_do_fii(k, v.get("segmento", ""), regras) == perfil
                 and (perfil == "fii_papel" or v.get("segmento") == seg)
                 and k != ticker]
        nome = "fundos de papel" if perfil == "fii_papel" else "FIIs de " + str(seg)
    elif classe == "acao_br":
        # sem classificacao setorial gratuita: compara com a B3 liquida
        pares = [v for k, v in universo["acoes"].items()
                 if k != ticker and (v.get("liquidez") or 0) > 1_000_000]
        nome = "acoes liquidas da B3"
    else:
        return "", {}

    metricas = {}
    for p in pares:
        for k, v in p.items():
            if not isinstance(v, (int, float)):
                continue
            limpo, _, _ = sanitiza(k, v)
            if limpo is not None:
                metricas.setdefault(k, []).append(limpo)
    return nome, metricas


# ----------------------------------------------------------------- valores
def _valores_atuais(ticker, classe, universo, hist):
    """Metricas de hoje, normalizadas para as chaves usadas em regras.yaml."""
    if classe == "fii":
        base = dict(universo["fiis"].get(ticker) or {})
    elif classe == "acao_br":
        base = dict(universo["acoes"].get(ticker) or {})
    else:
        base = {}

    if hist:
        base.setdefault("cotacao", hist.get("preco"))
        # DY calculado dos proventos reais - mesma metodologia da serie
        # historica, entao a lente historica compara laranja com laranja.
        ultima_data = max((d for d, _ in hist["precos"]), default=None)
        dy_calc = yahoo.dy_em(ultima_data, None, hist["dividendos"], hist.get("preco"))
        if dy_calc:
            base["dy_calculado"] = dy_calc
            if classe not in ("fii", "acao_br"):
                base["dy"] = dy_calc
        if hist.get("max_52s") and hist.get("preco"):
            base["dist_maxima_52s"] = (1 - hist["preco"] / hist["max_52s"]) * 100
        if hist.get("media_200d") and hist.get("preco"):
            base["premio_media_200d"] = (hist["preco"] / hist["media_200d"] - 1) * 100
    return base


def _series_historicas(hist, valores):
    if not hist:
        return {}
    return {
        "dy": yahoo.serie_dy(hist),
        "pvp": yahoo.serie_pvp(hist, valores.get("pvp")),
        "premio_media_200d": yahoo.serie_premio_media(hist),
    }


# ----------------------------------------------------------------- avaliacao
def avalia(ticker, classe, universo, regras, anos=3, ttl_horas=6):
    ticker = ticker.upper()
    perfil = perfil_do_ativo(ticker, classe, universo, regras)
    cfg_perfil = regras["perfis"].get(perfil)
    avisos = []

    if not cfg_perfil:
        return {"ticker": ticker, "classe": classe,
                "erro": "o perfil «%s» não existe em regras.yaml" % perfil}

    try:
        hist = yahoo.serie(ticker, classe, anos, ttl_horas)
    except Exception as e:
        hist = None
        avisos.append("histórico de preços indisponível (%s)" % type(e).__name__)

    valores = _valores_atuais(ticker, classe, universo, hist)
    if not valores:
        return {"ticker": ticker, "classe": classe,
                "erro": "ativo não encontrado nas fontes"}

    series = _series_historicas(hist, valores)
    nome_grupo, pares = _grupo_de_pares(ticker, classe, perfil, universo, regras)
    macro = universo["macro"]
    pesos_lente = regras["pesos_lentes"]
    # Se o rendimento do ativo e isento de IR para PF, a comparacao
    # justa e contra o CDI liquido. Configuravel por perfil porque a
    # regra tributaria muda - veja o comentario em regras.yaml.
    isento = bool(cfg_perfil.get("isento_ir", perfil.startswith("fii")))

    if hist and hist.get("precos_descartados"):
        avisos.append(
            "%d dia(s) do histórico de preços foram descartados por conterem "
            "valores corrompidos na fonte" % hist["precos_descartados"])

    if valores.get("dy") and valores.get("dy_calculado"):
        dif = abs(valores["dy"] - valores["dy_calculado"])
        if dif > 2:
            avisos.append(
                "DY diverge entre as fontes: Fundamentus %s%% contra %s%% "
                "pelos proventos do Yahoo"
                % (("%.2f" % valores["dy"]).replace(".", ","),
                   ("%.2f" % valores["dy_calculado"]).replace(".", ",")))

    saida_metricas = []
    soma_pesos = soma_notas = 0.0

    for chave, cfg in cfg_perfil["metricas"].items():
        valor, sinal_ruim, descarte = sanitiza(chave, valores.get(chave))
        if descarte:
            avisos.append("«%s» não foi avaliado — %s"
                          % (cfg.get("rotulo", chave), descarte))

        # A lente historica precisa comparar o valor de hoje com uma serie
        # medida do MESMO jeito. A serie de DY vem dos proventos do Yahoo,
        # entao ela e confrontada com o DY calculado, nao com o do
        # Fundamentus, que usa outra janela.
        valor_hist = valores.get("dy_calculado") if chave == "dy" else valor
        valor_macro = valor_hist if chave == "dy" else valor

        if sinal_ruim:
            # Numero existe e e ruim (prejuizo, patrimonio negativo).
            # Nao pode virar "sem dado", senao o ativo escapa da penalidade.
            nota_metrica, alvo = 0.0, None
            notas = [lente_regra(None, cfg)]
            notas[0].texto = "valor negativo ou nulo - tratado como reprovado"
        else:
            notas = [
                lente_regra(valor, cfg),
                lente_historica(valor_hist, series.get(chave, []), cfg, anos),
                lente_pares(valor, pares.get(chave, []), cfg, nome_grupo),
                lente_macro(valor_macro, cfg, macro, isento),
            ]
            validas = [(n, pesos_lente.get(n.lente, 0))
                       for n in notas if n.nota is not None]
            nota_metrica = (sum(n.nota * p for n, p in validas)
                            / sum(p for _, p in validas) if validas else None)
            refs = [n.referencia for n in notas if n.referencia is not None]
            alvo = sum(refs) / len(refs) if refs else None

        if nota_metrica is not None:
            peso = cfg.get("peso", 1)
            soma_pesos += peso
            soma_notas += nota_metrica * peso

        # DY tem duas medicoes legitimas; mostrar as duas evita a impressao
        # de que a ferramenta se contradiz.
        alt = None
        if (chave == "dy" and valores.get("dy_calculado") and valor
                and abs(valores["dy_calculado"] - valor) > 0.3):
            # so mostra a segunda medicao quando ela de fato diverge -
            # repetir o mesmo numero duas vezes so polui a tela
            alt = {"rotulo": "por proventos (Yahoo)",
                   "valor": valores["dy_calculado"]}

        # Quando as lentes discordam muito, a media esconde o conflito.
        # O desvio entre elas e informacao: sinaliza "depende de com o que
        # voce compara" em vez de fingir que ha uma resposta so.
        dadas = [n.nota for n in notas if n.nota is not None]
        if len(dadas) > 1:
            media = sum(dadas) / len(dadas)
            divergencia = (sum((x - media) ** 2 for x in dadas) / len(dadas)) ** 0.5
        else:
            divergencia = 0.0

        saida_metricas.append({
            "chave": chave,
            "rotulo": cfg.get("rotulo", chave),
            "unidade": cfg.get("unidade", ""),
            "valor": valor,
            "valor_alt": alt,
            "sinal_ruim": sinal_ruim,
            "peso": cfg.get("peso", 1),
            "nota": nota_metrica,
            "alvo": alvo,
            "divergencia": divergencia,
            "lentes": notas,
            "serie": series.get(chave, []),
            # pontos de ancoragem, para desenhar a regua na unidade real
            "escala": {"otimo": cfg.get("otimo"), "aceitavel": cfg.get("aceitavel"),
                       "ruim": cfg.get("ruim"), "direcao": cfg.get("direcao")},
        })

    score = soma_notas / soma_pesos if soma_pesos else None
    faixas = regras["vereditos"]
    if score is None:
        veredito, cor = "sem dados", "cinza"
    elif score >= faixas["atende"]:
        veredito, cor = "atende seus criterios", "verde"
    elif score >= faixas["observar"]:
        veredito, cor = "zona cinzenta", "amarelo"
    else:
        veredito, cor = "fora dos seus criterios", "vermelho"

    # metricas em que vale a pena avisar que as lentes se contradizem
    conflitos = [m for m in saida_metricas if m["divergencia"] >= 25]

    return {
        "ticker": ticker,
        "classe": classe,
        "perfil": perfil,
        "segmento": valores.get("segmento", ""),
        "grupo_pares": nome_grupo,
        "conflitos": conflitos,
        "preco": valores.get("cotacao") or (hist or {}).get("preco"),
        "moeda": (hist or {}).get("moeda", "BRL"),
        "score": score,
        "veredito": veredito,
        "cor": cor,
        "metricas": saida_metricas,
        "avisos": avisos,
        "max_52s": (hist or {}).get("max_52s"),
        "min_52s": (hist or {}).get("min_52s"),
        # série de preços fica disponível para reconstruir a evolução
        # histórica da carteira a partir das datas de compra
        "serie_preco": (hist or {}).get("precos") or [],
    }


# ----------------------------------------------------------------- renda fixa
def avalia_renda_fixa(item, macro):
    """Converte a taxa contratada em taxa nominal e taxa real comparaveis."""
    # Sem a taxa nao da para comparar nada. Preencher com um numero
    # plausivel seria inventar dado e o painel mostraria uma conclusao
    # que nao tem lastro - melhor dizer que falta o dado.
    if item.get("taxa") is None:
        return {**item, "base": "taxa não informada", "nominal": None,
                "real": None, "premio_cdi": None, "cor": "cinza",
                "leitura": "preencha a taxa contratada"}

    tipo, taxa = item["tipo"], float(item["taxa"])
    cdi, ipca = macro.get("cdi"), macro.get("ipca_12m")
    nominal = None

    if tipo == "cdi" and cdi:
        nominal = cdi * taxa / 100
        base = "%.0f%% do CDI" % taxa
    elif tipo == "ipca" and ipca:
        nominal = ((1 + ipca / 100) * (1 + taxa / 100) - 1) * 100
        base = "IPCA + %s%%" % ("%.2f" % taxa).replace(".", ",")
    elif tipo == "prefixado":
        nominal = taxa
        base = "prefixado %s%%" % ("%.2f" % taxa).replace(".", ",")
    else:
        base = tipo

    real = (((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100
            if nominal and ipca else None)
    premio = nominal - cdi if (nominal and cdi) else None

    # o numero vira virgula decimal; a frase em volta fica intacta
    pp = ("%+.2f" % premio).replace(".", ",") if premio is not None else ""
    if premio is None:
        cor, leitura = "cinza", "sem dados do Banco Central"
    elif premio >= 1.0:
        cor, leitura = "verde", "%s p.p. sobre o CDI" % pp
    elif premio >= -0.5:
        cor, leitura = "amarelo", "%s p.p. — praticamente o CDI" % pp
    else:
        cor, leitura = "vermelho", "%s p.p. abaixo do CDI" % pp

    return {**item, "base": base, "nominal": nominal, "real": real,
            "premio_cdi": premio, "cor": cor, "leitura": leitura}
