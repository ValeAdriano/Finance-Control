"""Projeção da carteira mês a mês, em moeda de hoje.

Três princípios, porque é aqui que ferramenta financeira mais engana:

1. TUDO EM TERMOS REAIS. Projetar nominal produz números grandes e
   sem significado — R$ 1 milhão em 2046 não é R$ 1 milhão. Aqui o
   patrimônio projetado está sempre no poder de compra de hoje.

2. O DETERMINÍSTICO SEPARADO DA PREMISSA. Um CDB a 103,7% do CDI tem
   retorno conhecido dado o cenário de juros; a valorização de uma ação
   não tem. As duas coisas nunca aparecem com o mesmo peso de certeza.

3. PROVENTOS VÊM DO DADO, NÃO DE CHUTE. O rendimento projetado usa o
   dividend yield que cada ativo efetivamente pagou nos últimos 12
   meses, e a valorização entra à parte — somar um retorno total
   "esperado" ao dividendo contaria o mesmo dinheiro duas vezes.
"""
from pathlib import Path

import yaml

from .. import armazem

RAIZ = Path(__file__).resolve().parents[2]
MESES_ANO = 12


def carrega_premissas():
    """YAML como base, sobreposto pelo que foi salvo na tela.

    O YAML continua sendo a documentação das premissas - é lá que estão
    os comentários explicando cada uma. A tela grava só o que muda, à
    parte (Supabase ou dados/premissas.json), para que reescrever o
    arquivo não apague os textos.
    """
    with open(RAIZ / "config" / "projecao.yaml", encoding="utf-8") as f:
        base = yaml.safe_load(f) or {}
    try:
        salvas = armazem.premissas_salvas()
        if salvas:
            base = aplica(base, salvas)
    except Exception:
        pass                          # overlay ruim não derruba a tela
    return base


def aplica(premissas, mudancas):
    """Mescla mudanças (aninhadas) sobre as premissas, sem alterar a base."""
    saida = {k: (dict(v) if isinstance(v, dict) else v)
             for k, v in (premissas or {}).items()}
    for chave, valor in (mudancas or {}).items():
        if isinstance(valor, dict) and isinstance(saida.get(chave), dict):
            saida[chave].update({k: v for k, v in valor.items() if v is not None})
        elif valor is not None:
            saida[chave] = valor
    return saida


def salva_premissas(mudancas):
    armazem.salva_premissas(mudancas)


def limpa_premissas():
    """Volta para o que está no YAML."""
    armazem.limpa_premissas()


def tem_premissas_salvas():
    return armazem.tem_premissas_salvas()


def _mensal(taxa_anual_pct):
    """Converte % ao ano em fator mensal composto."""
    return (1 + taxa_anual_pct / 100) ** (1 / MESES_ANO) - 1


def _real(nominal_pct, ipca_pct):
    """Taxa real pela fórmula de Fisher."""
    return ((1 + nominal_pct / 100) / (1 + ipca_pct / 100) - 1) * 100


def perfil_dos_pilares(ativos, renda_fixa, macro_lp, ipca):
    """Estado inicial de cada pilar: quanto vale e como rende.

    Renda variável: valor da posição e o DY médio ponderado, tirado do
    que os ativos de fato pagaram. Caixa: cada título com a taxa real
    que foi contratada, não uma média.
    """
    pilares = {}

    for a in ativos:
        pos = a.get("posicao")
        pilar = a.get("pilar")
        if not (pos and pilar):
            continue
        valor = pos["atual"]
        # DY efetivo do ativo; ETF de índice não distribui, fica em zero
        dy = 0.0
        for m in a.get("metricas", []):
            if m["chave"] == "dy" and m.get("valor"):
                dy = m["valor"]
                break
        p = pilares.setdefault(pilar, {"valor": 0.0, "dy_ponderado": 0.0,
                                       "titulos": []})
        p["valor"] += valor
        p["dy_ponderado"] += valor * dy

    for chave, p in pilares.items():
        p["dy"] = p["dy_ponderado"] / p["valor"] if p["valor"] else 0.0

    # caixa: cada título rende pela própria taxa contratada
    caixa = pilares.setdefault("caixa", {"valor": 0.0, "dy": 0.0, "titulos": []})
    cdi = macro_lp.get("cdi")
    for r in renda_fixa:
        aplicado = float(r.get("valor_aplicado") or 0)
        if not aplicado:
            continue
        taxa = r.get("taxa")
        if taxa is None:
            nominal = cdi                      # sem taxa informada, assume CDI
        elif r["tipo"] == "cdi":
            nominal = cdi * float(taxa) / 100
        elif r["tipo"] == "ipca":
            nominal = ((1 + ipca / 100) * (1 + float(taxa) / 100) - 1) * 100
        else:
            nominal = float(taxa)
        caixa["valor"] += aplicado
        caixa["titulos"].append({"nome": r.get("nome", "—"), "valor": aplicado,
                                 "real": _real(nominal, ipca),
                                 "nominal": nominal})

    if caixa["titulos"]:
        # taxa real média do caixa, ponderada pelo valor de cada título
        total = sum(t["valor"] for t in caixa["titulos"])
        caixa["taxa_real"] = sum(t["valor"] * t["real"] for t in caixa["titulos"]) / total
    else:
        caixa["taxa_real"] = 0.0

    return pilares


