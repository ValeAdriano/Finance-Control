#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Monta uma cópia do projeto sem nenhum dado seu, pronta para enviar.

    python compartilhar.py                    # cria ../investimentos-compartilhar
    python compartilhar.py ~/Desktop/para-o-joao

O QUE FICA DE FORA, e por quê:

  .env                   as chaves do seu projeto Supabase — quem recebe
                         cria o próprio projeto
  config/carteira.yaml   suas posições, taxas de CDB e saldos
  dados/aportes.json     cada compra sua, com data e preço
  dados/aportes.bak*     as cópias de segurança do mesmo arquivo
  dados/premissas.json   as premissas que você salvou pela tela
  dados/cache/           dados de mercado — nada de pessoal DENTRO deles,
                         mas os NOMES dos arquivos entregam quais tickers
                         você acompanha, e é isso que faz o cache sair

No lugar do `carteira.yaml` vai o `carteira.exemplo.yaml`, com uma
carteira fictícia, para a ferramenta abrir funcionando no outro
computador.

Ao final o script VARRE a cópia atrás do que possa ter escapado e
reporta o que achou. Ele não promete que a varredura é completa — ela
é uma segunda checagem, não uma garantia.
"""
import re
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent

# ------------------------------------------------------------------
#  O que copiar. Lista explícita, não "tudo menos X": arquivo novo com
#  dado pessoal que apareça aqui um dia fica de fora por omissão, que
#  é o lado seguro do erro.
# ------------------------------------------------------------------
COPIAR_DIRETORIOS = ["src", "templates", ".claude", "scripts", "supabase"]
COPIAR_ARQUIVOS = [
    "app.py",
    "README.md",
    "compartilhar.py",
    "requirements.txt",
    ".env.example",
    "config/regras.yaml",
    "config/projecao.yaml",
    "config/renda.yaml",
    "config/carteira.exemplo.yaml",
]

# ------------------------------------------------------------------
#  Trechos do README que citam números da carteira de quem escreveu.
#  São exemplos didáticos, mas são valores reais — viram genéricos.
# ------------------------------------------------------------------
SUBSTITUICOES_README = [
    ("e o seu caixa\n(com o PicPay a 121% do CDI) rende 10,83% real ao ano",
     "e um caixa\nrendendo 120% do CDI daria mais de 10% real ao ano"),
    ("R$ 14 mil virarem R$ 349 mil não é multiplicar por 24: R$ 120 mil desses são",
     "R$ 50 mil virarem R$ 900 mil não é multiplicar por 18: boa parte disso é"),
]

# ------------------------------------------------------------------
#  A varredura final. Cada padrão é algo que NÃO deveria existir numa
#  cópia limpa.
# ------------------------------------------------------------------
SUSPEITOS = [
    (r"\b\d{1,3}\.\d{3},\d{2}\b", "valor em reais com centavos"),
    (r"\b(122816|\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})\b", "senha ou documento"),
    (r"lorenzo", "nome do autor"),
    (r"valor_aplicado:\s*(?!1000\b|500\b)\d", "saldo de renda fixa fora do exemplo"),
]
# O README usa exemplos numéricos didáticos; este próprio script guarda os
# padrões acima como literais e se acusaria sozinho.
IGNORAR_NA_VARREDURA = {"README.md", "compartilhar.py"}

# Valores que são placeholder consagrado de formato, não dinheiro de ninguém.
PLACEHOLDERS = {"1.234,56", "1.000,00"}


def copia(destino: Path):
    if destino.exists():
        if any(destino.iterdir()):
            sys.exit("ERRO: %s já existe e não está vazio. Escolha outro "
                     "destino ou apague-o antes." % destino)
    destino.mkdir(parents=True, exist_ok=True)

    levados = []
    for d in COPIAR_DIRETORIOS:
        origem = RAIZ / d
        if not origem.is_dir():
            continue
        shutil.copytree(origem, destino / d,
                        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        levados.append(d + "/")

    for f in COPIAR_ARQUIVOS:
        origem = RAIZ / f
        if not origem.is_file():
            print("  aviso: %s não existe, pulando" % f)
            continue
        alvo = destino / f
        alvo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origem, alvo)
        levados.append(f)

    # a pasta de dados vai vazia: a ferramenta precisa que ela exista
    (destino / "dados" / "cache").mkdir(parents=True, exist_ok=True)
    (destino / "dados" / ".gitkeep").write_text("", encoding="utf-8")

    return levados


def limpa_readme(destino: Path):
    caminho = destino / "README.md"
    if not caminho.is_file():
        return []
    texto = caminho.read_text(encoding="utf-8")
    feitas = []
    for velho, novo in SUBSTITUICOES_README:
        if velho in texto:
            texto = texto.replace(velho, novo)
            feitas.append(velho.split("\n")[0][:58] + "…")
    caminho.write_text(texto, encoding="utf-8")
    return feitas


def escreve_primeiros_passos(destino: Path):
    shutil.copy2(RAIZ / "COMECE-AQUI.md", destino / "COMECE-AQUI.md")


def escreve_gitignore(destino: Path):
    shutil.copy2(RAIZ / ".gitignore", destino / ".gitignore")


def varre(destino: Path):
    achados = []
    for caminho in sorted(destino.rglob("*")):
        if not caminho.is_file():
            continue
        if caminho.name in IGNORAR_NA_VARREDURA:
            continue
        try:
            texto = caminho.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for padrao, oquee in SUSPEITOS:
            for m in re.finditer(padrao, texto, re.I):
                if m.group(0) in PLACEHOLDERS:
                    continue
                linha = texto[:m.start()].count("\n") + 1
                achados.append((caminho.relative_to(destino), linha,
                                oquee, m.group(0)[:40]))
    return achados


def main():
    destino = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 \
        else RAIZ.parent / "investimentos-compartilhar"

    print("montando cópia limpa em:\n  %s\n" % destino)
    levados = copia(destino)
    print("copiados: %s" % ", ".join(levados))

    feitas = limpa_readme(destino)
    if feitas:
        print("\nREADME — trechos com números da sua carteira, generalizados:")
        for f in feitas:
            print("  · %s" % f)

    escreve_primeiros_passos(destino)
    escreve_gitignore(destino)
    print("\nescritos: COMECE-AQUI.md, .gitignore, dados/cache/ (vazia)")

    print("\nFICOU DE FORA: .env, config/carteira.yaml, dados/aportes.json,")
    print("               dados/aportes.bak*, dados/premissas.json, dados/cache/*")

    achados = varre(destino)
    print("\n" + "-" * 58)
    if achados:
        print("VARREDURA: %d trecho(s) para você olhar antes de enviar\n" % len(achados))
        for arq, linha, oquee, trecho in achados:
            print("  %s:%d  %s -> %s" % (arq, linha, oquee, trecho))
        print("\nNem todo achado é problema — a varredura é grosseira de")
        print("propósito. Confira e siga.")
    else:
        print("VARREDURA: nada suspeito encontrado.")
        print("Isso não é garantia: a varredura procura padrões conhecidos,")
        print("não tudo que poderia ser pessoal. Dê uma olhada no destino.")


if __name__ == "__main__":
    main()
