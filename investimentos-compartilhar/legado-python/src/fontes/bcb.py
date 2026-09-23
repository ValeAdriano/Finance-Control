"""Banco Central (API SGS) — as âncoras macro.

Servem para responder "esse DY compensa frente à renda fixa?".

Cada série vem com a data de apuração, e ela é guardada junto com o
valor. Um indicador macro sem data engana: a Selic é decidida a cada 45
dias e o IPCA sai uma vez por mês — o número que a tela mostra pode ser
de semanas atrás, e quem lê precisa poder saber disso.
"""
from .comum import http_json

# nome interno -> (código da série no SGS, rótulo, o que a série mede)
SERIES = {
    "selic_meta": (432, "Selic meta",
                   "meta definida pelo Copom, % ao ano"),
    "cdi": (4389, "CDI",
            "taxa DI anualizada, base 252 dias úteis"),
    "ipca_12m": (13522, "IPCA 12 meses",
                 "inflação acumulada nos últimos 12 meses"),
}

URL = ("https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados/ultimos/1"
       "?formato=json")


def macro(ttl_horas=12):
    """Valores macro + a procedência de cada um.

    Devolve as chaves diretas ('selic_meta', 'cdi', ...) e um 'fontes'
    com {data, série, rótulo, descrição} de cada indicador.
    """
    out = {"fontes": {}}
    for nome, (codigo, rotulo, descricao) in SERIES.items():
        try:
            dados = http_json(URL.format(codigo), ttl_horas)
            out[nome] = float(dados[-1]["valor"].replace(",", "."))
            out["fontes"][nome] = {
                "rotulo": rotulo,
                "descricao": descricao,
                "origem": "Banco Central · série SGS %d" % codigo,
                "data": dados[-1].get("data"),      # dd/mm/aaaa
                "calculado": False,
            }
        except Exception as e:                      # rede fora, série atrasada
            out[nome] = None
            out["fontes"][nome] = {
                "rotulo": rotulo, "descricao": descricao,
                "origem": "Banco Central · série SGS %d" % codigo,
                "data": None, "calculado": False, "erro": str(e)[:120],
            }

    cdi, ipca = out.get("cdi"), out.get("ipca_12m")
    # juro real ex-post pela fórmula de Fisher
    out["juro_real"] = round(((1 + cdi / 100) / (1 + ipca / 100) - 1) * 100, 2) \
        if cdi and ipca else None

    # O juro real não é uma série do BCB: é conta feita aqui. Dizer isso
    # importa - quem for conferir no site do Banco Central não vai achar
    # esse número em lugar nenhum.
    datas = [out["fontes"][k].get("data") for k in ("cdi", "ipca_12m")
             if out["fontes"].get(k, {}).get("data")]
    out["fontes"]["juro_real"] = {
        "rotulo": "Juro real",
        "descricao": "quanto o CDI rende acima da inflação",
        "origem": "calculado aqui, pela fórmula de Fisher: "
                  "(1 + CDI) ÷ (1 + IPCA) − 1",
        "data": max(datas) if datas else None,
        "calculado": True,
    }
    return out
