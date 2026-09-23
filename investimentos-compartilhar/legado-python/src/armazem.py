"""Onde ficam os dados de quem usa: Supabase ou arquivos locais.

Três coisas são pessoais e mudam com o uso — a carteira (ativos,
watchlist, renda fixa e alocação-alvo), os aportes e as premissas
salvas pela tela. Com SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente
(ou no .env) elas vivem no Supabase; sem isso, a ferramenta continua
lendo e gravando os arquivos de sempre:

    config/carteira.yaml   dados/aportes.json   dados/premissas.json

As regras de avaliação, o universo da aba Renda e as premissas-base da
projeção continuam nos YAML de config/: são a documentação do modelo,
com os comentários que explicam cada número, e não dado de ninguém.

O acesso ao Supabase é pela API REST (PostgREST) com a chave secreta,
e só do servidor. As tabelas têm RLS ligada e nenhuma política: a
chave pública não lê nada, só a secreta.
"""
import json
import os
import secrets
import shutil
import time
from pathlib import Path

import requests
import yaml

RAIZ = Path(__file__).resolve().parents[1]

try:
    from dotenv import load_dotenv
    load_dotenv(RAIZ / ".env")
except ImportError:          # sem python-dotenv, vale só o ambiente
    pass

URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
# SUPABASE_SERVICE_ROLE_KEY é o nome antigo da mesma chave
CHAVE = (os.environ.get("SUPABASE_SECRET_KEY")
         or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "")

CARTEIRA_YAML = RAIZ / "config" / "carteira.yaml"
APORTES_JSON = RAIZ / "dados" / "aportes.json"
PREMISSAS_JSON = RAIZ / "dados" / "premissas.json"

T_ATIVOS = "painel_ativos"
T_RENDA_FIXA = "painel_renda_fixa"
T_ALOCACAO = "painel_alocacao_alvo"
T_APORTES = "painel_aportes"
T_PREMISSAS = "painel_premissas"

# campos que existem em cada tabela; o resto de um dicionário é ignorado
# ao gravar, para um campo a mais não virar erro 400 do PostgREST
CAMPOS_APORTE = ("id", "tipo", "data", "criado_em", "ticker", "quantidade",
                 "preco", "valor", "titulo", "observacao", "origem",
                 "historico", "venda")
CAMPOS_ATIVO = ("ticker", "classe", "pilar", "lista", "quantidade",
                "preco_medio", "ordem")
CAMPOS_RENDA_FIXA = ("nome", "tipo", "taxa", "vencimento", "valor_aplicado",
                     "pilar", "ordem")

# Incrementa a cada gravação feita por este processo: é o que derruba o
# cache do painel na hora, sem esperar ele expirar.
_VERSAO = [0]
# Os aportes são lidos várias vezes por recálculo (posição, caixa,
# proventos, curva). Guardar a leitura por alguns segundos evita cinco
# idas ao Supabase para montar a mesma tela.
_MEMO_APORTES = {"versao": -1, "quando": 0.0, "lista": None}
MEMO_SEGUNDOS = 30


class ErroSupabase(RuntimeError):
    pass


def usa_supabase():
    return bool(URL and CHAVE)


def descricao():
    """Texto curto para a tela dizer de onde vêm os dados."""
    return "Supabase" if usa_supabase() else "arquivos locais"


def onde_carteira():
    return ("a tabela <code>%s</code> no Supabase" % T_ATIVOS
            if usa_supabase() else "<code>config/carteira.yaml</code>")


def versao():
    return _VERSAO[0]


def _mudou():
    _VERSAO[0] += 1
    _MEMO_APORTES["lista"] = None


def esquece_leituras():
    """Descarta o que foi lido do Supabase e ainda estava guardado."""
    _MEMO_APORTES["lista"] = None


def assinatura():
    """Marca das entradas editáveis; se mudar, o painel recalcula."""
    marcas = [versao()]
    arquivos = [RAIZ / "config" / "regras.yaml"]
    if not usa_supabase():
        arquivos += [CARTEIRA_YAML, APORTES_JSON]
    for caminho in arquivos:
        try:
            marcas.append(caminho.stat().st_mtime_ns)
        except OSError:
            marcas.append(0)
    return tuple(marcas)


# ================================================================ Supabase
def _cabecalhos(extra=None):
    h = {"apikey": CHAVE, "Content-Type": "application/json"}
    # A chave legada (service_role) é um JWT e vai também no Authorization.
    # A chave nova (sb_secret_...) não é JWT: vai só no apikey e o gateway
    # do Supabase resolve o resto.
    if CHAVE.startswith("eyJ"):
        h["Authorization"] = "Bearer " + CHAVE
    h.update(extra or {})
    return h


