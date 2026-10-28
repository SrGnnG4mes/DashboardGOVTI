"""Gera data/dados.json a partir da planilha do Google, rodando no GitHub Actions.

Como roda no servidor do GitHub (e não no navegador), não sofre bloqueio de CORS.
Ordem de tentativa:
  1) API do Apps Script (JSON)
  2) planilha publicada na Web (.xlsx)
Só grava o arquivo se o conteúdo mudou.
"""
import io
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

API_URL = os.environ.get("API_URL", "").strip()
PLANILHA_PUBLICADA_URL = os.environ.get("PLANILHA_PUBLICADA_URL", "").strip()
SAIDA = os.environ.get("SAIDA", "data/dados.json")


def baixar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "painel-governanca-ti/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:  # segue redirecionamentos
        return r.read()


def de_apps_script():
    if not API_URL:
        raise RuntimeError("API_URL vazia")
    dados = json.loads(baixar(API_URL).decode("utf-8"))
    return dados


def de_planilha_publicada():
    if not PLANILHA_PUBLICADA_URL:
        raise RuntimeError("PLANILHA_PUBLICADA_URL vazia")
    base = PLANILHA_PUBLICADA_URL.split("/pub")[0]
    conteudo = baixar(base + "/pub?output=xlsx")
    if conteudo[:2] != b"PK":
        raise RuntimeError("o Google não devolveu um .xlsx (a planilha está publicada na Web?)")
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(conteudo), data_only=True, read_only=True)
    abas = {}
    for ws in wb.worksheets:
        linhas = list(ws.iter_rows(values_only=True))
        if len(linhas) < 2:
            continue
        cab = [("" if h is None else str(h)).strip() for h in linhas[0]]
        itens = []
        for r in linhas[1:]:
            if all(v is None or str(v).strip() == "" for v in r):
                continue
            item = {}
            for h, v in zip(cab, r):
                if not h:
                    continue
                if isinstance(v, datetime):
                    v = v.isoformat()
                item[h] = "" if v is None else v
            itens.append(item)
        abas[ws.title] = itens
    return abas


def main():
    erros = []
    for nome, fn in (("apps_script", de_apps_script), ("planilha_publicada", de_planilha_publicada)):
        try:
            abas = fn()
            break
        except Exception as e:  # noqa: BLE001
            erros.append(f"{nome}: {e}")
            print(f"[aviso] {nome} falhou: {e}", file=sys.stderr)
    else:
        print("Nenhuma fonte respondeu:\n  " + "\n  ".join(erros), file=sys.stderr)
        sys.exit(1)

    novo_conteudo = {"fonte": nome, "abas": abas}
    antigo = None
    if os.path.exists(SAIDA):
        try:
            with open(SAIDA, encoding="utf-8") as f:
                antigo = json.load(f)
        except Exception:  # noqa: BLE001
            antigo = None
    if antigo and {k: antigo.get(k) for k in ("fonte", "abas")} == novo_conteudo:
        print("Sem mudanças na planilha.")
        return

    novo_conteudo["atualizadoEm"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    os.makedirs(os.path.dirname(SAIDA) or ".", exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(novo_conteudo, f, ensure_ascii=False, indent=1, default=str)
    print(f"{SAIDA} atualizado a partir de: {nome}")


if __name__ == "__main__":
    main()