def _destino_do_aporte(saldos, alvos, modo):
    """Divide o aporte do mês entre os pilares.

    'rebalancear' manda tudo para o pilar mais distante da meta — é o
    rebalanceamento por aporte, que corrige a alocação sem vender nada
    e sem gerar imposto.
    """
    total = sum(saldos.values())
    if not total or not alvos:
        return {k: 1.0 / len(saldos) for k in saldos} if saldos else {}

    if modo == "proporcional":
        soma_alvos = sum(alvos.values()) or 1
        return {k: alvos.get(k, 0) / soma_alvos for k in saldos}

    faltas = {k: max(0.0, total * alvos.get(k, 0) / 100 - v)
              for k, v in saldos.items()}
    soma = sum(faltas.values())
    if soma <= 0:                       # já está na meta: divide pela meta
        soma_alvos = sum(alvos.values()) or 1
        return {k: alvos.get(k, 0) / soma_alvos for k in saldos}
    return {k: v / soma for k, v in faltas.items()}


def simula(pilares, premissas, alvos, ajuste_pp=0.0):
    """Roda a simulação mensal. Devolve as séries e os totais.

    ajuste_pp desloca a valorização real de todos os pilares — é o que
    gera os cenários pessimista e otimista.
    """
    meses = int(premissas.get("horizonte_anos", 20)) * MESES_ANO
    aporte = float(premissas.get("aporte_mensal", 0))
    reinveste = bool(premissas.get("reinvestir_proventos", True))
    modo = premissas.get("distribuicao_aporte", "rebalancear")
    valorizacao = premissas.get("valorizacao_real_anual") or {}

    saldos = {k: p["valor"] for k, p in pilares.items()}
    dy = {k: p.get("dy", 0.0) for k, p in pilares.items()}

    # fator de crescimento mensal real de cada pilar
    fator = {}
    for k in saldos:
        if k == "caixa":
            # o caixa cresce pela taxa contratada, que já é conhecida;
            # o cenário não a desloca
            fator[k] = _mensal(pilares[k].get("taxa_real", 0.0))
        else:
            fator[k] = _mensal(float(valorizacao.get(k, 0)) + ajuste_pp)

    serie_patrimonio, serie_renda, serie_composicao = [], [], []
    aportado = proventos_acum = 0.0
    inicial = sum(saldos.values())

    for mes in range(1, meses + 1):
        # 1. valorização do mês
        for k in saldos:
            saldos[k] *= 1 + fator[k]

        # 2. proventos: só a renda variável distribui
        renda_mes = sum(saldos[k] * dy[k] / 100 / MESES_ANO
                        for k in saldos if k != "caixa")
        proventos_acum += renda_mes

        # 3. aporte do mês (+ proventos, se reinvestidos)
        entrada = aporte + (renda_mes if reinveste else 0.0)
        aportado += aporte
        pesos = _destino_do_aporte(saldos, alvos, modo)
        for k, w in pesos.items():
            saldos[k] += entrada * w

        if mes % 3 == 0 or mes == meses:        # um ponto por trimestre
            total = sum(saldos.values())
            serie_patrimonio.append((mes / MESES_ANO, total))
            serie_renda.append((mes / MESES_ANO, renda_mes))
            serie_composicao.append({
                "anos": mes / MESES_ANO,
                "inicial": inicial,
                "aportado": aportado,
                "proventos": proventos_acum if reinveste else 0.0,
                "total": total,
            })

    total = sum(saldos.values())
    return {
        "patrimonio": serie_patrimonio,
        "renda": serie_renda,
        "composicao": serie_composicao,
        "final": total,
        "saldos_finais": dict(saldos),
        "inicial": inicial,
        "aportado": aportado,
        "proventos": proventos_acum,
        # o que sobra depois de tirar o que entrou é ganho de capital
        "valorizacao": total - inicial - aportado - (proventos_acum if reinveste else 0),
        "renda_mensal_final": serie_renda[-1][1] if serie_renda else 0.0,
        "renda_mensal_hoje": sum(pilares[k]["valor"] * dy[k] / 100 / MESES_ANO
                                 for k in pilares if k != "caixa"),
    }


def projeta(dados, premissas):
    """Monta o cenário base e a banda pessimista/otimista."""
    macro = dados["macro"]
    lp = premissas.get("macro_longo_prazo") or {}
    cdi = lp.get("cdi") if lp.get("cdi") is not None else macro.get("cdi")
    ipca = lp.get("ipca") if lp.get("ipca") is not None else macro.get("ipca_12m")
    macro_lp = {"cdi": cdi, "ipca": ipca}

    alvos = dados.get("alocacao_alvo") or {}
    pilares = perfil_dos_pilares(dados["ativos"], dados["renda_fixa"],
                                 macro_lp, ipca)

    cen = premissas.get("cenarios") or {}
    base = simula(pilares, premissas, alvos, 0.0)
    pess = simula(pilares, premissas, alvos, float(cen.get("pessimista", -3)))
    otim = simula(pilares, premissas, alvos, float(cen.get("otimista", 3)))

    # retorno total de cada pilar = valorização premissa + o que ele paga
    # em proventos; serve para o leitor conferir se a premissa é plausível
    valorizacao = premissas.get("valorizacao_real_anual") or {}
    resumo_pilares = []
    for chave, p in pilares.items():
        if chave == "caixa":
            resumo_pilares.append({
                "chave": chave, "valor": p["valor"], "dy": None,
                "valorizacao": None, "total": p.get("taxa_real", 0.0),
                "titulos": p.get("titulos", []),
            })
        else:
            v = float(valorizacao.get(chave, 0))
            # o dividendo acompanha a inflação, então em moeda de hoje o
            # DY nominal já é o rendimento real
            resumo_pilares.append({
                "chave": chave, "valor": p["valor"], "dy": p["dy"],
                "valorizacao": v, "total": v + p["dy"], "titulos": [],
            })

    return {
        "base": base, "pessimista": pess, "otimista": otim,
        "pilares": resumo_pilares,
        "macro_lp": macro_lp,
        "usando_macro_de_hoje": lp.get("cdi") is None,
        "premissas": premissas,
    }
