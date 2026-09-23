"""Painel local de avaliação de investimentos.

    python app.py      ->  http://127.0.0.1:8000

Nada aqui é recomendação de investimento: o painel apenas aplica, sempre
do mesmo jeito, os critérios que estão em config/regras.yaml.
"""
import json
import os
import time
import traceback
from datetime import date

from flask import Flask, redirect, render_template, request, url_for
from markupsafe import Markup, escape

from src import armazem
from src.modelo import aportes as mod_aportes
from src.modelo import avaliador, evolucao, grafico, importador, projecao, renda

app = Flask(__name__)
# sem isso o Jinja cacheia os templates e edições de layout só aparecem
# depois de reiniciar o servidor
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.jinja_env.auto_reload = True
app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True

_CACHE = {"quando": 0, "dados": None, "assinatura": None}
VALIDADE_SEGUNDOS = 15 * 60

# rótulos curtos para a coluna de indicadores do painel, onde não há
# espaço para o nome inteiro da métrica
ROTULO_CURTO = {
    "pvp": "P/VP", "pl": "P/L", "dy": "DY", "vacancia": "Vacância",
    "cap_rate": "Cap rate", "liquidez": "Liquidez", "roe": "ROE",
    "div_liq_pl": "Dív/PL", "cresc_rec_5a": "Cresc 5a",
    "dist_maxima_52s": "Desc. máx",
    "premio_media_200d": "vs média 200d",
}

CLASSE_ROTULO = {
    "fii": "FII",
    "fii_papel": "FII de papel",
    "fii_tijolo": "FII de tijolo",
    "acao_br": "Ação brasileira",
    "acao_us": "Ação dos EUA",
    "etf_br": "ETF na B3",
    "etf_us": "ETF dos EUA",
}

# Ordem fixa dos pilares (ARCA). Manter a ordem estável importa: o leitor
# reconhece o pilar pela posição, não precisa reler o rótulo toda vez.
PILARES = [("acoes", "Ações"), ("real_estate", "Real Estate"),
           ("alternativos", "Alternativos"), ("caixa", "Caixa")]

VEREDITO_CURTO = {
    "atende seus criterios": "Atende",
    "zona cinzenta": "Zona cinzenta",
    "fora dos seus criterios": "Fora",
    "sem dados": "Sem dados",
}


def _posicao(item, resultado, registrado=None):
    """Posição = o que estava no YAML + os aportes registrados.

    O preço médio só é calculado sobre a parte da posição cujo custo se
    conhece. Se a base do YAML entrou sem preço médio e depois vieram
    aportes, o PM mostrado é o dos aportes e a tela diz isso - misturar
    uma parte com custo conhecido e outra sem produziria um preço médio
    que não é o de ninguém.
    """
    qtd_base = float(item.get("quantidade") or 0)
    pm_base = item.get("preco_medio")
    qtd_ap = float((registrado or {}).get("quantidade") or 0)
    custo_ap = float((registrado or {}).get("custo") or 0)

    qtd = qtd_base + qtd_ap
    preco = resultado.get("preco")
    if not (qtd and preco):
        return None

    custo = qtd_com_custo = 0.0
    if pm_base and qtd_base:
        custo += qtd_base * float(pm_base)
        qtd_com_custo += qtd_base
    if qtd_ap:
        custo += custo_ap
        qtd_com_custo += qtd_ap

    atual = qtd * preco
    completo = qtd_com_custo >= qtd - 1e-9
    pos = {
        "quantidade": qtd, "quantidade_base": qtd_base,
        "quantidade_aportes": qtd_ap, "n_aportes": (registrado or {}).get("n", 0),
        "atual": atual, "custo": None, "resultado": None, "variacao": None,
        "preco_medio": (custo / qtd_com_custo) if qtd_com_custo else None,
        "custo_parcial": bool(qtd_com_custo) and not completo,
    }
    if completo and custo:
        pos["custo"] = custo
        pos["resultado"] = atual - custo
        pos["variacao"] = (atual / custo - 1) * 100
    return pos