def _req(metodo, tabela, params=None, corpo=None, extra=None):
    try:
        r = requests.request(metodo, "%s/rest/v1/%s" % (URL, tabela),
                             params=params, headers=_cabecalhos(extra),
                             data=None if corpo is None else json.dumps(corpo),
                             timeout=20)
    except requests.RequestException as e:
        raise ErroSupabase("sem conexão com o Supabase (%s)" % e) from e
    if r.status_code >= 400:
        try:
            msg = r.json().get("message") or r.text
        except ValueError:
            msg = r.text
        if r.status_code == 404 or "does not exist" in msg \
                or "schema cache" in msg:
            msg += (" — as tabelas ainda não existem? Rode o "
                    "supabase/schema.sql no SQL Editor do projeto.")
        elif r.status_code in (401, 403):
            msg += " — confira a SUPABASE_SECRET_KEY no .env."
        raise ErroSupabase("Supabase respondeu %d em %s: %s"
                           % (r.status_code, tabela, msg))
    return r


def _seleciona(tabela, ordem=None, filtros=None):
    """Lê a tabela inteira, em páginas.

    O PostgREST devolve no máximo 1000 linhas por pedido; um extrato de
    alguns anos passa disso fácil, e cortar em silêncio sumiria com
    aportes antigos.
    """
    params = {"select": "*"}
    if ordem:
        params["order"] = ordem
    params.update(filtros or {})
    linhas, passo, inicio = [], 1000, 0
    while True:
        r = _req("GET", tabela, params=params,
                 extra={"Range-Unit": "items",
                        "Range": "%d-%d" % (inicio, inicio + passo - 1)})
        pagina = r.json()
        linhas.extend(pagina)
        if len(pagina) < passo:
            return linhas
        inicio += passo


def _insere(tabela, linhas, conflito=None, ignora_repetidos=False):
    if not linhas:
        return
    prefer = ["return=minimal"]
    params = None
    if conflito:
        params = {"on_conflict": conflito}
        prefer.append("resolution=%s" % ("ignore-duplicates" if ignora_repetidos
                                         else "merge-duplicates"))
    for i in range(0, len(linhas), 500):
        _req("POST", tabela, params=params, corpo=linhas[i:i + 500],
             extra={"Prefer": ",".join(prefer)})


def _apaga_tudo(tabela, coluna):
    # o PostgREST recusa DELETE sem filtro; este pega todas as linhas
    _req("DELETE", tabela, params={coluna: "not.is.null"})


def _sem_nulos(d, fora=()):
    return {k: v for k, v in d.items() if v is not None and k not in fora}


def _so(campos, d):
    return {k: d.get(k) for k in campos if k in d}


