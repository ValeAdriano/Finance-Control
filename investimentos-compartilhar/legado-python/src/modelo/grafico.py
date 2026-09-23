"""Geração dos SVG do painel.

A peça central é a RÉGUA. As quatro lentes produzem, cada uma, uma
referência na mesma unidade da métrica: o seu ótimo (regra), a mediana
dos 3 anos (histórica), a mediana do setor (pares) e o CDI líquido
(macro). Mostrar quatro notas de 0 a 100 esconde isso; colocar as quatro
referências numa única escala, na unidade real, mostra de uma vez onde o
ativo está e o quanto as referências concordam entre si.

Convenção de leitura: MELHOR fica sempre à direita, inclusive nas
métricas em que o número menor é o melhor (P/VP). O leitor aprende a
direção uma vez e não precisa reinterpretar a cada métrica — e a seta
"melhor" no fim da escala deixa isso explícito, sem depender de memória.
"""
import json
import math

ROTULO_LENTE = {
    "regra": "seu alvo",
    "historica": "mediana 3 anos",
    "pares": "mediana do setor",
    "macro": "renda fixa",
}


def _fmt(v, unidade):
    if v is None:
        return ""
    if unidade == "R$":
        if abs(v) >= 1e6:
            return ("R$ %.1f mi" % (v / 1e6)).replace(".", ",")
        if abs(v) >= 1e3:
            return "R$ %s mil" % ("%.0f" % (v / 1e3))
        return "R$ %.0f" % v
    txt = ("%.2f" % v).replace(".", ",")
    return txt + ("%" if unidade == "%" else "")


def _esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _esc_attr(t):
    """Escapa também as aspas: o JSON do hover vai dentro de um atributo."""
    return _esc(t).replace('"', "&quot;").replace("'", "&#39;")