def _alocacao(ativos, renda_fixa, alvos):
    """Alocação real por pilar contra a meta, em % e em reais.

    Também devolve a composição de cada pilar: um pilar em 23% não diz
    se está apoiado num ativo só ou espalhado em cinco, e essa é a
    primeira pergunta de quem olha o número.
    """
    valor = {c: 0.0 for c, _ in PILARES}
    dentro = {c: [] for c, _ in PILARES}

    for a in ativos:
        if a.get("posicao") and a.get("pilar") in valor:
            valor[a["pilar"]] += a["posicao"]["atual"]
            dentro[a["pilar"]].append({
                "nome": a["ticker"], "ticker": a["ticker"],
                "tipo": a.get("tipo_rotulo", ""),
                "valor": a["posicao"]["atual"],
                "score": a.get("score"), "cor": a.get("cor"),
                "veredito": a.get("veredito_curto"),
                "quantidade": a["posicao"]["quantidade"],
                "variacao": a["posicao"].get("variacao"),
            })
    for r in renda_fixa:
        pilar = r.get("pilar", "caixa")
        if pilar in valor:
            v = float(r.get("valor_aplicado") or 0)
            valor[pilar] += v
            dentro[pilar].append({
                "nome": r.get("nome", "—"), "ticker": None,
                "tipo": r.get("base", ""), "valor": v,
                "score": None, "cor": None, "veredito": r.get("leitura"),
                "quantidade": None, "variacao": None,
            })

    total = sum(valor.values())
    if not total:
        return [], 0.0

    linhas = []
    for chave, nome in PILARES:
        alvo = float(alvos.get(chave, 0))
        pct = valor[chave] / total * 100
        linhas.append({
            "chave": chave, "nome": nome,
            "valor": valor[chave], "pct": pct, "alvo_pct": alvo,
            "desvio_pct": pct - alvo,
            # quanto entraria (ou sairia) para bater a meta com o
            # patrimônio de hoje
            "desvio_reais": total * alvo / 100 - valor[chave],
            # do maior para o menor: a concentração salta à vista
            "composicao": sorted(dentro[chave], key=lambda x: -x["valor"]),
        })
    escala = max([l["pct"] for l in linhas] + [l["alvo_pct"] for l in linhas]) * 1.12
    for l in linhas:
        l["barra_svg"] = grafico.barra_alocacao(l["pct"], l["alvo_pct"], escala)
        for item in l["composicao"]:
            item["peso"] = (item["valor"] / l["valor"] * 100) if l["valor"] else 0
    return linhas, total


def _procedencia(macro):
    """Prepara o texto de origem de cada indicador macro.

    A série da Selic traz a data de VIGÊNCIA da meta, que pode estar no
    futuro (o Copom decide antes de valer). Dizer "apurado em 16/09" num
    dia 09/09 confundiria; o rótulo muda conforme o caso. E quando o dado
    tem mais de 40 dias, a tela avisa: o IPCA de 12 meses costuma sair
    com dois meses de defasagem, e o juro real é calculado em cima dele.
    """
    hoje = date.today()
    for chave, f in (macro.get("fontes") or {}).items():
        f["quando"] = None
        f["atrasado"] = None
        bruta = f.get("data")
        if not bruta:
            f["quando"] = "sem data informada pela fonte"
            continue
        try:
            d, m, a = bruta.split("/")
            quando = date(int(a), int(m), int(d))
        except (ValueError, AttributeError):
            f["quando"] = "referência %s" % bruta
            continue

        if quando > hoje:
            f["quando"] = "vigente a partir de %s" % bruta
        else:
            f["quando"] = "apurado em %s" % bruta
            dias = (hoje - quando).days
            if dias > 40:
                f["atrasado"] = ("o dado mais recente publicado tem %d dias"
                                 % dias)
    return macro


def _proventos_por_mes(lista):
    """Agrupa os proventos recebidos por mês, com a origem de cada um.

    Meses sem pagamento nenhum entram com zero: pular o mês vazio
    encurtaria o eixo e faria uma pausa parecer continuidade.
    """
    # Carteira nova não tem provento nenhum, e esse é o estado de todo
    # mundo no primeiro uso. O vazio precisa ter EXATAMENTE as mesmas
    # chaves do caso cheio — senão o template quebra justamente para
    # quem está abrindo a ferramenta pela primeira vez.
    vazio = {"meses": [], "total": 0.0, "media": 0.0, "media_recente": 0.0,
             "ultimo": 0.0, "primeiro": 0.0, "n_meses": 0}
    if not lista:
        return dict(vazio)

    por_mes = {}
    for p in lista:
        mes = (p.get("data") or "")[:7]
        if len(mes) != 7:
            continue
        d = por_mes.setdefault(mes, {})
        t = p.get("ticker") or "—"
        d[t] = d.get(t, 0.0) + float(p.get("valor") or 0)
    if not por_mes:
        return dict(vazio)

    def proximo(mes):
        a, m = int(mes[:4]), int(mes[5:])
        return "%04d-%02d" % (a + 1, 1) if m == 12 else "%04d-%02d" % (a, m + 1)

    meses, atual, fim = [], min(por_mes), max(por_mes)
    while atual <= fim:
        itens = sorted(por_mes.get(atual, {}).items(), key=lambda x: -x[1])
        meses.append({"mes": atual, "total": sum(v for _, v in itens),
                      "itens": itens})
        atual = proximo(atual)

    total = sum(m["total"] for m in meses)
    # a média dos últimos 3 meses diz mais que a média do período inteiro:
    # a carteira cresceu, e o que ela pagava há um ano não é o que paga hoje
    ultimos = meses[-3:]
    return {
        "meses": meses,
        "total": total,
        "media": total / len(meses),
        "media_recente": sum(m["total"] for m in ultimos) / len(ultimos),
        "ultimo": meses[-1]["total"],
        "primeiro": meses[0]["total"],
        "n_meses": len(meses),
    }


