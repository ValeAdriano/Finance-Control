"""As quatro lentes. Cada uma devolve uma nota de 0 a 100 e uma frase
explicando de onde a nota veio.

Nenhuma lente sozinha decide nada. Elas discordam de propósito: um FII
pode estar barato contra a própria história (lente histórica alta) e
ainda assim caro contra os concorrentes (lente pares baixa). Ver as
quatro lado a lado é o ponto da ferramenta.
"""
from dataclasses import dataclass, field

TITULOS = {
    "regra": "Seu alvo",
    "historica": "Histórico",
    "pares": "Pares",
    "macro": "Renda fixa",
}


@dataclass
class Nota:
    lente: str
    nota: float | None            # 0-100, ou None se a lente não se aplica
    texto: str = ""
    referencia: float | None = None   # o "alvo" que essa lente enxerga
    detalhes: dict = field(default_factory=dict)

    @property
    def titulo(self):
        return TITULOS.get(self.lente, self.lente)

    @property
    def cor(self):
        if self.nota is None:
            return "cinza"
        return "verde" if self.nota >= 70 else "amarelo" if self.nota >= 45 else "vermelho"


def _interpola(v, otimo, aceitavel, ruim, menor_melhor):
    """Curva 100 / 60 / 0 nos três pontos de ancoragem."""
    if menor_melhor:
        if v <= otimo:
            return 100.0
        if v <= aceitavel:
            return 100 - 40 * (v - otimo) / max(aceitavel - otimo, 1e-9)
        if v <= ruim:
            return 60 - 60 * (v - aceitavel) / max(ruim - aceitavel, 1e-9)
        return 0.0
    if v >= otimo:
        return 100.0
    if v >= aceitavel:
        return 100 - 40 * (otimo - v) / max(otimo - aceitavel, 1e-9)
    if v >= ruim:
        return 60 - 60 * (aceitavel - v) / max(aceitavel - ruim, 1e-9)
    return 0.0


def _fmt(v, unidade=""):
    """Número no padrão brasileiro: vírgula decimal, ponto de milhar."""
    if v is None:
        return "—"
    if unidade == "R$":
        if abs(v) >= 1e6:
            return ("R$ %.1f mi" % (v / 1e6)).replace(".", ",")
        return "R$ " + format(v, ",.0f").replace(",", ".")
    if abs(v) >= 1000:
        return format(v, ",.0f").replace(",", ".")
    return ("%.2f" % v).replace(".", ",") + unidade


# ------------------------------------------------------------------ lente 1
def lente_regra(valor, cfg):
    """Compara com as faixas que você escreveu em regras.yaml."""
    if valor is None or cfg.get("otimo") is None:
        return Nota("regra", None, "sem faixa configurada")
    menor = cfg["direcao"] == "menor_melhor"
    nota = _interpola(valor, cfg["otimo"], cfg["aceitavel"], cfg["ruim"], menor)
    u = cfg.get("unidade", "")
    alvo = "até" if menor else "a partir de"
    return Nota("regra", nota,
                "seu ótimo é %s %s; limite aceitável %s"
                % (alvo, _fmt(cfg["otimo"], u), _fmt(cfg["aceitavel"], u)),
                referencia=cfg["otimo"])


# ------------------------------------------------------------------ lente 2
def lente_historica(valor, serie, cfg, anos=3):
    """Onde o valor de hoje cai na própria história do ativo.

    Nota 100 = melhor momento da janela; 0 = pior momento.
    """
    valores = [v for _, v in serie if v is not None]
    if valor is None or len(valores) < 20:
        return Nota("historica", None, "histórico insuficiente")

    menor = cfg["direcao"] == "menor_melhor"
    melhores = sum(1 for v in valores if (v > valor if menor else v < valor))
    nota = 100 * melhores / len(valores)

    ordenados = sorted(valores)
    n = len(ordenados)
    mediana = ordenados[n // 2]
    # alvo: quartil favorável da própria história
    alvo = ordenados[n // 4] if menor else ordenados[3 * n // 4]

    u = cfg.get("unidade", "")
    pos = "abaixo" if valor < mediana else "acima"
    return Nota("historica", nota,
                "melhor que %.0f%% dos últimos %d anos; mediana do período "
                "%s (hoje %s)" % (nota, anos, _fmt(mediana, u), pos),
                referencia=alvo,
                detalhes={"mediana": mediana, "min": ordenados[0], "max": ordenados[-1]})


# ------------------------------------------------------------------ lente 3
MIN_PARES = 10   # abaixo disso o percentil é ruído, não informação


def lente_pares(valor, valores_pares, cfg, nome_grupo=""):
    """Percentil dentro do mesmo segmento / setor.

    Muitas métricas do Fundamentus vêm em branco (só 6 dos 49 fundos de
    papel publicam DY na tabela). Com amostra pequena o percentil oscila
    demais, então a lente se cala e as outras três dividem o peso.
    """
    pares = [v for v in valores_pares if v is not None]
    if valor is None or len(pares) < MIN_PARES:
        return Nota("pares", None,
                    "amostra insuficiente (%d pares com o dado)" % len(pares))

    menor = cfg["direcao"] == "menor_melhor"
    piores = sum(1 for v in pares if (v > valor if menor else v < valor))
    nota = 100 * piores / len(pares)

    ordenados = sorted(pares)
    mediana = ordenados[len(ordenados) // 2]
    u = cfg.get("unidade", "")
    return Nota("pares", nota,
                "melhor que %.0f%% dos %d ativos de %s; mediana do grupo %s"
                % (nota, len(pares), nome_grupo, _fmt(mediana, u)),
                referencia=mediana,
                detalhes={"mediana": mediana, "n": len(pares)})


# ------------------------------------------------------------------ lente 4
IR_LONGO_PRAZO = 0.15    # alíquota de IR para renda fixa acima de 720 dias


def lente_macro(valor, cfg, macro, isento_ir=False):
    """Compara o retorno do ativo com a renda fixa do dia.

    Para FII a comparação usa o CDI LÍQUIDO de imposto, porque o
    rendimento de FII é isento para pessoa física. Sem esse ajuste
    todo FII pareceria pior que o CDI num país de juro alto.
    """
    ancora = cfg.get("ancora_macro")
    if not ancora or valor is None or not macro.get(ancora):
        return Nota("macro", None, "sem âncora macro")

    bruto = macro[ancora]
    base = bruto * (1 - IR_LONGO_PRAZO) if isento_ir else bruto
    rotulo = "%s líquido de IR" % ancora.upper() if isento_ir else ancora.upper()

    spread = valor - base
    # +3 p.p. acima da renda fixa = 100 ; na paridade = 50 ; -3 p.p. = 0
    nota = max(0.0, min(100.0, 50 + (spread / 3.0) * 50))

    sinal = "acima" if spread >= 0 else "abaixo"
    return Nota("macro", nota,
                "%s contra %s do %s: %s p.p. %s"
                % (_fmt(valor, "%"), _fmt(base, "%"), rotulo,
                   _fmt(abs(spread)), sinal),
                referencia=base,
                detalhes={"spread": spread, "base": base, "bruto": bruto})
