"""Manutenção dos dados no Supabase.

    python scripts/banco.py verificar
        confere as chaves e se as tabelas existem

    python scripts/banco.py importar [--exemplo] [--substituir]
        leva para o Supabase o que está nos arquivos locais:
        config/carteira.yaml, dados/aportes.json e dados/premissas.json.
        Com --exemplo, usa config/carteira.exemplo.yaml como carteira
        (é o que se quer no primeiro uso, sem carteira nenhuma ainda).

    python scripts/banco.py exportar [pasta]
        grava uma cópia de tudo em arquivos (padrão: dados/backup-AAAA-MM-DD),
        no mesmo formato que a ferramenta lê sem Supabase

A importação recusa sobrescrever uma carteira que já esteja no Supabase,
a não ser com --substituir. Aportes nunca são apagados: os que já
existem (mesmo id ou mesma origem de extrato) são pulados.
"""
import json
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

import yaml  # noqa: E402

from src import armazem  # noqa: E402


def _exige_supabase():
    if not armazem.usa_supabase():
        sys.exit("SUPABASE_URL e SUPABASE_SECRET_KEY não estão configuradas.\n"
                 "Copie .env.example para .env e preencha as duas.")


def verificar():
    _exige_supabase()
    print("projeto: %s" % armazem.URL)
    problemas = 0
    for tabela in (armazem.T_ATIVOS, armazem.T_RENDA_FIXA, armazem.T_ALOCACAO,
                   armazem.T_APORTES, armazem.T_PREMISSAS):
        try:
            n = len(armazem._seleciona(tabela))
            print("  ok  %-22s %d linha(s)" % (tabela, n))
        except armazem.ErroSupabase as e:
            problemas += 1
            print("  ERRO %-21s %s" % (tabela, e))
    if problemas:
        sys.exit("\n%d tabela(s) com problema." % problemas)
    print("\ntudo certo.")


def importar(exemplo=False, substituir=False):
    _exige_supabase()

    origem = armazem.RAIZ / "config" / (
        "carteira.exemplo.yaml" if exemplo else "carteira.yaml")
    if not origem.exists():
        sys.exit("%s não existe. Use --exemplo para começar pela carteira "
                 "de exemplo." % origem.relative_to(armazem.RAIZ))

    ja_tem = armazem.carteira()
    tem_algo = ja_tem.get("carteira") or ja_tem.get("watchlist") \
        or ja_tem.get("renda_fixa")
    if tem_algo and not substituir:
        print("O Supabase já tem uma carteira; ela foi mantida. "
              "Use --substituir para trocá-la por %s." % origem.name)
    else:
        with open(origem, encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        armazem.grava_carteira(cfg)
        print("carteira: %d ativo(s), %d na watchlist, %d título(s) de renda fixa"
              % (len(cfg.get("carteira") or []), len(cfg.get("watchlist") or []),
                 len(cfg.get("renda_fixa") or [])))

    locais = armazem._aportes_do_arquivo()
    if locais:
        existentes = armazem.aportes()
        ids = {a["id"] for a in existentes}
        origens = {a.get("origem") for a in existentes if a.get("origem")}
        novos = [a for a in locais if a.get("id") not in ids
                 and not (a.get("origem") and a["origem"] in origens)]
        armazem.insere_aportes(novos)
        print("aportes: %d importado(s), %d já estavam lá"
              % (len(novos), len(locais) - len(novos)))
    else:
        print("aportes: nenhum em dados/aportes.json")

    if armazem.PREMISSAS_JSON.exists():
        with open(armazem.PREMISSAS_JSON, encoding="utf-8") as f:
            premissas = json.load(f)
        if armazem.premissas_salvas() is None or substituir:
            armazem.salva_premissas(premissas)
            print("premissas: importadas")
        else:
            print("premissas: o Supabase já tinha; mantidas")


def exportar(pasta=None):
    _exige_supabase()
    destino = Path(pasta) if pasta else \
        armazem.RAIZ / "dados" / ("backup-%s" % date.today().isoformat())
    destino.mkdir(parents=True, exist_ok=True)

    with open(destino / "carteira.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(armazem.carteira(), f, allow_unicode=True,
                       sort_keys=False)
    with open(destino / "aportes.json", "w", encoding="utf-8") as f:
        json.dump(armazem.aportes(), f, ensure_ascii=False, indent=2)
    premissas = armazem.premissas_salvas()
    if premissas is not None:
        with open(destino / "premissas.json", "w", encoding="utf-8") as f:
            json.dump(premissas, f, ensure_ascii=False, indent=2)
    print("exportado para %s" % destino)


def main(args):
    if not args or args[0] in ("-h", "--help", "ajuda"):
        print(__doc__)
        return
    cmd, resto = args[0], args[1:]
    try:
        if cmd == "verificar":
            verificar()
        elif cmd == "importar":
            importar(exemplo="--exemplo" in resto,
                     substituir="--substituir" in resto)
        elif cmd == "exportar":
            exportar(next((a for a in resto if not a.startswith("-")), None))
        else:
            sys.exit("comando desconhecido: %s\n%s" % (cmd, __doc__))
    except armazem.ErroSupabase as e:
        sys.exit("ERRO: %s" % e)


if __name__ == "__main__":
    main(sys.argv[1:])