def _enriquece(r):
    """Acrescenta ao resultado o que é puramente de apresentação."""
    if r.get("erro"):
        return r
    r["veredito_curto"] = VEREDITO_CURTO.get(r["veredito"], r["veredito"])
    # "acao_br" cru aparecia na tela como "ACAO BR"
    r["tipo_rotulo"] = (CLASSE_ROTULO.get(r.get("perfil"))
                        or CLASSE_ROTULO.get(r.get("classe"), r.get("classe", "")))
    r["faixa_svg"] = grafico.faixa_52s(r.get("preco"), r.get("min_52s"),
                                       r.get("max_52s"))
    for m in r.get("metricas", []):
        m["rotulo_curto"] = ROTULO_CURTO.get(m["chave"], m["rotulo"])
        m["regua_svg"] = grafico.regua(m)
        m["spark_svg"] = grafico.sparkline(m.get("serie") or [])

    # a coluna do painel mostra as métricas de maior peso que têm dado -
    # cada perfil tem métricas diferentes, então a coluna é adaptativa
    com_dado = [m for m in r.get("metricas", []) if m.get("valor") is not None]
    r["destaques"] = sorted(com_dado, key=lambda m: -m["peso"])[:3]
    return r


def coleta(forcar=False, recalcular=False):
    """forcar=True vai à rede; recalcular=True refaz as contas usando o
    cache de disco das fontes — é o que roda depois de um aporte, para a
    posição atualizar na hora sem esperar download nenhum."""
    assinatura = armazem.assinatura()
    if not (forcar or recalcular) and _CACHE["dados"]             and _CACHE["assinatura"] == assinatura             and time.time() - _CACHE["quando"] < VALIDADE_SEGUNDOS:
        return _CACHE["dados"]

    ttl = 0 if forcar else 6
    if forcar:
        # edições feitas direto no Supabase (Table Editor) entram aqui
        armazem.esquece_leituras()
    regras, carteira = avaliador.carrega_config()
    universo = avaliador.monta_universo(ttl)

    registrados = mod_aportes.consolidado_por_ticker()
    caixa_extra = mod_aportes.consolidado_por_titulo()
    importados = mod_aportes.tickers_importados()

    def avalia_lista(lista, na_carteira):
        saida = []
        for item in lista or []:
            try:
                r = avaliador.avalia(item["ticker"], item["classe"],
                                     universo, regras,
                                     regras.get("janela_historico_anos", 3), ttl)
            except Exception as e:
                r = {"ticker": item["ticker"], "classe": item.get("classe", ""),
                     "erro": "%s: %s" % (type(e).__name__, e),
                     "_trace": traceback.format_exc()}
            tk = item["ticker"].upper()
            reg = registrados.get(tk)
            if tk in importados:
                # o extrato traz a posição inteira: a base do YAML sairia
                # somada por cima e dobraria a quantidade
                item = {**item, "quantidade": 0, "preco_medio": None,
                        "base_substituida": True}
            # comprar algo que estava só na watchlist move o ativo para a
            # carteira sem precisar editar o YAML
            r["na_carteira"] = na_carteira or bool(reg)
            r["pilar"] = item.get("pilar")
            r["posicao"] = _posicao(item, r, reg) if r["na_carteira"] else None
            saida.append(_enriquece(r))
        return saida

    ativos = avalia_lista(carteira.get("carteira"), True)
    ativos += avalia_lista(carteira.get("watchlist"), False)

    renda_fixa = []
    for i in (carteira.get("renda_fixa") or []):
        i = dict(i)
        somado = caixa_extra.get(i.get("nome"), 0.0)
        if somado:
            i["valor_aplicado"] = float(i.get("valor_aplicado") or 0) + somado
            i["aportado_aqui"] = somado
        renda_fixa.append(avaliador.avalia_renda_fixa(i, universo["macro"]))

    total_investido = sum(a["posicao"]["custo"] for a in ativos
                          if a.get("posicao") and a["posicao"]["custo"]) or 0
    total_atual = sum(a["posicao"]["atual"] for a in ativos
                      if a.get("posicao")) or 0
    total_rf = sum(float(i.get("valor_aplicado") or 0) for i in renda_fixa)
    alocacao, patrimonio = _alocacao(ativos, renda_fixa,
                                     carteira.get("alocacao_alvo") or {})

    # curva histórica reconstruída dos aportes + preços de cada dia
    import datetime as _dt
    def _iso(t):
        try:
            return _dt.date.fromisoformat(t)
        except (ValueError, TypeError):
            return None
    brutos = mod_aportes.listar()
    ap_ativos = [{"data": _iso(a["data"]), "ticker": a["ticker"],
                  "quantidade": a["quantidade"], "preco": a["preco"]}
                 for a in brutos
                 if a.get("tipo") == "ativo" and _iso(a.get("data"))]
    ap_caixa = [{"data": _iso(a["data"]), "valor": a["valor"]}
                for a in brutos
                if a.get("tipo") == "caixa" and _iso(a.get("data"))]
    historico = evolucao.serie_da_carteira(ap_ativos, ap_caixa, ativos)
    historico["grafico"] = grafico.linha_evolucao(historico["pontos"])
    historico["grafico_ganho"] = grafico.linha_ganho(historico["pontos"])
    historico["so_caixa"] = bool(ap_caixa) and not ap_ativos
    # a curva conta a renda fixa pelo principal aportado: não há histórico
    # de saldo diário de CDB. A diferença para o patrimônio é o rendimento
    # que a renda fixa acumulou e que a curva não enxerga.
    historico["rendimento_rf"] = max(
        0.0, patrimonio - (historico.get("valor_final") or 0))
    historico["proventos"] = mod_aportes.proventos()
    historico["total_proventos"] = sum(x.get("valor") or 0
                                       for x in historico["proventos"])
    historico["renda_mensal"] = _proventos_por_mes(historico["proventos"])
    historico["grafico_renda"] = grafico.colunas_proventos(
        historico["renda_mensal"]["meses"])

    dados = {
        "ativos": ativos,
        "renda_fixa": renda_fixa,
        "macro": _procedencia(universo["macro"]),
        "regras": regras,
        "alocacao": alocacao,
        "historico": historico,
        "alocacao_alvo": carteira.get("alocacao_alvo") or {},
        "resumo": {
            "investido": total_investido,
            "atual": total_atual,
            "resultado": total_atual - total_investido,
            "variacao": (total_atual / total_investido - 1) * 100 if total_investido else 0,
            "renda_fixa": total_rf,
            "patrimonio": patrimonio or (total_atual + total_rf),
            "tem_preco_medio": bool(total_investido),
        },
        "atualizado": time.strftime("%d/%m/%Y às %H:%M"),
    }
    _CACHE.update(quando=time.time(), dados=dados,
                  assinatura=armazem.assinatura())
    return dados


