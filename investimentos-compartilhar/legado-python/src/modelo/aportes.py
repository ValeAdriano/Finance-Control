"""Registro de aportes.

O `carteira.yaml` guarda a posição que já existia quando a ferramenta
começou a ser usada. Daqui para frente cada compra entra aqui, e a
posição mostrada no painel é a base do YAML mais os aportes.

Duas consequências boas de registrar em vez de digitar:

- o preço médio deixa de ser um número que você mantém à mão e passa a
  ser calculado do que de fato foi pago;
- dá para desfazer. Um aporte lançado errado é removido sem que nada
  mais precise ser recalculado na unha.

Guardado no Supabase quando ele está configurado, ou em JSON legível
em dados/aportes.json — veja src/armazem.py.
"""
from datetime import date

from .. import armazem


def _carrega_bruto():
    return armazem.aportes()


def listar():
    """Aportes do mais recente para o mais antigo."""
    return sorted(_carrega_bruto(),
                  key=lambda a: (a.get("data", ""), a.get("criado_em", "")),
                  reverse=True)


def registrar(tipo, **campos):
    """tipo 'ativo' (ticker/quantidade/preco) ou 'caixa' (titulo/valor)."""
    item = {
        "id": armazem.novo_id(),
        "tipo": tipo,
        "data": campos.get("data") or date.today().isoformat(),
        "criado_em": date.today().isoformat(),
    }

    if tipo == "ativo":
        qtd = float(campos.get("quantidade") or 0)
        preco = float(campos.get("preco") or 0)
        if qtd <= 0 or preco <= 0:
            raise ValueError("quantidade e preço precisam ser maiores que zero")
        item.update(ticker=str(campos["ticker"]).upper(),
                    quantidade=qtd, preco=preco, valor=qtd * preco)
    elif tipo == "caixa":
        valor = float(campos.get("valor") or 0)
        if valor <= 0:
            raise ValueError("o valor precisa ser maior que zero")
        item.update(titulo=str(campos["titulo"]), valor=valor)
    else:
        raise ValueError("tipo de aporte desconhecido: %s" % tipo)

    item["observacao"] = (campos.get("observacao") or "").strip()[:120]
    if campos.get("origem"):
        item["origem"] = campos["origem"]

    armazem.insere_aportes([item])
    return item


def importa(itens):
    """Grava vários lançamentos de uma vez, pulando os já importados.

    A comparação é pela chave `origem`, montada pelo importador a partir
    do próprio lançamento. Reimportar o mesmo extrato - ou um mais novo,
    com período sobreposto - acrescenta só o que falta.
    """
    ja_tem = {a.get("origem") for a in _carrega_bruto() if a.get("origem")}

    novos, repetidos, falhas = [], 0, []
    for item in itens:
        if item.get("origem") and item["origem"] in ja_tem:
            repetidos += 1
            continue
        try:
            registro = {
                "id": armazem.novo_id(),
                "tipo": item["tipo"],
                "data": item.get("data") or date.today().isoformat(),
                "criado_em": date.today().isoformat(),
                "observacao": (item.get("observacao") or "")[:120],
                "origem": item.get("origem"),
            }
            if item["tipo"] == "provento":
                # Dinheiro que a carteira pagou a você. Não é aporte: não
                # aumenta posição nem custo. Fica registrado para você ver
                # quanto a carteira já rendeu de fato.
                registro.update(ticker=item.get("ticker", ""),
                                valor=float(item["valor"]))
            elif item["tipo"] == "ativo":
                registro.update(ticker=item["ticker"].upper(),
                                quantidade=float(item["quantidade"]),
                                preco=float(item["preco"]),
                                valor=float(item["quantidade"]) * float(item["preco"]))
                if item.get("venda"):
                    # venda reduz a posição: entra como quantidade negativa
                    registro["quantidade"] = -registro["quantidade"]
                    registro["valor"] = -registro["valor"]
                    registro["venda"] = True
            else:
                registro.update(titulo=item["titulo"], valor=float(item["valor"]),
                                # Extrato de renda fixa descreve COMO o saldo
                                # atual foi formado - ele já está lá dentro,
                                # com rendimento e tudo. Somar de novo seria
                                # contar o mesmo dinheiro duas vezes; então
                                # esses lançamentos alimentam só a curva de
                                # evolução, não o saldo.
                                historico=True)
        except (KeyError, TypeError, ValueError) as e:
            falhas.append("%s: %s" % (item.get("data", "?"), e))
            continue

        ja_tem.add(registro.get("origem"))
        novos.append(registro)

    armazem.insere_aportes(novos)
    return {"novos": len(novos), "repetidos": repetidos, "falhas": falhas}


def excluir(id_aporte):
    return armazem.exclui_aporte(id_aporte)


def proventos():
    """Proventos recebidos, do mais recente para o mais antigo."""
    return sorted((a for a in _carrega_bruto() if a.get("tipo") == "provento"),
                  key=lambda a: a.get("data", ""), reverse=True)


def consolidado_por_ticker():
    """{ticker: {quantidade, custo, n}} somando os aportes de ativos."""
    fora = {}
    for a in _carrega_bruto():
        if a.get("tipo") != "ativo":
            continue
        t = a["ticker"]
        d = fora.setdefault(t, {"quantidade": 0.0, "custo": 0.0, "n": 0})
        d["quantidade"] += a["quantidade"]
        d["custo"] += a["quantidade"] * a["preco"]
        d["n"] += 1
    return fora


def consolidado_por_titulo():
    """{nome_do_titulo: valor} dos aportes em caixa que somam ao saldo.

    Os importados de extrato ficam de fora: o saldo declarado em
    carteira.yaml já os contém.
    """
    fora = {}
    for a in _carrega_bruto():
        # ter `origem` significa que veio de extrato
        importado = a.get("historico") or a.get("origem")
        if a.get("tipo") == "caixa" and not importado:
            fora[a["titulo"]] = fora.get(a["titulo"], 0.0) + a["valor"]
    return fora


def tickers_importados():
    """Ativos cujo histórico veio de extrato.

    Para esses, a quantidade registrada é a posição completa - a linha
    correspondente do carteira.yaml descreveria a mesma coisa e seria
    somada em cima, dobrando a posição.
    """
    return {a["ticker"] for a in _carrega_bruto()
            if a.get("tipo") == "ativo" and a.get("origem")}
