"""Importação de extratos.

Cada instituição exporta num formato diferente, então o importador
detecta o layout pelo cabeçalho em vez de exigir que você diga qual é.

Regra que vale para todos: **nada é importado duas vezes**. Cada
lançamento vira uma origem única (instituição + data + valor + descrição);
reimportar o mesmo arquivo, ou um arquivo com período sobreposto, só
acrescenta o que ainda não estava lá. Sem isso, importar de novo depois
de baixar um extrato mais recente duplicaria a carteira inteira.
"""
import csv
import hashlib
import io
import re
import zipfile
from datetime import datetime


def _num(texto):
    """'−R$ 1.234,56' -> -1234.56  (inclusive com o menos unicode)."""
    if texto is None:
        return None
    s = str(texto).strip()
    s = s.replace("−", "-").replace("–", "-")
    s = s.replace("R$", "").replace(" ", "").replace("\xa0", "")
    negativo = s.startswith("-") or s.startswith("(")
    s = re.sub(r"[^\d,.]", "", s)
    if not s:
        return None
    if "," in s:                       # formato brasileiro
        s = s.replace(".", "").replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if negativo else v


def _data(texto):
    for formato in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(texto).strip(), formato).date()
        except (ValueError, TypeError):
            continue
    return None


def _texto_do_arquivo(dados, senha=None):
    """Aceita CSV cru ou ZIP (com ou sem senha)."""
    if dados[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(dados))
        nome = next((n for n in z.namelist()
                     if n.lower().endswith((".csv", ".txt"))), None)
        if not nome:
            raise ValueError("o ZIP não contém nenhum CSV")
        bruto = z.read(nome, pwd=senha.encode() if senha else None)
    else:
        bruto = dados
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return bruto.decode(enc)
        except UnicodeDecodeError:
            continue
    return bruto.decode("utf-8", errors="replace")


def _linhas(texto):
    amostra = texto[:4000]
    try:
        dialeto = csv.Sniffer().sniff(amostra, delimiters=",;\t")
        sep = dialeto.delimiter
    except csv.Error:
        sep = ";" if amostra.count(";") > amostra.count(",") else ","
    return list(csv.DictReader(io.StringIO(texto), delimiter=sep))


def _coluna(cabecalhos, *candidatos):
    """Acha a coluna pelo nome, ignorando acento, caixa e espaços."""
    def limpa(t):
        t = (t or "").lower().strip()
        for de, para in (("ç", "c"), ("ã", "a"), ("á", "a"), ("é", "e"),
                         ("ê", "e"), ("í", "i"), ("ó", "o"), ("õ", "o"),
                         ("ú", "u"), ("â", "a")):
            t = t.replace(de, para)
        return re.sub(r"[^a-z0-9]", "", t)

    mapa = {limpa(c): c for c in cabecalhos}
    for cand in candidatos:
        alvo = limpa(cand)
        if alvo in mapa:
            return mapa[alvo]
    for cand in candidatos:                 # tentativa por conteúdo parcial
        alvo = limpa(cand)
        for chave, original in mapa.items():
            if alvo and alvo in chave:
                return original
    return None


def origem(instituicao, *partes, ocorrencia=1):
    """Identidade estável do lançamento, para não importar duas vezes.

    `ocorrencia` distingue lançamentos genuinamente idênticos no mesmo
    dia - o extrato do PicPay traz duas guardas de R$ 100 em 15/01, às
    13h30 e às 13h56. Sem esse desempate, uma das duas seria tomada por
    repetição e a importação perderia R$ 100.
    """
    crua = "|".join([instituicao] + [str(p) for p in partes] + [str(ocorrencia)])
    return instituicao + ":" + hashlib.sha1(crua.encode()).hexdigest()[:12]


# ------------------------------------------------------------------ PicPay
def _le_picpay(linhas, titulo_caixa):
    """Extrato de conta do PicPay: movimentações de cofrinho viram
    aportes em renda fixa; o resto é gasto do dia a dia e é ignorado."""
    if not linhas:
        return []
    cols = linhas[0].keys()
    c_data = _coluna(cols, "data")
    c_tipo = _coluna(cols, "tipo")
    c_orig = _coluna(cols, "origem / destino", "origem", "destino", "descricao")
    c_valor = _coluna(cols, "valor")
    c_hora = _coluna(cols, "hora")
    if not all((c_data, c_tipo, c_valor)):
        return []

    saida = []
    vistos = {}
    for r in linhas:
        tipo = (r.get(c_tipo) or "").lower()
        descricao = r.get(c_orig) or ""
        if "cofrinho" not in descricao.lower():
            continue
        data = _data(r.get(c_data))
        valor = _num(r.get(c_valor))
        if not data or valor is None:
            continue
        # "guardado" sai da conta e entra no cofrinho: é aporte.
        # "resgatado" é retirada, e entra como aporte negativo.
        guardou = "guardad" in tipo
        montante = abs(valor) if guardou else -abs(valor)
        nome_cofrinho = re.sub(r"^(No|Do) cofrinho\s*", "", descricao).strip()
        hora = (r.get(c_hora) or "") if c_hora else ""
        chave = (data, valor, descricao, tipo, hora)
        vistos[chave] = vistos.get(chave, 0) + 1
        saida.append({
            "tipo": "caixa", "titulo": titulo_caixa, "valor": montante,
            "data": data.isoformat(),
            "observacao": ("PicPay · %s%s" %
                           (nome_cofrinho, "" if guardou else " (resgate)"))[:120],
            "origem": origem("picpay", data, valor, descricao, tipo, hora,
                             ocorrencia=vistos[chave]),
        })
    return saida