@app.context_processor
def _origem_dos_dados():
    return {"onde_carteira": Markup(armazem.onde_carteira()),
            "fonte_dados": armazem.descricao()}


@app.errorhandler(armazem.ErroSupabase)
def _erro_supabase(e):
    return _pagina_de_erro(
        "Não consegui falar com o Supabase", str(e),
        "Confira SUPABASE_URL e SUPABASE_SECRET_KEY no <code>.env</code> e "
        "rode <code>python scripts/banco.py verificar</code>."), 503


@app.errorhandler(FileNotFoundError)
def _erro_sem_carteira(e):
    if armazem.usa_supabase() or "carteira.yaml" not in str(e):
        raise e
    return _pagina_de_erro(
        "Ainda não há carteira", str(e),
        "Configure o Supabase (veja o COMECE-AQUI.md) ou crie o arquivo "
        "local com <code>cp config/carteira.exemplo.yaml "
        "config/carteira.yaml</code>."), 500


def _pagina_de_erro(titulo, detalhe, oque_fazer):
    return ("<!doctype html><meta charset=utf-8><title>%s</title>"
            "<body style='font:15px/1.5 system-ui;max-width:640px;margin:60px auto;"
            "padding:0 16px'><h2>%s</h2><p>%s</p><p style='color:#666'>"
            "<small>%s</small></p><p><a href='/'>tentar de novo</a></p>"
            % (escape(titulo), escape(titulo), oque_fazer, escape(detalhe)))


# ------------------------------------------------------------------ filtros
@app.template_filter("num")
def f_num(v, casas=2):
    if v is None:
        return "—"
    return ("%%.%df" % casas % v).replace(".", ",")


@app.template_filter("delta")
def f_delta(v, casas=1):
    """Diferença com sinal explícito: o +/− é a informação, não enfeite."""
    if v is None:
        return "—"
    return ("%%+.%df" % casas % v).replace(".", ",").replace("-", "−")


def _dinheiro(v):
    """Só o texto do valor, sem marcação."""
    if v is None:
        return "—"
    if abs(v) >= 1e9:
        return ("R$ %.2f bi" % (v / 1e9)).replace(".", ",")
    if abs(v) >= 1e6:
        return ("R$ %.1f mi" % (v / 1e6)).replace(".", ",")
    return "R$ " + format(v, ",.2f").replace(",", "@").replace(".", ",").replace("@", ".")