def regua(m, largura=620, altura=66):
    """SVG da régua de referências de uma métrica."""
    escala = m.get("escala") or {}
    valor = m.get("valor")
    if valor is None:
        return ""
    unidade = m.get("unidade", "")

    marcas = [(L.referencia, ROTULO_LENTE[L.lente])
              for L in m.get("lentes", [])
              if L.referencia is not None and L.lente in ROTULO_LENTE]

    pontos = [valor] + [v for v, _ in marcas]
    pontos += [escala.get(k) for k in ("otimo", "aceitavel")
               if isinstance(escala.get(k), (int, float))]
    pontos = [p for p in pontos if isinstance(p, (int, float))]
    if len(pontos) < 2:
        return ""

    lo, hi = min(pontos), max(pontos)
    if hi == lo:
        hi = lo + abs(lo or 1) * 0.1

    # Liquidez vai de R$ 50 mil a R$ 20 milhões: numa escala linear as
    # referências pequenas colapsam todas no canto esquerdo. Quando a
    # amplitude passa de 20x, a escala vira logarítmica e cada referência
    # volta a ocupar espaço proporcional à sua ordem de grandeza.
    log = lo > 0 and hi / lo > 20
    if log:
        lo, hi = math.log10(lo), math.log10(hi)
    folga = (hi - lo) * 0.14
    lo, hi = lo - folga, hi + folga
    menor_melhor = escala.get("direcao") == "menor_melhor"

    pad_e, pad_d = 10, 62          # espaço à direita para a seta "melhor"
    util = largura - pad_e - pad_d

    def x(v):
        if log:
            v = math.log10(v) if v > 0 else lo
        t = (v - lo) / (hi - lo)
        t = max(0.0, min(1.0, t))
        if menor_melhor:
            t = 1 - t              # melhor sempre à direita
        return pad_e + t * util

    y = 30
    p = ['<svg class="regua" viewBox="0 0 %d %d" role="img" '
         'aria-label="posição do valor atual entre as referências">' % (largura, altura)]

    p.append('<rect class="trilho" x="%d" y="%d" width="%.1f" height="6" rx="3"/>'
             % (pad_e, y - 3, util))

    # A zona boa começa no limite aceitável e vai até o fim da escala:
    # passar do ótimo não sai da zona boa, é ficar ainda melhor. Fechá-la
    # no ótimo daria a impressão contrária — um FII com liquidez muito
    # acima do alvo apareceria fora da faixa.
    a = escala.get("aceitavel")
    if isinstance(a, (int, float)):
        x1 = max(x(a), pad_e)
        x2 = pad_e + util
        if x2 > x1 + 1:
            p.append('<rect class="faixa-boa" x="%.1f" y="%d" width="%.1f" height="6" '
                     'rx="3"><title>a partir de %s você considera aceitável</title>'
                     '</rect>' % (x1, y - 3, x2 - x1, _esc(_fmt(a, unidade))))

    # a direção da escala, dita por extenso — sem isso o leitor precisa
    # descobrir sozinho que em P/VP a escala corre ao contrário
    p.append('<text class="direcao" x="%d" y="%d" text-anchor="start">melhor →</text>'
             % (pad_e + util + 8, y + 4))

    # ticks das referências; rótulos em duas fileiras quando colidem
    marcas.sort(key=lambda t: x(t[0]))
    fim_da_fileira = [-999, -999]
    for v, nome in marcas:
        px = x(v)
        texto = "%s %s" % (nome, _fmt(v, unidade))
        meia = len(texto) * 2.55
        fileira = 0 if px - meia > fim_da_fileira[0] + 10 else 1
        if px - meia <= fim_da_fileira[fileira] + 10:
            continue               # não cabe: o valor segue no texto abaixo
        fim_da_fileira[fileira] = px + meia

        ty = 48 if fileira == 0 else 61
        p.append('<line class="tick" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
                 % (px, y + 5, px, ty - 9))
        ancora, tx = "middle", px
        if px - meia < 0:
            ancora, tx = "start", 0
        elif px + meia > pad_e + util:
            ancora, tx = "end", pad_e + util
        p.append('<text class="rot" x="%.1f" y="%d" text-anchor="%s">%s</text>'
                 % (tx, ty, ancora, _esc(texto)))

    # A segunda medição, quando existe, entra como marcador vazado. O DY
    # do Fundamentus e o calculado pelos proventos divergem, e as lentes
    # não usam o mesmo: sem os dois marcadores a régua contradiz o texto
    # ao lado ("1,18 p.p. acima" com o ponto desenhado abaixo da linha).
    alt = m.get("valor_alt")
    if alt and isinstance(alt.get("valor"), (int, float)):
        pxa = x(alt["valor"])
        p.append('<circle class="anel" cx="%.1f" cy="%d" r="6"/>' % (pxa, y))
        p.append('<circle class="agora-alt" cx="%.1f" cy="%d" r="4"><title>%s: %s'
                 '</title></circle>'
                 % (pxa, y, _esc(alt.get("rotulo", "outra fonte")),
                    _esc(_fmt(alt["valor"], unidade))))

    # o valor de hoje: marcador forte com anel da superfície
    px = x(valor)
    p.append('<line class="agulha" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
             % (px, y - 12, px, y + 12))
    p.append('<circle class="anel" cx="%.1f" cy="%d" r="6.5"/>' % (px, y))
    p.append('<circle class="agora" cx="%.1f" cy="%d" r="4.5"><title>hoje: %s</title>'
             '</circle>' % (px, y, _esc(_fmt(valor, unidade))))
    ancora = "middle"
    if px < 24:
        ancora = "start"
    elif px > pad_e + util - 24:
        ancora = "end"
    p.append('<text class="hoje" x="%.1f" y="12" text-anchor="%s">hoje</text>'
             % (px, ancora))

    p.append("</svg>")
    return "".join(p)


