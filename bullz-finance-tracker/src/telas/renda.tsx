/* Renda: empresas de setores perenes pelos seus quatro critérios — port de
 * telas/renda.js. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Item, KpiValor, Kpis, Legenda, Lista, Mensagem, Num, Pilula, Roda, Secao, T, Tabela } from "../ui/kit";
import { Campo, Entrada, Interruptor, Segmentado } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { ui } from "../ui/folha";
import { EstadoMercado } from "./comum/alertas";
import { BlocoGraham } from "./comum/ativo";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
const pct = (v: any, c = 2) => (ok(v) ? FC.fmt.num(v, c) + "%" : "—");
let criterios: any = null;
let soAprovados = false;
// cotação ao vivo das empresas do universo (Yahoo), renovada a cada 2 min
const vivo: { em: number; dados: Record<string, any>; buscando: boolean } = { em: 0, dados: {}, buscando: false };
async function atualizaVivo(cfg: any) {
  if (vivo.buscando || Date.now() - vivo.em < 2 * 60 * 1000) return false;
  vivo.buscando = true;
  try {
    const itens = Object.values<any>(cfg.setores || {}).flatMap((b) => Object.keys(b.empresas || {})).map((t) => ({ ticker: t, classe: "acao_br" }));
    const d = await FC.mercado.cotacoes(itens);
    for (const [t, v] of Object.entries<any>(d)) if (v && ok(v.preco)) vivo.dados[t] = v;
    vivo.em = Date.now();
    return true;
  } catch (e) { console.error(e); return false; } finally { vivo.buscando = false; }
}
// o preço entra nas contas que dependem dele (DY, P/L, P/VP, preço justo)
function comPrecoVivo(acoes: any) {
  const saida = { ...acoes };
  for (const [t, v] of Object.entries<any>(vivo.dados)) {
    const a = acoes[t];
    if (!a || !a.cotacao) continue;
    const k = v.preco / a.cotacao;
    saida[t] = { ...a, cotacao: v.preco, variacao_dia: v.variacao_dia,
      dy: a.dy != null ? a.dy / k : a.dy, pl: a.pl != null ? a.pl * k : a.pl, pvp: a.pvp != null ? a.pvp * k : a.pvp };
  }
  return saida;
}

function TabelaSetor({ b, crit, aoAbrir }: { b: any; crit: any; aoAbrir: (t: string) => void }) {
  const t = useTema();
  const med = b.medianas;
  const linhas = b.linhas.filter((l: any) => !soAprovados || l.passa);
  return (
    <View>
      <View style={{ marginTop: 40, marginBottom: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: t.espaco.e3 }}>
        <View style={{ flexShrink: 1 }}>
          <T style={{ fontSize: 20, fontWeight: "600" }}>{b.setor}</T>
          <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 4 }}>{crit.alvo === "fixo" ? `preço justo com piso de ${FC.fmt.num(crit.dy_desejado)}%` : <>preço justo com o DY mediano do setor, <B>{pct(med.dy)}</B></>} · {b.aprovadas} de {b.total} passam</T>
        </View>
        {b.mediana_fina ? <View style={{ marginLeft: "auto" }}><Pilula cor="amarelo">{`mediana de só ${b.n_dy} empresa${b.n_dy === 1 ? "" : "s"} — referência frágil`}</Pilula></View> : null}
      </View>
      <Cartao semPad>
        <Tabela minimo={1100} onLinha={(i) => { const l = i > 0 ? linhas[i - 1] : null; if (l && !l.ausente) aoAbrir(l.ticker); }}
          cabecas={[{ t: "Empresa", largura: 170 }, { t: "Cotação", n: true }, { t: "L/P", n: true, largura: 80 }, { t: "Preço justo", n: true, largura: 130 }, { t: "Graham", n: true, largura: 120 },
            { t: "DL/EBITDA", n: true, largura: 100 }, { t: "Payout", n: true, largura: 100 }, { t: "DY", n: true, largura: 130 }, { t: "ROE", n: true, largura: 70 }, { t: "P/VP", n: true, largura: 70 }, { t: "", largura: 120 }]}
          linhas={[
            { estilo: "mediana", celulas: ["Mediana do setor", "—", pct(med.lucro_preco), "—", "", b.sem_ebitda ? "n/a" : ok(med.dl_ebitda) ? FC.fmt.num(med.dl_ebitda, 1) + "x" : "—",
              pct(med.payout, 0), { v: pct(med.dy), peso: "600" }, pct(med.roe, 0), ok(med.pvp) ? FC.fmt.num(med.pvp) : "—", ""] },
            ...linhas.map((l: any) => l.ausente ? { estilo: "apagado", celulas: [{ v: <B>{l.nome}</B>, leg: l.ticker }, { v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>não encontrado no Fundamentus — confira o código em Ajustes → Universo de renda</T> }, "", "", "", "", "", "", "", "", ""] } : {
              estilo: l.passa ? (l.tenho ? "meu" : undefined) : "apagado",
              celulas: [
                { v: <B>{l.nome}</B>, leg: `${l.ticker}${l.tenho ? " · na carteira" : ""}` },
                { v: FC.fmt.num(l.cotacao), leg: ok(l.variacao_dia) ? <T style={{ fontSize: 12, color: l.variacao_dia >= 0 ? t.cores.verde : t.cores.vermelho }}>{FC.fmt.delta(l.variacao_dia, 2)}% hoje</T> : undefined },
                pct(l.lucro_preco),
                ok(l.preco_justo) && l.justo_nao_confiavel ? { v: <T style={{ color: t.cores.ink3, textDecorationLine: "line-through", fontSize: 14 }}>{FC.fmt.num(l.preco_justo)}</T>, leg: <T style={{ fontSize: 12, color: t.cores.vermelho }}>não confiável</T> }
                  : ok(l.preco_justo) ? { v: FC.fmt.num(l.preco_justo), peso: "600", leg: Math.abs(l.desconto) < 0.5 ? "na cota" : l.desconto > 0 ? FC.fmt.num(l.desconto, 0) + "% acima da cota" : FC.fmt.num(-l.desconto, 0) + "% abaixo" } : "—",
                l.graham && l.graham.valor != null ? { v: FC.fmt.num(l.graham.valor), peso: "600", leg: <T style={{ fontSize: 12, color: l.graham.margem >= 0 ? t.cores.verde : t.cores.vermelho }}>{FC.fmt.delta(l.graham.margem, 0)}% margem</T> }
                  : { v: "", leg: l.graham && /bancos/.test(l.graham.motivo || "") ? "não se aplica" : "n/a" },
                { v: l.sem_ebitda ? "n/a" : ok(l.dl_ebitda) ? FC.fmt.num(l.dl_ebitda, 1) + "x" : "—", cls: l.sem_ebitda ? "muito-fraco" : l.testes.divida === false ? "neg" : null },
                { v: pct(l.payout, 0), cls: l.testes.payout === false ? "neg" : null, leg: ok(l.payout_vs_setor) ? `${FC.fmt.delta(l.payout_vs_setor, 0)} p.p.` : undefined },
                { v: pct(l.dy), peso: "600", leg: ok(l.dy_vs_setor) ? `${FC.fmt.delta(l.dy_vs_setor)} p.p. vs setor` : undefined },
                { v: pct(l.roe, 0), cls: "fraco" }, { v: ok(l.pvp) ? FC.fmt.num(l.pvp) : "—", cls: "fraco" },
                { v: l.passa ? <Pilula cor="verde">passa</Pilula> : <Pilula cor="vermelho">{`${l.n_reprovados} critério${l.n_reprovados === 1 ? "" : "s"}`}</Pilula> },
              ],
            }),
          ]} />
      </Cartao>
    </View>
  );
}

// ---------------------------------------------------------------- detalhe
function Detalhe({ ticker, l }: { ticker: string; l: any }) {
  const t = useTema();
  const [anos, setAnos] = useState(5);
  const [res, setRes] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivoEf = true;
    setRes(null); setErro(null);
    Promise.all([FC.mercado.historicos([{ ticker, classe: "acao_br" }], anos), FC.mercado.benchmarks(anos)]).then(([h, b]: any) => {
      const s = h[ticker];
      if (!s || s.erro) throw new Error("histórico indisponível no Yahoo");
      if (vivoEf) setRes({ s, c: FC.renda.compara(s, b.cdi, b.ibov) });
    }).catch((e) => vivoEf && setErro(e.message || String(e)));
    return () => { vivoEf = false; };
  }, [ticker, anos]);
  if (erro) return <Mensagem tipo="erro" icone="alerta">{erro}</Mensagem>;
  if (!res) return <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center" }}><Roda /></View>;
  const { s, c } = res;
  const r = c.resumo || {};
  const aa = (x: any) => (ok(x) && c.anos > 0 ? (Math.pow(1 + x / 100, 1 / c.anos) - 1) * 100 : null);
  const bloco = (nome: string, k: string, cor: string, tipo?: "tracejado" | "pontilhado") => (
    <View>
      <Legenda itens={[{ cor, rotulo: nome, tipo }]} />
      <KpiValor cls={k === "com_dividendos" || k === "so_preco" ? ((r[k] || 0) >= 0 ? "pos" : "neg") : "fraco"}>{ok(r[k]) ? FC.fmt.delta(r[k]) + "%" : "—"}</KpiValor>
      <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{ok(aa(r[k])) ? FC.fmt.delta(aa(r[k])) + "% ao ano" : ""}</T>
    </View>
  );
  const criterio = (titulo: string, s2: string, v: string, leit: string, teste: any) => (
    <Item key={titulo} titulo={titulo} detalhe={`${s2} · ${leit}`} detalheLinhas={2}
      valores={<Num style={{ fontWeight: "600", fontSize: 15 }}>{v}</Num>}
      direita={titulo === "Preço justo" && l.justo_nao_confiavel ? <Pilula cor="amarelo">não confiável</Pilula>
        : teste == null ? <Pilula cor="cinza">n/a</Pilula> : teste ? <Pilula cor="verde">passa</Pilula> : <Pilula cor="vermelho">reprovado</Pilula>} />
  );
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: t.espaco.e3, marginBottom: t.espaco.e3, alignItems: "center" }}>
        <T style={{ color: t.cores.ink2 }}>{ticker}{l && l.setor ? " · " + l.setor : ""}</T>
        <Segmentado valor={String(anos)} aoMudar={(v) => setAnos(Number(v))} opcoes={[3, 5, 10].map((n) => ({ v: String(n), rotulo: `${n} anos` }))} />
      </View>
      <T v="h3">Retorno de R$ 100 investidos</T>
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>A curva com dividendos reinveste cada pagamento no preço do dia — é o retorno de quem nunca vende.</T>
      <Kpis style={{ marginBottom: 24 }}>
        {bloco("Com dividendos", "com_dividendos", t.cores.s1)}{bloco("Só a cota", "so_preco", t.cores.s2)}
        {bloco("Ibovespa", "ibov", t.cores.sref, "tracejado")}{bloco("CDI", "cdi", t.cores.sref, "pontilhado")}
      </Kpis>
      <Grafico marcador={FC.graficos.linhas({ series: [
        { nome: "Com dividendos", pontos: c.com_dividendos || [], classe: "l1" },
        { nome: "Só a cota", pontos: c.so_preco || [], classe: "l2" },
        { nome: "Ibovespa", pontos: c.ibov || [], classe: "lref" },
        { nome: "CDI", pontos: c.cdi || [], classe: "lref2" }], y: "base100", altura: 280, privado: false })} />
      <Legenda itens={[{ cor: t.cores.s1, rotulo: "com dividendos reinvestidos" }, { cor: t.cores.s2, rotulo: "só a valorização" },
        { cor: t.cores.sref, rotulo: "Ibovespa", tipo: "tracejado" }, { cor: t.cores.sref, rotulo: "CDI", tipo: "pontilhado" }]} />
      {ok(r.com_dividendos) && ok(r.so_preco) ? (
        <Mensagem tipo="info" style={{ marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 14 }}>Em {FC.fmt.num(c.anos, 1)} anos e {(s.dividendos || []).length} pagamentos, a cota {r.so_preco >= 0 ? "subiu" : "caiu"} <B>{FC.fmt.num(Math.abs(r.so_preco), 1)}%</B> e quem reinvestiu terminou com <B>{FC.fmt.delta(r.com_dividendos)}%</B> — <B>{FC.fmt.num(r.com_dividendos - r.so_preco, 1)} p.p.</B> vieram do dividendo.
            {ok(r.cdi) ? (r.com_dividendos > r.cdi ? ` No mesmo período o CDI rendeu ${FC.fmt.num(r.cdi, 1)}%.` : ` No mesmo período o CDI rendeu ${FC.fmt.num(r.cdi, 1)}%, mais que a ação — sem oscilação nem risco de empresa.`) : ""}</T>
        </Mensagem>
      ) : null}
      {l && !l.ausente ? <View style={{ marginTop: t.espaco.e4 }}><BlocoGraham g={l.graham} preco={l.cotacao} /></View> : null}
      {l && !l.ausente ? (
        <>
          <T style={{ fontSize: 17, fontWeight: "600", marginTop: 28, marginBottom: t.espaco.e3 }}>Os critérios hoje</T>
          <Lista>
            {criterio("Payout", "dividendo ÷ lucro", pct(l.payout, 0), l.payout == null ? "sem dado" : l.payout > 100 ? "distribui mais do que lucra" : "cabe dentro do lucro", l.testes.payout)}
            {criterio("Lucro sobre preço", "inverso do P/L", pct(l.lucro_preco), `cada R$ 100 na ação geram ${ok(l.lucro_preco) ? FC.fmt.num(l.lucro_preco) : "—"} de lucro ao ano`, l.testes.lucrativa)}
            {criterio("Preço justo", `para DY de ${pct(l.dy_alvo)}`, ok(l.preco_justo) ? FC.fmt.num(l.preco_justo) : "—",
              l.justo_nao_confiavel ? `não confiável: ${l.justo_nao_confiavel}` : ok(l.desconto) ? (l.desconto >= 0 ? `cota ${FC.fmt.num((1 - l.cotacao / l.preco_justo) * 100, 0)}% abaixo do preço que daria o yield` : `precisaria cair ${FC.fmt.num(-l.desconto, 0)}% para dar o yield`) : "sem dividendo em 12 meses", l.testes.preco)}
            {criterio("Dívida líquida / EBITDA", "alavancagem", l.sem_ebitda ? "n/a" : ok(l.dl_ebitda) ? FC.fmt.num(l.dl_ebitda, 1) + "x" : "—",
              l.sem_ebitda ? "banco não tem EBITDA" : ok(l.dl_ebitda) ? (l.dl_ebitda < 0 ? "caixa líquido" : `${FC.fmt.num(l.dl_ebitda, 1)} anos de geração de caixa`) : "múltiplos indisponíveis", l.testes.divida)}
          </Lista>
        </>
      ) : null}
    </View>
  );
}
function detalhe(ticker: string, linhas: any[]) {
  const l = linhas.find((x) => x.ticker === ticker);
  ui.folha({ titulo: l ? l.nome : ticker, larga: true, corpo: <Detalhe ticker={ticker} l={l} /> });
}

// ---------------------------------------------------------------- tela
export default function Renda() {
  const t = useTema();
  const e = useEstado();
  const { ticker } = useLocalSearchParams<{ ticker?: string }>();
  const [, setTick] = useState(0);
  const cfg = e.prefs ? e.prefs.renda : null;
  const padrao = cfg ? { ...cfg.criterios_padrao, alvo: "setor" } : {};
  if (cfg && !criterios) criterios = { ...padrao };
  const [campos, setCampos] = useState(() => criterios ? Object.fromEntries(["dy_desejado", "payout_maximo", "dl_ebitda_maximo", "liquidez_minima"].map((k) => [k, String(criterios[k] ?? "").replace(".", ",")])) : {});
  useEffect(() => {
    if (cfg && e.mercado.universo && Date.now() - vivo.em > 2 * 60 * 1000) atualizaVivo(cfg).then((mudou) => { if (mudou) rerender(); });
  }, [cfg, e.mercado.universo]);
  useEffect(() => {
    const id = setTimeout(() => {
      let mudou = false;
      for (const k of Object.keys(campos)) { const v = FC.lerNum((campos as any)[k]); if (v != null && v !== criterios[k]) { criterios[k] = v; mudou = true; } }
      if (mudou) setTick((x) => x + 1);
    }, 450);
    return () => clearTimeout(id);
  }, [campos]);
  const universo = e.mercado.universo;
  const cab = (sub: string) => <Cabecalho titulo="Renda" sub={sub} />;
  if (!cfg || !universo || !e.dados) {
    return <Pagina>{cab("Empresas de setores que não dependem de preço de commodity.")}<EstadoMercado /><View style={{ minHeight: 240, alignItems: "center", justifyContent: "center" }}><Roda /></View></Pagina>;
  }
  const linhas = FC.renda.analisa(comPrecoVivo(universo.acoes), cfg, criterios);
  const meus = new Set(e.dados.ativos.filter((a: any) => a.posicao).map((a: any) => a.ticker));
  linhas.forEach((l: any) => { l.tenho = meus.has(l.ticker); });
  const blocos = FC.renda.agrupaPorSetor(linhas, cfg);
  const resumo = FC.renda.resumo(linhas);
  if (ticker) setTimeout(() => detalhe(String(ticker).toUpperCase(), linhas), 0);
  return (
    <Pagina>
      {cab("Empresas de setores perenes — tarifa regulada, contrato longo ou spread — pelos seus quatro critérios.")}
      <T v="p" style={{ marginTop: -12, marginBottom: t.espaco.e3 }}>{vivo.em ? `Cotações ao vivo do Yahoo Finance (${FC.datas.ha(new Date(vivo.em))}, atraso de ~15 min); DY, P/L e P/VP recalculados com o preço de agora.` : "Buscando cotações ao vivo…"} Lucro, dividendos e patrimônio vêm do Fundamentus.</T>
      <EstadoMercado />
      <Cartao>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
          <T v="h3">Seus critérios</T>
          <Segmentado valor={criterios.alvo === "fixo" ? "fixo" : "setor"} aoMudar={(v) => { criterios.alvo = v; setTick((x) => x + 1); }}
            opcoes={[{ v: "setor", rotulo: "DY mediano do setor" }, { v: "fixo", rotulo: "Piso fixo" }]} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {([["dy_desejado", "Piso de DY (%)"], ["payout_maximo", "Payout máximo (%)"], ["dl_ebitda_maximo", "DL/EBITDA máximo"], ["liquidez_minima", "Liquidez mínima (R$ mi/dia)"]] as const).map(([k, rot]) => (
            <View key={k} style={{ flexBasis: 150, flexGrow: 1, opacity: k === "dy_desejado" && criterios.alvo !== "fixo" ? 0.45 : 1 }}>
              <Campo rotulo={rot}><Entrada valor={(campos as any)[k]} aoMudar={(v) => setCampos({ ...campos, [k]: v })} decimal accessibilityLabel={rot} /></Campo>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", marginTop: t.espaco.e3 }}>
          <Interruptor valor={soAprovados} aoMudar={(v) => { soAprovados = v; setTick((x) => x + 1); }} rotulo="Só os que passam" />
          <Botao variante="texto" pequeno onPress={() => {
            criterios = { ...padrao }; soAprovados = false;
            setCampos(Object.fromEntries(["dy_desejado", "payout_maximo", "dl_ebitda_maximo", "liquidez_minima"].map((k) => [k, String(criterios[k] ?? "").replace(".", ",")])));
          }}>Voltar ao padrão</Botao>
        </View>
        <T v="p" style={{ marginTop: t.espaco.e2 }}>O <B>preço justo</B> é o preço em que o dividendo de hoje renderia o DY alvo. Contra a mediana do setor, cada empresa é medida pelas próprias pares — banco, energia, saneamento e telecom vivem em patamares de yield diferentes.</T>
      </Cartao>

      <Secao titulo="Panorama dos setores" sub={`DY mediano · ${resumo.aprovados} de ${resumo.total} empresas passam`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {blocos.map((b: any) => (
            <View key={b.setor} style={{ flexBasis: 220, flexGrow: 1 }}>
              <Cartao>
                <T style={{ fontSize: 13, color: t.cores.ink2 }}>{b.setor}</T>
                <T><Num style={{ fontSize: 30, fontWeight: "600", letterSpacing: -0.9 }}>{ok(b.medianas.dy) ? FC.fmt.num(b.medianas.dy) : "—"}</Num><T style={{ fontSize: 15, color: t.cores.ink2 }}>%</T></T>
                <T style={{ fontSize: 13, color: t.cores.ink2 }}>{b.aprovadas} de {b.total} passam{b.tenho ? ` · ${b.tenho} na carteira` : ""}</T>
              </Cartao>
            </View>
          ))}
        </View>
      </Secao>

      {blocos.map((b: any) => <TabelaSetor key={b.setor} b={b} crit={criterios} aoAbrir={(tk) => detalhe(tk, linhas)} />)}

      <T v="p" style={{ marginTop: 48 }}><B>L/P</B> é o inverso do P/L, lido como rendimento. <B>Payout</B> = DY × P/L. A linha cinza é a <B>mediana</B>, não a média: um payout de 250% num ano de venda de ativo estragaria a referência dos vizinhos. Banco não tem EBITDA, então o critério de dívida não se aplica a ele (n/a); o preço justo de Graham também não se aplica a bancos e seguradoras. Quando o dividendo passa do lucro (payout acima de 100% ou prejuízo), o preço justo pelo DY aparece riscado: aquele dividendo não se sustenta e o teste de preço fica de fora.</T>
    </Pagina>
  );
}