@app.template_filter("dinheiro")
def f_dinheiro(v):
    """Valor DO USUÁRIO, envolvido para o modo privado poder escondê-lo.

    A marcação sai daqui, e não de cada template, para que nenhum valor
    novo apareça na tela já vazando por esquecimento. A liquidez de um
    FII e outros números de mercado passam por _dinheiro() e continuam
    visíveis: não são dinheiro dele.
    """
    return Markup('<span class="rs">%s</span>') % _dinheiro(v)


def _com_unidade(v, u):
    if v is None:
        return "sem dado"
    if u == "R$":
        return _dinheiro(v)          # dado do ativo, não do usuário
    if u == "%":
        return f_num(v) + "%"
    return f_num(v)


@app.template_filter("valor_metrica")
def f_valor_metrica(m):
    return _com_unidade(m["valor"], m.get("unidade", ""))


# ------------------------------------------------------------------- rotas
@app.route("/")
def painel():
    dados = coleta()
    filtro = request.args.get("filtro", "todos")

    ativos = list(dados["ativos"])
    if filtro == "carteira":
        ativos = [a for a in ativos if a.get("na_carteira")]
    elif filtro == "watchlist":
        ativos = [a for a in ativos if not a.get("na_carteira")]

    ativos.sort(key=lambda a: a.get("score") or -1, reverse=True)
    return render_template("painel.html", d=dados, ativos=ativos,
                           filtro=filtro, aba="painel")


@app.route("/ativo/<ticker>")
def ativo(ticker):
    dados = coleta()
    achado = next((a for a in dados["ativos"] if a["ticker"] == ticker.upper()), None)
    if not achado:
        return redirect(url_for("painel"))
    return render_template("ativo.html", a=achado, d=dados, aba="painel")


@app.route("/ativo/<ticker>/fragmento")
def ativo_fragmento(ticker):
    """Só o miolo da análise, para o modal injetar.

    Mesmo template do detalhe completo - a página e o modal nunca podem
    divergir por serem mantidos em dois lugares.
    """
    dados = coleta()
    achado = next((a for a in dados["ativos"]
                   if a["ticker"] == ticker.upper()), None)
    if not achado:
        return "ativo não encontrado", 404
    return render_template("_ativo_conteudo.html", a=achado, d=dados,
                           em_modal=True)


PILAR_NOME = dict(PILARES)


def _num(valor, inteiro=False):
    """Converte campo de formulário em número, aceitando vírgula decimal."""
    if valor is None or str(valor).strip() == "":
        return None
    try:
        v = float(str(valor).replace(".", "").replace(",", ".")
                  if str(valor).count(",") else str(valor))
        return int(v) if inteiro else v
    except ValueError:
        return None


def _mudancas_do_formulario(campos, veio_de_formulario):
    """Campos da tela -> mudanças a aplicar sobre as premissas do YAML."""
    m = {
        "aporte_mensal": _num(campos.get("aporte_mensal")),
        "horizonte_anos": _num(campos.get("horizonte_anos"), inteiro=True),
        "valorizacao_real_anual": {
            "acoes": _num(campos.get("val_acoes")),
            "real_estate": _num(campos.get("val_real_estate")),
            "alternativos": _num(campos.get("val_alternativos")),
        },
        "cenarios": {
            "pessimista": _num(campos.get("cen_pessimista")),
            "otimista": _num(campos.get("cen_otimista")),
        },
        "macro_longo_prazo": {
            "cdi": _num(campos.get("cdi_lp")),
            "ipca": _num(campos.get("ipca_lp")),
        },
    }
    if campos.get("distribuicao_aporte"):
        m["distribuicao_aporte"] = campos.get("distribuicao_aporte")
    # checkbox não enviado significa desmarcado, mas só quando o formulário
    # de fato foi submetido - numa visita normal não pode virar False
    if veio_de_formulario:
        m["reinvestir_proventos"] = campos.get("reinvestir_proventos") == "on"
    return m