# --------------------------------------------------------------- corretora
NEGOCIO_COMPRA = ("compra", "c", "credito", "aquisicao")
NEGOCIO_VENDA = ("venda", "v", "debito", "alienacao")


def _le_corretora(linhas):
    """Nota de negociação / extrato de movimentação de corretora.

    Procura as colunas por nome em vez de exigir uma ordem fixa, porque
    cada corretora nomeia à sua maneira - o que muda entre elas é o
    rótulo, não a informação.
    """
    if not linhas:
        return []
    cols = linhas[0].keys()
    c_data = _coluna(cols, "data do negocio", "data negocio", "data", "data da operacao")
    c_ticker = _coluna(cols, "codigo de negociacao", "codigo", "ticker", "ativo", "papel")
    c_qtd = _coluna(cols, "quantidade", "qtd", "qtde")
    c_preco = _coluna(cols, "preco", "preco unitario", "valor unitario", "preco medio")
    c_tipo = _coluna(cols, "tipo de movimentacao", "tipo", "operacao", "c/v",
                     "compra/venda", "entrada/saida")
    c_total = _coluna(cols, "valor da operacao", "valor total", "valor")

    if not (c_data and c_ticker and c_qtd):
        return []

    saida = []
    vistos = {}
    for r in linhas:
        data = _data(r.get(c_data))
        bruto_ticker = (r.get(c_ticker) or "").strip().upper()
        ticker = re.sub(r"[^A-Z0-9]", "", bruto_ticker.split()[0]) if bruto_ticker else ""
        qtd = _num(r.get(c_qtd))
        if not (data and ticker and qtd):
            continue

        preco = _num(r.get(c_preco)) if c_preco else None
        total = _num(r.get(c_total)) if c_total else None
        if not preco and total and qtd:
            preco = abs(total) / abs(qtd)
        if not preco:
            continue

        movimento = (r.get(c_tipo) or "").strip().lower() if c_tipo else "compra"
        if any(movimento.startswith(v) for v in NEGOCIO_VENDA):
            qtd = -abs(qtd)
        elif not any(movimento.startswith(c) for c in NEGOCIO_COMPRA) and movimento:
            continue           # transferência, bonificação, etc.: fora

        chave = (data, ticker, qtd, preco)
        vistos[chave] = vistos.get(chave, 0) + 1
        saida.append({
            "tipo": "ativo", "ticker": ticker, "quantidade": abs(qtd),
            "preco": abs(preco), "data": data.isoformat(),
            "venda": qtd < 0,
            "observacao": ("importado · %s" % movimento)[:120] if movimento
                          else "importado",
            "origem": origem("corretora", data, ticker, qtd, preco,
                             ocorrencia=vistos[chave]),
        })
    return saida


# ------------------------------------------------------------------- C6
# O extrato de conta corrente do C6 traz o ticker e o valor pago, mas NÃO
# a quantidade. Ela é derivada dividindo o valor pelo preço de fechamento
# do dia e arredondando: ação, FII e ETF só negociam em unidades inteiras,
# então o arredondamento não é chute - é a única quantidade possível.
# Na carteira real isso reproduziu 11 dos 12 ativos exatamente.
#
# O "F" opcional cobre o mercado fracionario: as compras de BBAS3
# saem no extrato como "BBAS3F", e e a mesma acao.
RE_TICKER = re.compile(r"-\s*([A-Z]{4}\d{1,2})F?(?![A-Z0-9])")


