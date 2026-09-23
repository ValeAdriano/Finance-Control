"""Utilidades compartilhadas pelas fontes de dados."""
import json
import os
import re
import time
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parents[2]
# Só dados de mercado, nada pessoal. CACHE_DIR permite apontar para um
# disco gravável quando o projeto roda num servidor (ex.: /tmp).
CACHE = Path(os.environ.get("CACHE_DIR") or RAIZ / "dados" / "cache")
CACHE.mkdir(parents=True, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")


def http(url, ttl_horas=6, binario=False, **kw):
    """GET com cache em disco. ttl_horas=0 forca ida a rede."""
    chave = re.sub(r"[^A-Za-z0-9]+", "_", url)[:120]
    arq = CACHE / (chave + (".bin" if binario else ".txt"))
    if ttl_horas and arq.exists():
        idade = (time.time() - arq.stat().st_mtime) / 3600
        if idade < ttl_horas:
            return arq.read_bytes() if binario else arq.read_text(encoding="utf-8")

    enc = kw.pop("encoding", None)
    r = requests.get(url, headers={"User-Agent": UA, "Accept": "*/*"},
                     timeout=40, **kw)
    r.raise_for_status()
    if binario:
        arq.write_bytes(r.content)
        return r.content
    texto = r.content.decode(enc or r.apparent_encoding or "utf-8", errors="replace")
    arq.write_text(texto, encoding="utf-8")
    return texto


def http_json(url, ttl_horas=6):
    return json.loads(http(url, ttl_horas))


def num_br(txt):
    """Converte numero em formato brasileiro para float.

    '1.234,56' -> 1234.56 ; '11,54%' -> 11.54 ; '-' -> None
    """
    if txt is None:
        return None
    s = str(txt).strip().replace("%", "").replace("R$", "").strip()
    if s in ("", "-", "N/A", "nan"):
        return None
    s = s.replace(".", "").replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    return v


def limpa_html(fragmento):
    return re.sub(r"<[^>]*>", "", fragmento).replace("&nbsp;", " ").strip()