@app.route("/projecoes")
def projecoes():
    dados = coleta()
    premissas = projecao.carrega_premissas()

    simulando = "aporte_mensal" in request.args
    if simulando:
        premissas = projecao.aplica(
            premissas, _mudancas_do_formulario(request.args, True))

    p = projecao.projeta(dados, premissas)
    p["simulando"] = simulando
    p["tem_salvo"] = projecao.tem_premissas_salvas()

    base, pess, otim = p["base"], p["pessimista"], p["otimista"]
    p["grafico_patrimonio"] = grafico.linha_projecao(
        base["patrimonio"], pess["patrimonio"], otim["patrimonio"])
    p["grafico_renda"] = grafico.linha_projecao(base["renda"])
    p["grafico_composicao"] = grafico.barras_composicao([
        ("Seus aportes", base["aportado"]),
        ("Proventos reinvestidos", base["proventos"]),
        ("Valorização", base["valorizacao"]),
    ])

    for l in p["pilares"]:
        l["nome"] = PILAR_NOME.get(l["chave"], l["chave"])
    ordem = [c for c, _ in PILARES]
    p["pilares"].sort(key=lambda l: ordem.index(l["chave"])
                      if l["chave"] in ordem else 99)

    caixa = next((l for l in p["pilares"] if l["chave"] == "caixa"), None)
    p["titulos_caixa"] = (caixa or {}).get("titulos") or []
    p["caixa_real"] = (caixa or {}).get("total") or 0.0

    # Se o caixa rende mais que a renda variável, a premissa de juros
    # está conduzindo a projeção inteira - o leitor precisa saber disso
    # antes de olhar qualquer gráfico.
    rv = [l["total"] for l in p["pilares"] if l["chave"] != "caixa"]
    p["alerta_caixa"] = bool(rv) and p["caixa_real"] > max(rv)
    p["macro_lp"]["juro_real"] = (
        ((1 + p["macro_lp"]["cdi"] / 100) / (1 + p["macro_lp"]["ipca"] / 100) - 1) * 100
        if p["macro_lp"].get("cdi") and p["macro_lp"].get("ipca") else None)

    return render_template("projecoes.html", d=dados, p=p, aba="projecoes")


@app.route("/projecoes/salvar", methods=["POST"])
def salva_projecao():
    projecao.salva_premissas(_mudancas_do_formulario(request.form, True))
    return redirect(url_for("projecoes"))


@app.route("/projecoes/restaurar", methods=["POST"])
def restaura_projecao():
    projecao.limpa_premissas()
    return redirect(url_for("projecoes"))


def _opcoes_de_aporte(dados):
    """Ativos que o formulário oferece, já com preço e score prontos."""
    opcoes, mapa = [], {}
    for a in sorted(dados["ativos"], key=lambda x: x["ticker"]):
        if a.get("erro"):
            continue
        opcoes.append(a)
        indic = " · ".join("%s <b>%s</b>" % (m["rotulo_curto"], f_valor_metrica(m))
                           for m in a.get("destaques", []))
        mapa[a["ticker"]] = {
            "ticker": a["ticker"], "preco": a.get("preco"),
            "score": a.get("score"), "veredito": a.get("veredito_curto"),
            "indicadores": indic,
        }
    return opcoes, mapa


def _data_br(iso):
    try:
        a, m, d = iso.split("-")
        return "%s/%s/%s" % (d, m, a)
    except (ValueError, AttributeError):
        return iso or "—"


@app.route("/renda")
def tela_renda():
    """Empresas de setores perenes, filtradas pelos seus quatro critérios."""
    dados = coleta()
    cfg = renda.carrega_config()
    padrao = dict(cfg.get("criterios_padrao") or {})

    # os filtros vêm da URL, com o YAML como ponto de partida
    criterios = dict(padrao)
    for chave in ("dy_desejado", "payout_maximo", "dl_ebitda_maximo",
                  "liquidez_minima"):
        v = _num(request.args.get(chave))
        if v is not None:
            criterios[chave] = v
    # contra quem medir o preço justo: as pares do setor ou um piso único
    criterios["alvo"] = ("fixo" if request.args.get("alvo") == "fixo"
                         else "setor")

    universo = avaliador.monta_universo(6)["acoes"]
    linhas = renda.analisa(universo, cfg, criterios)
    if request.args.get("so_aprovados") == "on":
        linhas = [l for l in linhas if l.get("passa")]

    meus = {a["ticker"] for a in dados["ativos"] if a.get("posicao")}
    for l in linhas:
        l["tenho"] = l["ticker"] in meus

    return render_template(
        "renda.html", d=dados, aba="renda", linhas=linhas,
        blocos=renda.agrupa_por_setor(linhas, cfg),
        resumo=renda.resumo(linhas), criterios=criterios, padrao=padrao,
        so_aprovados=request.args.get("so_aprovados") == "on",
        setores=sorted((cfg.get("setores") or {}).keys()))


_CACHE_BENCH = {"quando": 0, "cdi": None, "ibov": None}


def _benchmarks(anos=5):
    """CDI diário e Ibovespa, com cache de 12h — são pesados e mudam pouco."""
    import datetime as _dt
    if _CACHE_BENCH["cdi"] and time.time() - _CACHE_BENCH["quando"] < 12 * 3600:
        return _CACHE_BENCH["cdi"], _CACHE_BENCH["ibov"]

    inicio = date.today() - _dt.timedelta(days=int(anos * 366))
    cdi = []
    try:
        from src.fontes.comum import http_json
        url = ("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados"
               "?formato=json&dataInicial=%s" % inicio.strftime("%d/%m/%Y"))
        for x in http_json(url, 12):
            d, m, a = x["data"].split("/")
            cdi.append((date(int(a), int(m), int(d)),
                        float(x["valor"].replace(",", "."))))
    except Exception:
        cdi = []

    try:
        from src.fontes import yahoo
        ibov = yahoo.serie("^BVSP", "indice", anos, 12)["precos"]
    except Exception:
        ibov = []

    _CACHE_BENCH.update(quando=time.time(), cdi=cdi, ibov=ibov)
    return cdi, ibov


