/* Comparar 2 ou 3 ativos do mesmo tipo, lado a lado: preço, score, Graham,
 * cada indicador do avaliador e o DY. O melhor de cada linha fica marcado. */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../../tema";
import { Anel, B, Botao, Num, Roda, T, Tabela } from "../../ui/kit";
import { Entrada } from "../../ui/campos";
import { ui } from "../../ui/folha";
import { acharAtivo } from "./dados";
import { avaliaCodigo } from "./ativo";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);
const MAX = 3;

async function carrega(ticker: string, classe: string) {
  const meu = acharAtivo(ticker);
  if (meu && !meu.erro) return meu;
  return avaliaCodigo(ticker, classe);
}

function codigosDoTipo(classe: string): string[] {
  const u = FC.estado.mercado.universo;
  const meus = ((FC.estado.dados && FC.estado.dados.ativos) || []).filter((a: any) => a.classe === classe).map((a: any) => a.ticker);
  const doUniverso = u ? Object.keys(classe === "fii" ? u.fiis : classe === "acao_br" ? u.acoes : {}) : [];
  return [...new Set([...meus, ...doUniverso])].sort();
}

function CorpoComparar({ iniciais, classe }: { iniciais: string[]; classe: string }) {
  const t = useTema();
  const [codigos, setCodigos] = useState<string[]>(iniciais);
  const [ativos, setAtivos] = useState<Record<string, any>>({});
  const [cod, setCod] = useState("");
  useEffect(() => {
    for (const c of codigos) {
      if (ativos[c] !== undefined) continue;
      setAtivos((x) => ({ ...x, [c]: null }));
      carrega(c, classe)
        .then((a) => setAtivos((x) => ({ ...x, [c]: a })))
        .catch((e) => { ui.erro(e); setCodigos((l) => l.filter((y) => y !== c)); setAtivos((x) => { const n = { ...x }; delete n[c]; return n; }); });
    }
  }, [codigos]); // eslint-disable-line react-hooks/exhaustive-deps
  const todos = codigosDoTipo(classe);
  const sugestoes = cod.length >= 2 ? todos.filter((x) => x.startsWith(cod.toUpperCase()) && !codigos.includes(x)).slice(0, 6) : [];
  const adiciona = (bruto: string) => {
    const c = bruto.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (c.length < 2 || codigos.includes(c)) return;
    if (codigos.length >= MAX) { ui.aviso(`Compare até ${MAX} ativos de cada vez.`, "erro"); return; }
    setCodigos([...codigos, c]); setCod("");
  };
  const prontos = codigos.map((c) => ativos[c]).filter(Boolean);

  // cada linha: rótulo, o valor de cada ativo, uma legenda opcional e o número que acha o
  // melhor (maior é melhor; null = linha só informativa). { grupo } separa os blocos.
  type L = { rotulo: string; dica?: string; vals: React.ReactNode[]; legs?: Array<string | undefined>; nums: Array<number | null> } | { grupo: string };
  const linhas: L[] = [];
  const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
  const fund = (a: any) => (a.classe === "fii" ? u.fiis[a.ticker] : u.acoes[a.ticker]) || {};
  const pct = (v: any, c = 1) => (ok(v) ? `${FC.fmt.num(v, c)}%` : "—");
  const num = (v: any) => (ok(v) ? FC.fmt.num(v, 2) : "—");
  const mi = (v: any) => (ok(v) ? `R$ ${FC.fmt.num(v / 1e6, 1)} mi` : "—");
  // linha a partir de um campo do Fundamentus; sentido: 1 maior é melhor, -1 menor é melhor, 0 só informa
  const daRegra = new Set<string>(prontos.flatMap((a) => (a.metricas || []).map((m: any) => m.chave)));
  const linhaFund = (rotulo: string, campo: string, fmt: (v: any) => string, sentido: 1 | -1 | 0, dica?: string) => {
    if (daRegra.has(campo)) return;
    const vs = prontos.map((a) => fund(a)[campo]);
    if (!vs.some(ok)) return;
    linhas.push({ rotulo, dica, vals: vs.map((v) => fmt(v)), nums: vs.map((v) => (sentido && ok(v) && !(sentido === -1 && v <= 0) ? sentido * v : null)) });
  };
  if (prontos.length) {
    linhas.push({ grupo: "Preço" });
    linhas.push({ rotulo: "Preço", vals: prontos.map((a) => FC.fmt.preco(a.preco)),
      legs: prontos.map((a) => (ok(a.variacao_dia) ? `${FC.fmt.delta(a.variacao_dia, 2)}% hoje` : undefined)), nums: prontos.map(() => null) });
    linhas.push({ rotulo: "Faixa de 52 semanas", dica: "0% = na mínima do ano, 100% = na máxima",
      vals: prontos.map((a) => (ok(a.min_52s) && ok(a.max_52s) && a.max_52s > a.min_52s ? `${FC.fmt.num(((a.preco - a.min_52s) / (a.max_52s - a.min_52s)) * 100, 0)}%` : "—")),
      legs: prontos.map((a) => (ok(a.min_52s) && ok(a.max_52s) ? `${FC.fmt.preco(a.min_52s)} – ${FC.fmt.preco(a.max_52s)}` : undefined)), nums: prontos.map(() => null) });
    if (prontos.some((a) => a.graham && ok(a.graham.valor))) {
      linhas.push({ rotulo: "Margem de Graham", dica: "quanto a cotação está abaixo do preço justo",
        vals: prontos.map((a) => (a.graham && ok(a.graham.valor) ? `${FC.fmt.delta(a.graham.margem, 0)}%` : "—")),
        legs: prontos.map((a) => (a.graham && ok(a.graham.valor) ? `justo ${FC.fmt.preco(a.graham.valor)}` : a.graham ? "não se aplica" : undefined)),
        nums: prontos.map((a) => (a.graham && ok(a.graham.valor) ? a.graham.margem : null)) });
    }
    linhas.push({ grupo: "Suas regras" });
    linhas.push({ rotulo: "Score", dica: "aderência aos seus critérios, 0 a 100",
      vals: prontos.map((a) => <View key={a.ticker} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Anel score={a.score} cor={a.cor} /></View>),
      legs: prontos.map((a) => a.veredito_curto || undefined), nums: prontos.map((a) => (ok(a.score) ? a.score : null)) });
    const chaves: Array<[string, string]> = [];
    for (const a of prontos) for (const m of a.metricas || []) if (!chaves.some(([k]) => k === m.chave)) chaves.push([m.chave, m.rotulo]);
    for (const [k, rotulo] of chaves) {
      const ms = prontos.map((a) => (a.metricas || []).find((m: any) => m.chave === k));
      linhas.push({ rotulo, vals: ms.map((m) => (m && m.valor != null ? FC.fmt.metrica(m.valor, m.unidade) : "—")),
        legs: ms.map((m) => (m && m.nota != null ? `nota ${Math.round(m.nota)}` : undefined)), nums: ms.map((m) => (m && m.nota != null ? m.nota : null)) });
    }
    linhas.push({ grupo: "Fundamentus" });
    if (classe === "fii") {
      linhaFund("Segmento", "segmento", (v) => v || "—", 0);
      linhaFund("DY 12 meses", "dy", (v) => pct(v), 1);
      linhaFund("P/VP", "pvp", num, -1, "abaixo de 1: cota mais barata que o patrimônio");
      linhaFund("Vacância", "vacancia", (v) => pct(v), -1);
      linhaFund("Cap rate", "cap_rate", (v) => pct(v), 1);
      linhaFund("Imóveis", "qtd_imoveis", (v) => (ok(v) ? FC.fmt.int(v) : "—"), 0);
      linhaFund("Patrimônio", "valor_mercado", mi, 0);
      linhaFund("Liquidez por dia", "liquidez", mi, 0);
    } else {
      linhaFund("DY 12 meses", "dy", (v) => pct(v), 1);
      linhaFund("P/L", "pl", num, -1);
      linhaFund("P/VP", "pvp", num, -1);
      linhaFund("ROE", "roe", (v) => pct(v), 1);
      linhaFund("Margem líquida", "mrg_liquida", (v) => pct(v), 1);
      linhaFund("Dívida líquida / patrimônio", "div_liq_pl", num, 0);
      linhaFund("Crescimento da receita (5 anos)", "cresc_rec_5a", (v) => pct(v), 1);
      linhaFund("Liquidez por dia", "liquidez", mi, 0);
    }
  }
  // quem leva mais linhas: o resumo que abre a tabela
  const vitorias = prontos.map(() => 0);
  let disputadas = 0;
  for (const l of linhas) {
    if ("grupo" in l) continue;
    const validos = l.nums.filter((n): n is number => n != null);
    if (validos.length < 2) continue;
    const m = Math.max(...validos);
    if (validos.filter((n) => n === m).length > 1) continue;   // empate: ninguém leva
    disputadas++;
    l.nums.forEach((n, i) => { if (n === m) vitorias[i]++; });
  }
  const lider = vitorias.length ? vitorias.indexOf(Math.max(...vitorias)) : -1;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: t.espaco.e3, alignItems: "center" }}>
        {codigos.map((c) => (
          <Pressable key={c} onPress={() => { setCodigos(codigos.filter((x) => x !== c)); }} accessibilityLabel={`Tirar ${c} da comparação`}
            style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 980, backgroundColor: t.cores.acentoSuave }}>
            <Text style={{ fontWeight: "600", color: t.cores.acento }}>{c}</Text><Text style={{ color: t.cores.acento }}>✕</Text>
          </Pressable>
        ))}
        {codigos.length < MAX ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexGrow: 1, minWidth: 220 }}>
            <View style={{ flex: 1 }}>
              <Entrada valor={cod} aoMudar={setCod} maiusculas placeholder={classe === "fii" ? "Outro FII: HGLG11…" : "Outro código: ITSA4…"}
                accessibilityLabel="Código para comparar" onSubmitEditing={() => adiciona(cod)} returnKeyType="done" />
            </View>
            <Botao variante="sec" pequeno onPress={() => adiciona(cod)}>Incluir</Botao>
          </View>
        ) : null}
      </View>
      {sugestoes.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: t.espaco.e3 }}>
          {sugestoes.map((s) => (
            <Pressable key={s} onPress={() => adiciona(s)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}>
              <Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {codigos.some((c) => ativos[c] === null) ? <View style={{ minHeight: 80, alignItems: "center", justifyContent: "center" }}><Roda /></View> : null}
      {prontos.length < 2 ? (
        <T v="p">Inclua {prontos.length ? "mais um código" : "dois códigos"} do mesmo tipo ({FC.CLASSES[classe] || classe}) para comparar.</T>
      ) : (
        <>
          {disputadas ? (
            <T style={{ fontSize: 15, marginBottom: t.espaco.e3 }}>
              <B>{prontos[lider].ticker}</B> se sai melhor em {vitorias[lider]} de {disputadas} indicadores
              {prontos.length > 2 || vitorias.filter((v) => v === vitorias[lider]).length > 1 ? ` (${prontos.map((a, i) => `${a.ticker} ${vitorias[i]}`).join(" · ")})` : ` (${prontos[1 - lider].ticker}: ${vitorias[1 - lider]})`}.
            </T>
          ) : null}
          <View style={{ borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, overflow: "hidden" }}>
            <Tabela minimo={200 + prontos.length * 150}
              cabecas={[{ t: "Indicador", largura: 200 }, ...prontos.map((a) => ({ t: a.ticker, n: true, largura: 150 }))]}
              linhas={linhas.map((l) => {
                if ("grupo" in l) return l;
                const validos = l.nums.filter((n): n is number => n != null);
                const max = validos.length > 1 ? Math.max(...validos) : null;
                const melhor = max != null && validos.filter((n) => n === max).length === 1 ? max : null;   // empate não marca
                const ganha = (i: number) => melhor != null && l.nums[i] === melhor;
                return [
                  { v: <T style={{ fontSize: 13, color: t.cores.ink }}>{l.rotulo}</T>, leg: l.dica },
                  ...l.vals.map((v, i) => ({ n: true, leg: l.legs && l.legs[i], v: (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel={ganha(i) ? "melhor desta linha" : undefined}>
                      {ganha(i) ? <Text style={{ color: t.cores.verde, fontSize: 12 }}>●</Text> : null}
                      {typeof v === "string" ? <Num style={{ fontSize: 14, fontWeight: ganha(i) ? "700" : "400", color: ganha(i) ? t.cores.verde : undefined }}>{v}</Num> : v}
                    </View>) })),
                ];
              })} />
          </View>
          <T v="p" style={{ marginTop: t.espaco.e3 }}><B>●</B> e verde: o melhor da linha (nas suas regras, pela nota do indicador; no Fundamentus, maior DY, ROE e margem, menor P/L, P/VP e vacância). Sem ● na linha: empate ou só informação. Não é recomendação de compra ou venda.</T>
        </>
      )}
    </View>
  );
}

/** abre a comparação com estes códigos já incluídos */
export function abreComparar(iniciais: string[], classe: string) {
  ui.folha({ titulo: `Comparar · ${FC.CLASSE_ROTULO[classe] || classe}`, larga: true, corpo: <CorpoComparar iniciais={iniciais.slice(0, MAX)} classe={classe} /> });
}