def _le_c6(linhas, resolve_preco=None):
    if not linhas:
        return []
    cols = linhas[0].keys()
    c_data = _coluna(cols, "data lancamento", "data lançamento", "data")
    c_tit = _coluna(cols, "titulo", "título")
    c_desc = _coluna(cols, "descricao", "descrição")
    c_ent = _coluna(cols, "entrada(r$)", "entrada")
    c_sai = _coluna(cols, "saida(r$)", "saída(r$)", "saida", "saída")
    if not all((c_data, c_tit, c_ent, c_sai)):
        return []

    compras, estornos, saida = [], [], []
    vistos = {}
    for r in linhas:
        titulo = (r.get(c_tit) or "").strip().upper()
        desc = r.get(c_desc) or ""
        data = _data(r.get(c_data))
        if not data:
            continue
        entrada = _num(r.get(c_ent)) or 0.0
        saiu = _num(r.get(c_sai)) or 0.0
        m = RE_TICKER.search(desc)

        if titulo == "COMPRA DE ATIVO B3" and m and saiu:
            compras.append({"data": data, "ticker": m.group(1), "valor": saiu})
        elif titulo == "ESTORNO COMPRA ATIVO" and m and entrada:
            estornos.append({"data": data, "ticker": m.group(1), "valor": entrada})
        elif titulo == "CREDITO OPERACAO B3" and entrada > 1:
            # Reversão de ordem que o C6 não rotula como estorno: entra como
            # "crédito de operação", sem dizer o ativo. Só é reversão quando
            # bate exatamente com uma compra do mesmo dia - os outros
            # créditos desse tipo são sobras de centavos.
            estornos.append({"data": data, "ticker": None, "valor": entrada})
        elif titulo in ("EMISSAO DE CDB", "APLICACAO DE CDB",
                        "APLICAÇÃO DE CDB") and saiu:
            # O extrato não diz em qual CDB o dinheiro entrou, e não há como
            # saber. Entra como histórico para a curva de evolução ficar
            # completa; o saldo de cada título continua vindo do YAML.
            chave = (data, saiu, titulo)
            vistos[chave] = vistos.get(chave, 0) + 1
            saida.append({
                "tipo": "caixa", "titulo": "CDB (C6)", "valor": saiu,
                "data": data.isoformat(), "observacao": "C6 · %s" % titulo.lower(),
                "origem": origem("c6cdb", data, saiu, titulo,
                                 ocorrencia=vistos[chave]),
            })
        elif titulo in ("RENDIMENTOS", "JUROS SOBRE CAPITAL", "DIVIDENDOS") and entrada:
            ticker = (desc or "").strip().upper()
            ticker = re.sub(r"[^A-Z0-9]", "", ticker.split()[0]) if ticker else ""
            chave = (data, ticker, entrada, titulo)
            vistos[chave] = vistos.get(chave, 0) + 1
            saida.append({
                "tipo": "provento", "ticker": ticker, "valor": entrada,
                "data": data.isoformat(),
                "observacao": ("C6 · %s" % titulo.lower())[:120],
                "origem": origem("c6prov", data, ticker, entrada, titulo,
                                 ocorrencia=vistos[chave]),
            })

    # uma compra cancelada no mesmo dia e valor nunca aconteceu
    for e in estornos:
        for i, c in enumerate(compras):
            mesmo_ativo = e["ticker"] is None or c["ticker"] == e["ticker"]
            if (mesmo_ativo and c["data"] == e["data"]
                    and abs(c["valor"] - e["valor"]) < 0.01):
                compras.pop(i)
                break

    for c in compras:
        preco = resolve_preco(c["ticker"], c["data"]) if resolve_preco else None
        if not preco:
            continue
        qtd = max(1, round(c["valor"] / preco))
        chave = (c["data"], c["ticker"], c["valor"])
        vistos[chave] = vistos.get(chave, 0) + 1
        saida.append({
            "tipo": "ativo", "ticker": c["ticker"], "quantidade": qtd,
            # preço efetivo: o que foi pago dividido pelas cotas que vieram
            "preco": c["valor"] / qtd, "data": c["data"].isoformat(),
            "observacao": "C6 · compra",
            "origem": origem("c6", c["data"], c["ticker"], c["valor"],
                             ocorrencia=vistos[chave]),
        })
    return saida


# ------------------------------------------------------------------ público
def _pula_preambulo(texto):
    """O extrato do C6 abre com agência, conta e datas antes do cabeçalho."""
    linhas = texto.splitlines()
    for i, l in enumerate(linhas[:40]):
        if l.lower().replace(" ", "").startswith(("datalan", "data,")):
            return "\n".join(linhas[i:])
    return texto


def le(dados, senha=None, titulo_caixa="Cofrinho PicPay", resolve_preco=None):
    """Detecta o formato e devolve a lista de aportes candidatos."""
    texto = _pula_preambulo(_texto_do_arquivo(dados, senha))
    linhas = _linhas(texto)
    if not linhas:
        raise ValueError("não consegui ler nenhuma linha do arquivo")

    cols = list(linhas[0].keys())
    achados = _le_c6(linhas, resolve_preco)
    formato = "C6"
    if not achados:
        achados = _le_corretora(linhas)
        formato = "corretora"
    if not achados:
        achados = _le_picpay(linhas, titulo_caixa)
        formato = "picpay"
    if not achados:
        raise ValueError(
            "formato não reconhecido. Colunas encontradas: %s"
            % ", ".join(str(c) for c in cols[:12]))
    return {"formato": formato, "itens": achados, "colunas": cols}