@app.route("/renda/<ticker>")
def renda_detalhe(ticker):
    """Retorno da ação: só a cota, com dividendos, contra os benchmarks."""
    from src.fontes import yahoo
    dados = coleta()
    cfg = renda.carrega_config()
    ticker = ticker.upper()

    nome, setor = ticker, ""
    for s_nome, bloco in (cfg.get("setores") or {}).items():
        if ticker in (bloco.get("empresas") or {}):
            nome, setor = bloco["empresas"][ticker], s_nome
            break

    anos = int(_num(request.args.get("anos")) or 5)
    try:
        serie_ativo = yahoo.serie(ticker, "acao_br", anos, 6)
    except Exception as e:
        return redirect(url_for("tela_renda", erro=str(e)[:80]))

    cdi, ibov = _benchmarks(anos)
    c = renda.compara(serie_ativo, cdi, ibov)

    series = [
        {"chave": "com_dividendos", "nome": "Com dividendos reinvestidos",
         "pontos": c.get("com_dividendos") or [], "estilo": "principal"},
        {"chave": "so_preco", "nome": "Só a valorização da cota",
         "pontos": c.get("so_preco") or [], "estilo": "secundaria"},
        {"chave": "ibov", "nome": "Ibovespa",
         "pontos": c.get("ibov") or [], "estilo": "referencia"},
        {"chave": "cdi", "nome": "CDI",
         "pontos": c.get("cdi") or [], "estilo": "referencia-2"},
    ]
    resumo = c.get("resumo") or {}
    anos_reais = c.get("anos") or anos

    def ao_ano(total):
        if total is None or anos_reais <= 0:
            return None
        return ((1 + total / 100) ** (1 / anos_reais) - 1) * 100

    linha_ativo = next(
        (l for l in renda.analisa(avaliador.monta_universo(6)["acoes"], cfg,
                                  cfg.get("criterios_padrao") or {})
         if l["ticker"] == ticker), None)

    return render_template(
        "renda_detalhe.html", d=dados, aba="renda", ticker=ticker, nome=nome,
        setor=setor, anos=anos, anos_reais=anos_reais,
        grafico=grafico.linhas_comparadas(series), series=series,
        resumo=resumo, ao_ano={k: ao_ano(v) for k, v in resumo.items()},
        dividendos=len(serie_ativo.get("dividendos") or []),
        linha=linha_ativo)


@app.route("/simular")
def simular():
    """Monta uma cesta de compra e mostra o efeito antes de comprar."""
    dados = coleta()
    opcoes, mapa = _opcoes_de_aporte(dados)

    # o JS precisa do pilar de cada ativo para recalcular a alocação
    for a in opcoes:
        if a["ticker"] in mapa:
            mapa[a["ticker"]]["pilar"] = a.get("pilar")
            mapa[a["ticker"]]["cor"] = a.get("cor")
            mapa[a["ticker"]]["tipo"] = a.get("tipo_rotulo")

    alocacao = [{"chave": l["chave"], "nome": l["nome"], "valor": l["valor"],
                 "pct": l["pct"], "alvo_pct": l["alvo_pct"]}
                for l in dados["alocacao"]]

    ordenados = sorted([a for a in opcoes if a.get("score") is not None],
                       key=lambda a: -a["score"])
    return render_template(
        "simular.html", d=dados, aba="simular", ativos=ordenados,
        ativos_json=json.dumps(mapa, ensure_ascii=False),
        alocacao_json=json.dumps(alocacao, ensure_ascii=False),
        hoje=date.today().isoformat(), ok=request.args.get("ok"))


@app.route("/simular/registrar", methods=["POST"])
def registra_cesta():
    """Converte a cesta simulada em aportes de verdade, de uma vez."""
    data = request.form.get("data") or date.today().isoformat()
    itens = []
    for chave, valor in request.form.items():
        if not chave.startswith("qtd_"):
            continue
        try:
            cotas = float(valor)
        except (TypeError, ValueError):
            continue
        if cotas <= 0:
            continue
        ticker = chave[4:].upper()
        preco = _num(request.form.get("preco_" + ticker))
        if not preco:
            continue
        itens.append({"tipo": "ativo", "ticker": ticker, "quantidade": cotas,
                      "preco": preco, "data": data,
                      "observacao": "cesta simulada"})
    if not itens:
        return redirect(url_for("simular"))

    r = mod_aportes.importa(itens)
    coleta(recalcular=True)
    return redirect(url_for("tela_aportes",
                            ok="%d compra(s) registrada(s) da simulação" % r["novos"]))


