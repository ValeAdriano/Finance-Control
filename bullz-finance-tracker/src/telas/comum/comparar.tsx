/* Comparar 2 ou 3 ativos do mesmo tipo, lado a lado: preço, score, Graham,
 * cada indicador do avaliador e o DY. O melhor de cada linha fica marcado. */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTema } from "../../tema";
import { Anel, B, Botao, Num, Pilula, Roda, T, Tabela } from "../../ui/kit";
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

  // linhas: [rótulo, valor exibido por ativo, número para achar o melhor (maior é melhor)]
  type L = { rotulo: string; vals: React.ReactNode[]; nums: Array<number | null> };
  const linhas: L[] = [];
  const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
  const fund = (a: any) => (a.classe === "fii" ? u.fiis[a.ticker] : u.acoes[a.ticker]) || {};
  if (prontos.length) {
    linhas.push({ rotulo: "Preço", vals: prontos.map((a) => <Num key={a.ticker} style={{ fontWeight: "600" }}>{FC.fmt.preco(a.preco)}</Num>), nums: prontos.map(() => null) });
    linhas.push({ rotulo: "Score", vals: prontos.map((a) => <View key={a.ticker} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Anel score={a.score} cor={a.cor} /><Pilula cor={a.cor} semPonto>{a.veredito_curto || ""}</Pilula></View>), nums: prontos.map((a) => (ok(a.score) ? a.score : null)) });
    if (prontos.some((a) => a.graham && ok(a.graham.valor))) {
      linhas.push({ rotulo: "Margem de Graham", vals: prontos.map((a) => (a.graham && ok(a.graham.valor) ? `${FC.fmt.delta(a.graham.margem, 0)}%` : "—")), nums: prontos.map((a) => (a.graham && ok(a.graham.valor) ? a.graham.margem : null)) });
    }
    linhas.push({ rotulo: "DY (Fundamentus)", vals: prontos.map((a) => (ok(fund(a).dy) ? `${FC.fmt.num(fund(a).dy)}%` : "—")), nums: prontos.map((a) => (ok(fund(a).dy) ? fund(a).dy : null)) });
    if (classe === "fii") {
      linhas.push({ rotulo: "Segmento", vals: prontos.map((a) => fund(a).segmento || a.segmento || "—"), nums: prontos.map(() => null) });
      linhas.push({ rotulo: "Vacância", vals: prontos.map((a) => (ok(fund(a).vacancia) ? `${FC.fmt.num(fund(a).vacancia)}%` : "—")), nums: prontos.map((a) => (ok(fund(a).vacancia) ? -fund(a).vacancia : null)) });
    }
    const chaves: Array<[string, string]> = [];
    for (const a of prontos) for (const m of a.metricas || []) if (!chaves.some(([k]) => k === m.chave)) chaves.push([m.chave, m.rotulo]);
    for (const [k, rotulo] of chaves) {
      const ms = prontos.map((a) => (a.metricas || []).find((m: any) => m.chave === k));
      linhas.push({ rotulo, vals: ms.map((m) => (m && m.valor != null ? FC.fmt.metrica(m.valor, m.unidade) : "—")), nums: ms.map((m) => (m && m.nota != null ? m.nota : null)) });
    }
  }
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
          <View style={{ borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, overflow: "hidden" }}>
            <Tabela minimo={160 + prontos.length * 150}
              cabecas={[{ t: "", largura: 160 }, ...prontos.map((a) => ({ t: a.ticker, n: true, largura: 150 }))]}
              linhas={linhas.map((l) => {
                const validos = l.nums.filter((n): n is number => n != null);
                const melhor = validos.length > 1 ? Math.max(...validos) : null;
                return [
                  { v: <T style={{ fontSize: 13.5, color: t.cores.ink2 }}>{l.rotulo}</T> },
                  ...l.vals.map((v, i) => ({ n: true, v: (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {melhor != null && l.nums[i] === melhor ? <Text style={{ color: t.cores.verde, fontSize: 12 }}>●</Text> : null}
                      {typeof v === "string" ? <Num style={{ fontSize: 14, fontWeight: melhor != null && l.nums[i] === melhor ? "700" : "400" }}>{v}</Num> : v}
                    </View>) })),
                ];
              })} />
          </View>
          <T v="p" style={{ marginTop: t.espaco.e3 }}><B>●</B> marca o melhor de cada linha pela nota do indicador nas suas regras (ou o maior DY e a menor vacância). Não é recomendação de compra ou venda.</T>
        </>
      )}
    </View>
  );
}

/** abre a comparação com estes códigos já incluídos */
export function abreComparar(iniciais: string[], classe: string) {
  ui.folha({ titulo: `Comparar · ${FC.CLASSE_ROTULO[classe] || classe}`, larga: true, corpo: <CorpoComparar iniciais={iniciais.slice(0, MAX)} classe={classe} /> });
}