def sparkline(serie, largura=132, altura=32):
    """Linha de 2px com marcador final — contexto, não protagonista."""
    pontos = [v for _, v in serie if v is not None]
    if len(pontos) < 5:
        return ""
    lo, hi = min(pontos), max(pontos)
    faixa = (hi - lo) or 1
    passo = (largura - 8) / (len(pontos) - 1)

    def cy(v):
        return altura - 4 - (v - lo) / faixa * (altura - 12)

    coords = " ".join("%.1f,%.1f" % (4 + i * passo, cy(v))
                      for i, v in enumerate(pontos))
    ux, uy = 4 + (len(pontos) - 1) * passo, cy(pontos[-1])
    return ('<svg class="spark" viewBox="0 0 %d %d" role="img">'
            '<polyline points="%s"/>'
            '<circle class="anel" cx="%.1f" cy="%.1f" r="4.5"/>'
            '<circle class="ponta" cx="%.1f" cy="%.1f" r="2.8"/></svg>'
            % (largura, altura, coords, ux, uy, ux, uy))


def faixa_52s(preco, minimo, maximo, largura=160, altura=32):
    """Onde o preço de hoje está dentro do intervalo de 52 semanas."""
    if not all(isinstance(v, (int, float)) for v in (preco, minimo, maximo)):
        return ""
    if maximo <= minimo:
        return ""
    pad, y = 8, 13
    util = largura - 2 * pad
    t = max(0.0, min(1.0, (preco - minimo) / (maximo - minimo)))
    px = pad + t * util
    return ('<svg class="faixa52" viewBox="0 0 %d %d" role="img">'
            '<rect class="trilho" x="%d" y="%d" width="%d" height="4" rx="2"/>'
            '<circle class="anel" cx="%.1f" cy="%d" r="6"/>'
            '<circle class="agora" cx="%.1f" cy="%d" r="4"><title>hoje</title></circle>'
            '<text class="rot" x="0" y="29" text-anchor="start">%s</text>'
            '<text class="rot" x="%d" y="29" text-anchor="end">%s</text></svg>'
            % (largura, altura, pad, y - 2, util, px, y, px, y,
               _esc(("%.2f" % minimo).replace(".", ",")),
               largura, _esc(("%.2f" % maximo).replace(".", ","))))


# ---------------------------------------------------------------- alocação
def barra_alocacao(pct, alvo_pct, escala, largura=210, altura=22):
    """Barra da alocação atual com o alvo marcado por um traço.

    É um bullet chart: a barra é o valor, o traço vertical é a meta.
    Duas barras lado a lado não bastariam - o que interessa não é
    comparar duas alturas, é ver de que lado da meta o pilar está.
    """
    if escala <= 0:
        return ""
    y, alt = 4, 12
    larg = max(0.0, min(1.0, pct / escala)) * largura
    xa = max(0.0, min(1.0, alvo_pct / escala)) * largura
    return ('<svg class="aloc" viewBox="0 0 %d %d" role="img" '
            'aria-label="%.0f%% contra meta de %.0f%%">'
            '<rect class="trilho" x="0" y="%d" width="%d" height="%d" rx="3"/>'
            '<rect class="preenche" x="0" y="%d" width="%.1f" height="%d" rx="3"/>'
            '<line class="alvo" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
            '<title>alvo %.0f%%</title></svg>'
            % (largura, altura, pct, alvo_pct,
               y, largura, alt, y, larg, alt,
               xa, y - 3, xa, y + alt + 3, alvo_pct))


# ---------------------------------------------------------------- projeção
def _ticks(lo, hi, alvo=5):
    """Valores redondos para o eixo: 0 / 100 mil / 200 mil, nunca 137.428."""
    if hi <= lo:
        return [lo]
    bruto = (hi - lo) / alvo
    mag = 10 ** math.floor(math.log10(bruto))
    for mult in (1, 2, 2.5, 5, 10):
        passo = mag * mult
        if bruto <= passo:
            break
    ini = math.floor(lo / passo) * passo
    saida, v = [], ini
    while v <= hi + passo * 0.01:
        if v >= lo - passo * 0.01:
            saida.append(v)
        v += passo
    return saida


def _reais_curto(v):
    if abs(v) >= 1e6:
        return ("R$ %.1f mi" % (v / 1e6)).replace(".", ",")
    if abs(v) >= 1000:
        return "R$ %d mil" % round(v / 1000)
    return "R$ %d" % round(v)


def _reais_exato(v):
    return "R$ " + format(v, ",.2f").replace(",", "@").replace(".", ",").replace("@", ".")