@app.route("/aportes")
def tela_aportes():
    dados = coleta()
    opcoes, mapa = _opcoes_de_aporte(dados)

    lista = mod_aportes.listar()
    for a in lista:
        a["data_br"] = _data_br(a.get("data"))
        a.setdefault("valor", (a.get("quantidade") or 0) * (a.get("preco") or 0))

    return render_template(
        "aportes.html", d=dados, aba="aportes", lista=lista,
        opcoes=opcoes, opcoes_json=json.dumps(mapa, ensure_ascii=False),
        titulos=[r.get("nome") for r in dados["renda_fixa"] if r.get("nome")],
        hoje=date.today().isoformat(),
        total_aportado=sum(a.get("valor") or 0 for a in lista),
        erro=request.args.get("erro"), ok=request.args.get("ok"))


@app.route("/aportes", methods=["POST"])
def cria_aporte():
    f = request.form
    try:
        if f.get("tipo") == "caixa":
            mod_aportes.registrar("caixa", titulo=f.get("titulo"),
                                  valor=f.get("valor"), data=f.get("data"),
                                  observacao=f.get("observacao"))
        else:
            if not f.get("ticker"):
                raise ValueError("escolha um ativo")
            mod_aportes.registrar("ativo", ticker=f.get("ticker"),
                                  quantidade=f.get("quantidade"),
                                  preco=f.get("preco"), data=f.get("data"),
                                  observacao=f.get("observacao"))
    except (ValueError, TypeError) as e:
        return redirect(url_for("tela_aportes", erro=str(e)))

    coleta(recalcular=True)      # posição atualiza na hora, sem ir à rede
    return redirect(url_for("tela_aportes"))


def _resolvedor_de_preco(dados):
    """Preço de fechamento de um ticker numa data, vindo do que já foi
    coletado. É o que permite derivar a quantidade de uma compra que o
    extrato informa só em reais."""
    series = {}
    for a in dados["ativos"]:
        s = a.get("serie_preco") or []
        if s:
            series[a["ticker"]] = sorted(s)

    def preco(ticker, data):
        serie = series.get(ticker)
        if not serie:
            return None
        anterior = None
        for d, p in serie:
            if d > data:
                break
            anterior = p
        return anterior
    return preco


@app.route("/aportes/importar", methods=["POST"])
def importa_extrato():
    arquivo = request.files.get("extrato")
    if not arquivo or not arquivo.filename:
        return redirect(url_for("tela_aportes", erro="escolha um arquivo"))

    try:
        lido = importador.le(arquivo.read(),
                             senha=(request.form.get("senha") or "").strip() or None,
                             titulo_caixa=request.form.get("titulo_caixa")
                             or "Cofrinho PicPay",
                             resolve_preco=_resolvedor_de_preco(coleta()))
    except RuntimeError as e:
        # a mensagem crua do zipfile ("Bad password for file") não ajuda
        texto = str(e).lower()
        deu_senha = bool((request.form.get("senha") or "").strip())
        if "bad password" in texto:
            msg = "senha incorreta para este arquivo"
        elif "password" in texto:
            msg = ("senha incorreta para este arquivo" if deu_senha
                   else "o arquivo está protegido — informe a senha do ZIP")
        else:
            msg = str(e)
        return redirect(url_for("tela_aportes", erro=msg))
    except Exception as e:
        return redirect(url_for("tela_aportes",
                                erro="não consegui ler o arquivo: %s" % e))

    r = mod_aportes.importa(lido["itens"])
    coleta(recalcular=True)

    partes = ["%d lançamento(s) importado(s) de %s" % (r["novos"], lido["formato"])]
    if r["repetidos"]:
        partes.append("%d já estavam registrados e foram ignorados" % r["repetidos"])
    if r["falhas"]:
        partes.append("%d com problema" % len(r["falhas"]))
    return redirect(url_for("tela_aportes", ok=" · ".join(partes)))


@app.route("/aportes/excluir", methods=["POST"])
def remove_aporte():
    mod_aportes.excluir(request.form.get("id", ""))
    coleta(recalcular=True)
    return redirect(url_for("tela_aportes"))


@app.route("/atualizar")
def atualizar():
    coleta(forcar=True)
    return redirect(url_for("painel"))


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    porta = int(os.environ.get("PORT", 8000))
    print("Painel em http://%s:%d  (dados: %s; Ctrl+C para parar)"
          % (host, porta, armazem.descricao()))
    app.run(debug=False, host=host, port=porta)