# =============================================================== carteira
def carteira():
    """Mesmo formato do carteira.yaml, venha de onde vier."""
    if not usa_supabase():
        with open(CARTEIRA_YAML, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    ativos = _seleciona(T_ATIVOS, ordem="ordem.asc,ticker.asc")
    fixa = _seleciona(T_RENDA_FIXA, ordem="ordem.asc,id.asc")
    alvos = _seleciona(T_ALOCACAO)
    meta = ("lista", "ordem", "criado_em", "atualizado_em")
    return {
        "alocacao_alvo": {a["pilar"]: float(a["pct"]) for a in alvos},
        "carteira": [_sem_nulos(a, meta) for a in ativos
                     if a.get("lista") == "carteira"],
        "watchlist": [_sem_nulos(a, meta + ("quantidade", "preco_medio"))
                      for a in ativos if a.get("lista") == "watchlist"],
        # taxa e vencimento nulos são informação ("não informada"),
        # então ficam no dicionário
        "renda_fixa": [{k: v for k, v in r.items()
                        if k not in meta + ("id",)} for r in fixa],
    }


def grava_carteira(cfg):
    """Substitui a carteira inteira no Supabase pelo conteúdo de `cfg`."""
    ativos = []
    for lista in ("carteira", "watchlist"):
        for i, a in enumerate(cfg.get(lista) or []):
            linha = _so(CAMPOS_ATIVO, a)
            linha.update(ticker=str(a["ticker"]).upper(), lista=lista, ordem=i,
                         quantidade=float(a.get("quantidade") or 0))
            ativos.append(linha)
    fixa = []
    for i, r in enumerate(cfg.get("renda_fixa") or []):
        linha = _so(CAMPOS_RENDA_FIXA, r)
        linha.update(ordem=i, pilar=r.get("pilar") or "caixa",
                     valor_aplicado=float(r.get("valor_aplicado") or 0))
        if linha.get("vencimento") is not None:
            linha["vencimento"] = str(linha["vencimento"])
        fixa.append(linha)
    alvos = [{"pilar": k, "pct": float(v)}
             for k, v in (cfg.get("alocacao_alvo") or {}).items()]

    _apaga_tudo(T_ATIVOS, "ticker")
    _apaga_tudo(T_RENDA_FIXA, "id")
    _apaga_tudo(T_ALOCACAO, "pilar")
    # uma linha por vez muda o conjunto de colunas; o PostgREST exige
    # o mesmo conjunto em todas as linhas de um insert em lote
    for linha in ativos:
        linha.setdefault("preco_medio", None)
    for linha in fixa:
        for campo in ("taxa", "vencimento"):
            linha.setdefault(campo, None)
    _insere(T_ATIVOS, ativos)
    _insere(T_RENDA_FIXA, fixa)
    _insere(T_ALOCACAO, alvos)
    _mudou()


# ================================================================ aportes
def aportes():
    """Todos os aportes, na ordem em que foram gravados."""
    if not usa_supabase():
        return _aportes_do_arquivo()

    m = _MEMO_APORTES
    if m["lista"] is not None and m["versao"] == versao() \
            and time.time() - m["quando"] < MEMO_SEGUNDOS:
        return [dict(a) for a in m["lista"]]
    linhas = [_sem_nulos(a, ("seq",))
              for a in _seleciona(T_APORTES, ordem="seq.asc")]
    m.update(versao=versao(), quando=time.time(), lista=linhas)
    return [dict(a) for a in linhas]


def insere_aportes(novos):
    if not novos:
        return
    if not usa_supabase():
        _grava_arquivo(_aportes_do_arquivo() + list(novos))
        return
    # mesmo conjunto de colunas em todas as linhas (exigência do lote)
    linhas = [{k: a.get(k) for k in CAMPOS_APORTE} for a in novos]
    for l in linhas:
        l["historico"] = bool(l["historico"])
        l["venda"] = bool(l["venda"])
        l["observacao"] = l["observacao"] or ""
    # `origem` é única: um extrato reimportado por duas abas ao mesmo
    # tempo não duplica nada
    _insere(T_APORTES, linhas, conflito="origem", ignora_repetidos=True)
    _mudou()


def exclui_aporte(id_aporte):
    if not usa_supabase():
        lista = _aportes_do_arquivo()
        restante = [a for a in lista if a.get("id") != id_aporte]
        if len(restante) == len(lista):
            return False
        _grava_arquivo(restante)
        return True
    r = _req("DELETE", T_APORTES, params={"id": "eq.%s" % id_aporte},
             extra={"Prefer": "return=representation"})
    _mudou()
    return bool(r.json())


def novo_id():
    return secrets.token_hex(4)


def _aportes_do_arquivo():
    if not APORTES_JSON.exists():
        return []
    try:
        with open(APORTES_JSON, encoding="utf-8") as f:
            dados = json.load(f)
        return dados if isinstance(dados, list) else []
    except (json.JSONDecodeError, OSError):
        # arquivo corrompido não pode derrubar o painel inteiro
        return []


BACKUPS = 5


def _guarda_copia():
    """Gira cópias do arquivo antes de sobrescrevê-lo.

    Este histórico é o único registro do que foi comprado - se ele se
    perder, não há de onde reconstruir. As cópias custam alguns KB.
    """
    if not APORTES_JSON.exists():
        return
    for i in range(BACKUPS - 1, 0, -1):
        anterior = APORTES_JSON.with_suffix(".bak%d" % i)
        if anterior.exists():
            anterior.replace(APORTES_JSON.with_suffix(".bak%d" % (i + 1)))
    try:
        shutil.copy2(APORTES_JSON, APORTES_JSON.with_suffix(".bak1"))
    except OSError:
        pass          # backup é rede de segurança, não pode impedir a gravação


def _grava_arquivo(lista):
    APORTES_JSON.parent.mkdir(parents=True, exist_ok=True)
    _guarda_copia()
    tmp = APORTES_JSON.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
    tmp.replace(APORTES_JSON)          # troca atômica: nunca deixa meio escrito
    _mudou()


# ============================================================== premissas
def premissas_salvas():
    """O que foi salvo pela tela de Projeções, ou None."""
    if not usa_supabase():
        if not PREMISSAS_JSON.exists():
            return None
        with open(PREMISSAS_JSON, encoding="utf-8") as f:
            return json.load(f)
    linhas = _seleciona(T_PREMISSAS, filtros={"id": "eq.1"})
    return linhas[0]["dados"] if linhas else None


def salva_premissas(mudancas):
    if not usa_supabase():
        PREMISSAS_JSON.parent.mkdir(parents=True, exist_ok=True)
        tmp = PREMISSAS_JSON.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(mudancas, f, ensure_ascii=False, indent=2)
        tmp.replace(PREMISSAS_JSON)
    else:
        _insere(T_PREMISSAS, [{"id": 1, "dados": mudancas}], conflito="id")
    _mudou()


def limpa_premissas():
    if not usa_supabase():
        if PREMISSAS_JSON.exists():
            PREMISSAS_JSON.unlink()
    else:
        _req("DELETE", T_PREMISSAS, params={"id": "eq.1"})
    _mudou()


def tem_premissas_salvas():
    try:
        return premissas_salvas() is not None
    except Exception:
        return False