def _camada_hover(pontos, largura, altura, esq, topo, ly):
    """Área invisível que captura o mouse + os dados de cada ponto.

    Um gráfico em HTML que não responde ao mouse desperdiça metade do
    meio. Os dados vão num data-attribute e um único JS genérico cuida
    de todos os gráficos: cada um decide o que mostrar, ninguém repete
    a lógica de achar o ponto mais próximo.
    """
    return ('<g class="hover-alvo" hidden>'
            '<line class="fio" x1="0" y1="%d" x2="0" y2="%d"/>'
            '<circle class="marca" cx="0" cy="0" r="4.5"/></g>'
            '<rect class="captura" x="%d" y="%d" width="%.1f" height="%d" '
            'fill="transparent" data-pontos="%s"/>'
            % (topo, topo + ly, esq, topo, largura - esq - 14, ly,
               _esc_attr(json.dumps(pontos, ensure_ascii=False))))


def linha_projecao(base, pess=None, otim=None, largura=680, altura=250,
                   formato=_reais_curto):
    """Linha do cenário base com a banda dos cenários alternativos.

    A banda existe para que o número do meio não seja lido como
    promessa. Três linhas de igual peso sugeririam três previsões;
    uma linha dentro de uma faixa sombreada mostra o que de fato há:
    uma trajetória central cercada de incerteza.
    """
    if len(base) < 2:
        return ""
    esq, dir_, topo, baixo = 62, 14, 14, 28
    lx, ly = largura - esq - dir_, altura - topo - baixo

    xs = [p[0] for p in base]
    todos = [p[1] for p in base]
    if pess:
        todos += [p[1] for p in pess]
    if otim:
        todos += [p[1] for p in otim]
    ymin, ymax = 0, max(todos) * 1.06
    xmin, xmax = min(xs), max(xs)

    def px(x):
        return esq + (x - xmin) / (xmax - xmin or 1) * lx

    def py(y):
        return topo + ly - (y - ymin) / (ymax - ymin or 1) * ly

    p = ['<svg class="gcanvas" viewBox="0 0 %d %d" role="img" '
         'aria-label="projeção ao longo do tempo">' % (largura, altura)]

    for t in _ticks(ymin, ymax):
        y = py(t)
        p.append('<line class="grade" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % (esq, y, largura - dir_, y))
        p.append('<text class="eixo" x="%d" y="%.1f" text-anchor="end">%s</text>'
                 % (esq - 8, y + 3.5, _esc(formato(t))))

    passo_x = 5 if (xmax - xmin) > 12 else 2
    ano = math.ceil(xmin)
    while ano <= xmax:
        if ano % passo_x == 0 or ano == math.ceil(xmax):
            p.append('<text class="eixo" x="%.1f" y="%d" text-anchor="middle">'
                     '%d</text>' % (px(ano), altura - 8, ano))
        ano += 1
    if pess and otim:
        cima = " ".join("%.1f,%.1f" % (px(x), py(y)) for x, y in otim)
        baixo_pts = " ".join("%.1f,%.1f" % (px(x), py(y)) for x, y in reversed(pess))
        p.append('<polygon class="banda" points="%s %s"/>' % (cima, baixo_pts))

    linha = " ".join("%.1f,%.1f" % (px(x), py(y)) for x, y in base)
    p.append('<polyline class="serie" points="%s"/>' % linha)

    faixa = {}
    if pess and otim:
        faixa = {i: (pess[i][1], otim[i][1])
                 for i in range(min(len(pess), len(otim), len(base)))}
    dados = []
    for i, (bx, by) in enumerate(base):
        anos = int(round(bx))
        linhas = [["Cenário base", formato(by), 1]]
        if i in faixa:
            linhas.append(["Pessimista", formato(faixa[i][0]), 1])
            linhas.append(["Otimista", formato(faixa[i][1]), 1])
        titulo = ("%d ano" % anos) if anos == 1 else ("%d anos" % anos)
        if abs(bx - anos) > 0.05:
            titulo = "%.1f anos" % bx
        dados.append({"x": round(px(bx), 1), "y": round(py(by), 1),
                      "titulo": titulo, "linhas": linhas})
    p.append(_camada_hover(dados, largura, altura, esq, topo, ly))

    ux, uy = px(base[-1][0]), py(base[-1][1])
    p.append('<circle class="anel" cx="%.1f" cy="%.1f" r="5.5"/>' % (ux, uy))
    p.append('<circle class="ponta" cx="%.1f" cy="%.1f" r="3.5"/>' % (ux, uy))
    p.append('<text class="valor-fim" x="%.1f" y="%.1f" text-anchor="end">%s</text>'
             % (ux - 2, uy - 11, _esc(formato(base[-1][1]))))
    p.append("</svg>")
    return "".join(p)


def barras_composicao(partes, largura=680, altura=54):
    """Barra empilhada: de onde vem o patrimônio projetado.

    partes = [(rotulo, valor), ...]. Segmentos separados por 2px da
    cor da superfície - a separação é o vão, nunca um contorno.
    """
    partes = [(r, v) for r, v in partes if v and v > 0]
    total = sum(v for _, v in partes)
    if not total:
        return ""
    y, alt, vao = 6, 26, 2
    x = 0.0
    p = ['<svg class="gbarra" viewBox="0 0 %d %d" role="img">' % (largura, altura)]
    for i, (rotulo, valor) in enumerate(partes):
        w = valor / total * (largura - vao * (len(partes) - 1))
        p.append('<rect class="seg s%d" x="%.1f" y="%d" width="%.1f" height="%d" '
                 'rx="3"><title>%s: %s (%.0f%%)</title></rect>'
                 % (i + 1, x, y, w, alt, _esc(rotulo),
                    _esc(_reais_curto(valor)), valor / total * 100))
        # só rotula dentro do segmento quando o texto cabe de fato
        if w > 62:
            p.append('<text class="dentro" x="%.1f" y="%d" text-anchor="middle">'
                     '%.0f%%</text>' % (x + w / 2, y + 17, valor / total * 100))
        x += w + vao
    p.append("</svg>")
    return "".join(p)


def linha_evolucao(pontos, largura=680, altura=250):
    """Valor da carteira contra o custo acumulado.

    Duas linhas, e a distância entre elas é o ganho. A do valor leva o
    acento; a do custo fica em cinza, como referência — se as duas
    tivessem o mesmo peso visual, o olho procuraria qual está "vencendo"
    em vez de ler o vão entre elas, que é a informação.
    """
    if len(pontos) < 2:
        return ""
    esq, dir_, topo, baixo = 62, 14, 16, 30
    lx, ly = largura - esq - dir_, altura - topo - baixo

    valores = [p["valor"] for p in pontos] + [p["custo"] for p in pontos]
    ymax = max(valores) * 1.08 or 1
    n = len(pontos) - 1

    def px(i):
        return esq + i / n * lx

    def py(v):
        return topo + ly - v / ymax * ly

    p = ['<svg class="gcanvas" viewBox="0 0 %d %d" role="img" '
         'aria-label="evolução da carteira">' % (largura, altura)]

    for t in _ticks(0, ymax):
        y = py(t)
        p.append('<line class="grade" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % (esq, y, largura - dir_, y))
        p.append('<text class="eixo" x="%d" y="%.1f" text-anchor="end">%s</text>'
                 % (esq - 8, y + 3.5, _esc(_reais_curto(t))))

    # rótulos de mês: um a cada ~8 pontos, para não empilhar
    MES = ["jan", "fev", "mar", "abr", "mai", "jun",
           "jul", "ago", "set", "out", "nov", "dez"]
    passo = max(1, len(pontos) // 7)
    for i in range(0, len(pontos), passo):
        d = pontos[i]["data"]
        p.append('<text class="eixo" x="%.1f" y="%d" text-anchor="middle">'
                 '%s/%s</text>' % (px(i), altura - 9, MES[d.month - 1],
                                   str(d.year)[2:]))

    custo = " ".join("%.1f,%.1f" % (px(i), py(q["custo"]))
                     for i, q in enumerate(pontos))
    p.append('<polyline class="serie-ref" points="%s"/>' % custo)

    valor = " ".join("%.1f,%.1f" % (px(i), py(q["valor"]))
                     for i, q in enumerate(pontos))
    p.append('<polyline class="serie" points="%s"/>' % valor)

    ux, uy = px(len(pontos) - 1), py(pontos[-1]["valor"])
    p.append('<circle class="anel" cx="%.1f" cy="%.1f" r="5.5"/>' % (ux, uy))
    p.append('<circle class="ponta" cx="%.1f" cy="%.1f" r="3.5"/>' % (ux, uy))
    p.append('<text class="valor-fim" x="%.1f" y="%.1f" text-anchor="end">%s</text>'
             % (ux - 2, uy - 11, _esc(_reais_curto(pontos[-1]["valor"]))))

    dados = []
    for i, q in enumerate(pontos):
        ganho = q["valor"] - q["custo"]
        dados.append({
            "x": round(px(i), 1), "y": round(py(q["valor"]), 1),
            "titulo": q["data"].strftime("%d/%m/%Y"),
            "linhas": [["Valor", _reais_exato(q["valor"]), 1],
                       ["Custo", _reais_exato(q["custo"]), 1],
                       ["Ganho", ("%s%s" % ("+" if ganho >= 0 else "−",
                                            _reais_exato(abs(ganho)))), 1]],
        })
    p.append(_camada_hover(dados, largura, altura, esq, topo, ly))
    p.append("</svg>")
    return "".join(p)


def linha_ganho(pontos, largura=680, altura=140):
    """O ganho (valor − custo) ao longo do tempo, contra a linha do zero.

    Na curva do patrimônio um ganho de 1,6% some: a diferença entre as
    duas linhas é fina demais perto de uma escala que vai a dezenas de
    milhares. Aqui a mesma informação ganha escala própria, e o que
    interessa — quando a carteira esteve acima e abaixo do que custou —
    fica visível.
    """
    if len(pontos) < 2:
        return ""
    esq, dir_, topo, baixo = 62, 14, 14, 26
    lx, ly = largura - esq - dir_, altura - topo - baixo

    ganhos = [p["valor"] - p["custo"] for p in pontos]
    lim = max(abs(min(ganhos)), abs(max(ganhos))) or 1
    lim *= 1.15
    n = len(pontos) - 1

    def px(i):
        return esq + i / n * lx

    def py(v):
        return topo + ly / 2 - (v / lim) * (ly / 2)

    zero = py(0)
    p = ['<svg class="gcanvas gganho" viewBox="0 0 %d %d" role="img" '
         'aria-label="ganho acumulado">' % (largura, altura)]

    for t in (lim / 1.15, 0, -lim / 1.15):
        y = py(t)
        p.append('<line class="%s" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % ("zero" if abs(t) < 1e-9 else "grade", esq, y,
                    largura - dir_, y))
        p.append('<text class="eixo" x="%d" y="%.1f" text-anchor="end">%s</text>'
                 % (esq - 8, y + 3.5, _esc(_reais_curto(t))))

    caminho = " ".join("%.1f,%.1f" % (px(i), py(g)) for i, g in enumerate(ganhos))
    # área entre a curva e o zero: o sinal fica legível de relance
    p.append('<polygon class="area-ganho" points="%.1f,%.1f %s %.1f,%.1f"/>'
             % (esq, zero, caminho, esq + lx, zero))
    p.append('<polyline class="serie" points="%s"/>' % caminho)

    dados = []
    for i, g in enumerate(ganhos):
        dados.append({
            "x": round(px(i), 1), "y": round(py(g), 1),
            "titulo": pontos[i]["data"].strftime("%d/%m/%Y"),
            "linhas": [["Ganho", ("%s%s" % ("+" if g >= 0 else "−",
                                            _reais_exato(abs(g)))), 1]],
        })
    p.append(_camada_hover(dados, largura, altura, esq, topo, ly))

    ux, uy = px(n), py(ganhos[-1])
    p.append('<circle class="anel" cx="%.1f" cy="%.1f" r="5"/>' % (ux, uy))
    p.append('<circle class="ponta" cx="%.1f" cy="%.1f" r="3.2"/>' % (ux, uy))
    p.append('<text class="valor-fim" x="%.1f" y="%.1f" text-anchor="end">%s</text>'
             % (ux - 2, uy - 10, _esc(("%+d" % round(ganhos[-1])).replace("+", "+R$ ")
                                      .replace("-", "−R$ "))))
    p.append("</svg>")
    return "".join(p)


MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun",
               "jul", "ago", "set", "out", "nov", "dez"]


def colunas_proventos(meses, largura=680, altura=210):
    """Quanto a carteira depositou em cada mês.

    Coluna, não linha: cada mês é um período fechado, com um valor que
    entrou na conta. Uma linha sugeriria medição contínua e interpolação
    entre os pontos — "no dia 15 de março o provento era X" não significa
    nada aqui.

    meses = [{"mes": "2026-09", "total": 33.88,
              "itens": [("MXRF11", 15.60), ...]}]
    """
    if len(meses) < 2:
        return ""
    esq, dir_, topo, baixo = 58, 14, 20, 32
    lx, ly = largura - esq - dir_, altura - topo - baixo

    ymax = max(m["total"] for m in meses) * 1.15 or 1
    n = len(meses)
    faixa = lx / n
    largura_col = min(24.0, faixa * 0.62)      # nunca preenche a faixa toda

    def cx(i):
        return esq + faixa * (i + 0.5)

    def py(v):
        return topo + ly - (v / ymax) * ly

    p = ['<svg class="gcanvas gcolunas" viewBox="0 0 %d %d" role="img" '
         'aria-label="proventos recebidos por mês">' % (largura, altura)]

    for t in _ticks(0, ymax, 4):
        y = py(t)
        p.append('<line class="grade" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % (esq, y, largura - dir_, y))
        p.append('<text class="eixo" x="%d" y="%.1f" text-anchor="end">%s</text>'
                 % (esq - 8, y + 3.5, _esc(_reais_curto(t))))

    passo_rot = 1 if n <= 14 else 2
    dados = []
    for i, m in enumerate(meses):
        ano, mes = m["mes"].split("-")
        altura_col = max(1.0, ly - (py(m["total"]) - topo))
        p.append('<rect class="coluna" x="%.1f" y="%.1f" width="%.1f" '
                 'height="%.1f" rx="3"/>'
                 % (cx(i) - largura_col / 2, py(m["total"]), largura_col,
                    altura_col))
        if i % passo_rot == 0 or i == n - 1:
            p.append('<text class="eixo" x="%.1f" y="%d" text-anchor="middle">'
                     '%s/%s</text>' % (cx(i), altura - 11,
                                       MESES_CURTO[int(mes) - 1], ano[2:]))

        linhas = [[t, _reais_exato(v), 1] for t, v in m["itens"]]
        if len(m["itens"]) > 1:
            linhas.insert(0, ["Total do mês", _reais_exato(m["total"]), 1])
        dados.append({"x": round(cx(i), 1), "y": round(py(m["total"]), 1),
                      "titulo": "%s/%s" % (MESES_CURTO[int(mes) - 1], ano),
                      "linhas": linhas})

    # o valor do último mês fica dito por extenso: é o número que a
    # pessoa procura ao abrir a tela
    ultimo = meses[-1]
    # centralizado o rótulo sairia do viewBox na última coluna, que fica
    # colada na borda; perto da direita ele passa a alinhar pelo fim
    ux = cx(n - 1)
    ancora = "end" if ux > largura - dir_ - 26 else "middle"
    p.append('<text class="valor-fim" x="%.1f" y="%.1f" text-anchor="%s">'
             '%s</text>' % (min(ux, largura - dir_), py(ultimo["total"]) - 8,
                            ancora, _esc(_reais_curto(ultimo["total"]))))

    p.append(_camada_hover(dados, largura, altura, esq, topo, ly))
    p.append("</svg>")
    return "".join(p)


def linhas_comparadas(series, largura=680, altura=280):
    """Várias curvas em base 100 no mesmo eixo.

    series = [{"chave","nome","pontos":[(data,valor)],"estilo"}]
    estilo: "principal" | "secundaria" | "referencia" | "referencia-2"

    Emphasis, não paleta: as duas curvas do ativo levam cor, os
    benchmarks ficam em cinza. Quatro cores de igual peso fariam o olho
    procurar qual está ganhando; o que interessa é a distância entre as
    duas do ativo, com o mercado ao fundo como régua.
    """
    series = [s for s in series if len(s.get("pontos") or []) > 1]
    if not series:
        return ""
    esq, dir_, topo, baixo = 62, 14, 16, 30
    lx, ly = largura - esq - dir_, altura - topo - baixo

    todos = [v for s in series for _, v in s["pontos"]]
    lo, hi = min(todos), max(todos)
    folga = (hi - lo) * 0.08 or 1
    lo, hi = max(0, lo - folga), hi + folga

    datas = [d for s in series for d, _ in s["pontos"]]
    d0, d1 = min(datas), max(datas)
    span = (d1 - d0).days or 1

    def px(d):
        return esq + (d - d0).days / span * lx

    def py(v):
        return topo + ly - (v - lo) / (hi - lo) * ly

    p = ['<svg class="gcanvas gcomp" viewBox="0 0 %d %d" role="img" '
         'aria-label="retorno comparado">' % (largura, altura)]

    for t in _ticks(lo, hi, 4):
        y = py(t)
        p.append('<line class="grade" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % (esq, y, largura - dir_, y))
        p.append('<text class="eixo" x="%d" y="%.1f" text-anchor="end">%d</text>'
                 % (esq - 8, y + 3.5, round(t)))

    # base 100 marcada: é de onde todo mundo partiu
    if lo < 100 < hi:
        p.append('<line class="base100" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>'
                 % (esq, py(100), largura - dir_, py(100)))

    anos = sorted({d.year for d in datas})
    for ano in anos:
        import datetime as _dt
        marca = _dt.date(ano, 1, 1)
        if d0 <= marca <= d1:
            p.append('<text class="eixo" x="%.1f" y="%d" text-anchor="middle">'
                     '%d</text>' % (px(marca), altura - 10, ano))

    # referências primeiro, para ficarem atrás das curvas do ativo
    ordem = {"referencia": 0, "referencia-2": 1, "secundaria": 2, "principal": 3}
    for s in sorted(series, key=lambda x: ordem.get(x.get("estilo"), 9)):
        pts = " ".join("%.1f,%.1f" % (px(d), py(v)) for d, v in s["pontos"])
        p.append('<polyline class="linha %s" points="%s"/>'
                 % (s.get("estilo", "principal"), pts))

    principal = next((s for s in series if s.get("estilo") == "principal"), None)
    if principal:
        ud, uv = principal["pontos"][-1]
        p.append('<circle class="anel" cx="%.1f" cy="%.1f" r="5"/>'
                 % (px(ud), py(uv)))
        p.append('<circle class="ponta" cx="%.1f" cy="%.1f" r="3.2"/>'
                 % (px(ud), py(uv)))

    # hover sobre a curva principal, mostrando todas no mesmo instante
    if principal:
        indices = {s["chave"]: dict(s["pontos"]) for s in series}
        dados = []
        for d, v in principal["pontos"]:
            linhas_t = []
            for s in series:
                valor = indices[s["chave"]].get(d)
                if valor is not None:
                    linhas_t.append([s["nome"],
                                     ("%+.1f%%" % (valor - 100)).replace(".", ","),
                                     0])
            dados.append({"x": round(px(d), 1), "y": round(py(v), 1),
                          "titulo": d.strftime("%d/%m/%Y"), "linhas": linhas_t})
        # um ponto por semana basta e deixa o atributo menor
        dados = dados[::5] or dados
        p.append(_camada_hover(dados, largura, altura, esq, topo, ly))

    p.append("</svg>")
    return "".join(p)
