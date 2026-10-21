/* Detalhe do ativo (comum.js): detalheAtivo, blocoGraham, blocoFii,
 * evolucaoPosicao, abreAtivo e analisaAvulso. */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { Anel, B, Botao, Detalhes, Item, Kpi, KpiValor, Kpis, Legenda, Lista, Mensagem, Num, Pilula, Ponto, Rs, T, degrade } from "../../ui/kit";
import { Grafico } from "../../ui/grafico";
import { ui } from "../../ui/folha";
import { BlocoRentabAtivo } from "./rentab";
import { acharAtivo } from "./dados";
import { formAtivo } from "./formularios";
import { BlocoPreco, GraficoPreco } from "./preco";
import { BlocoProventos } from "./pagadoras";
import { abreComparar } from "./comparar";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);

// Cada tipo de FII tem um risco diferente, e a análise muda com ele.
const TIPOS_FII: Record<string, [string, string, string]> = {
  fii_tijolo: ["Tijolo", "azul", "O que paga é o aluguel: P/VP, DY, vacância física (área vaga), vacância financeira (receita que deixa de entrar) e se a renda depende de poucos imóveis ou de um setor só."],
  fii_papel: ["Papel (CRI)", "amarelo", "Não há imóvel nem vacância: o risco é de crédito. P/VP, DY e o quanto a carteira depende do maior CRI."],
  fii_fof: ["Fundo de fundos", "azul", "Carteira de cotas de outros FIIs: P/VP (FOF costuma negociar com desconto), DY e o peso do maior fundo da carteira."],
  fii_hibrido: ["Híbrido", "cinza", "Imóveis e papéis juntos: P/VP, DY, vacâncias da parte de imóveis e a concentração na maior posição."],
};

function Rot({ children }: { children: React.ReactNode }) {
  const t = useTema();
  return <T style={{ fontSize: 12.5, fontWeight: "600", color: t.cores.ink2, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</T>;
}

export function BlocoFii({ a }: { a: any }) {
  const t = useTema();
  if (a.classe !== "fii") return null;
  const tipo = TIPOS_FII[a.perfil] || TIPOS_FII.fii_tijolo, c = a.cvm;
  const p = (v: any) => (ok(v) ? `${FC.fmt.num(v, 1)}%` : "—");
  const fatos: Array<[string, string, string]> = [];
  if (c) {
    if (ok(c.receita_aluguel)) fatos.push(["Receita de aluguel", p(c.receita_aluguel), "do que entrou no trimestre (o resto vem de CRIs e cotas)"]);
    if (c.n_imoveis) fatos.push(["Imóveis", FC.fmt.int(c.n_imoveis), ok(c.maior_imovel) ? `o maior traz ${p(c.maior_imovel)} da receita` : ""]);
    if (c.maior_setor) fatos.push(["Maior setor de inquilinos", c.maior_setor.nome, `${p(c.maior_setor.pct)} da receita · ${c.n_setores} setor${c.n_setores === 1 ? "" : "es"}`]);
    if (ok(c.vacancia_fisica_cvm)) fatos.push(["Vacância física", p(c.vacancia_fisica_cvm), "área vaga, ponderada pela área de cada imóvel"]);
    if (ok(c.vacancia_financeira)) fatos.push(["Vacância financeira", p(c.vacancia_financeira), "estimada: receita que os espaços vagos deixam de gerar"]);
    if (ok(c.inadimplencia)) fatos.push(["Inadimplência", p(c.inadimplencia), "ponderada pela receita de cada imóvel"]);
    if (c.cri) fatos.push(["CRIs", FC.fmt.int(c.cri.n), `o maior é ${p(c.cri.maior)} da carteira de CRIs · 5 maiores: ${p(c.cri.top5)}`]);
    if (c.fii) fatos.push(["Cotas de FIIs", FC.fmt.int(c.fii.n), `o maior é ${p(c.fii.maior)} · 5 maiores: ${p(c.fii.top5)}`]);
  }
  const tri = c ? c.data_referencia.slice(0, 7).split("-").reverse().join("/") : null;
  return (
    <View style={{ borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, paddingVertical: t.espaco.e3, paddingHorizontal: t.espaco.e4, marginBottom: t.espaco.e4, backgroundColor: t.cores.bg2 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <View style={{ gap: 6 }}><Rot>Raio-X do fundo</Rot><Pilula cor={tipo[1]}>{tipo[0]}</Pilula></View>
        {c ? <T style={{ fontSize: 12, color: t.cores.ink3 }}>CVM · informe de {tri}</T> : null}
      </View>
      <T v="p">{tipo[2]}</T>
      {fatos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 14, columnGap: 22, marginTop: 14 }}>
          {fatos.map(([tt, v, s], i) => (
            <View key={i} style={{ minWidth: 190, flexGrow: 1, flexBasis: 190 }}>
              <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{tt}</T>
              <Num style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, marginTop: 2 }}>{v}</Num>
              {s ? <T style={{ fontSize: 12, lineHeight: 16, color: t.cores.ink3, marginTop: 2 }}>{s}</T> : null}
            </View>
          ))}
        </View>
      ) : <T v="p" style={{ marginTop: t.espaco.e2, color: t.cores.ink2 }}>Sem informe trimestral na CVM para este fundo — a análise usa só os dados do Fundamentus.</T>}
    </View>
  );
}

/** bloco de destaque: preço justo, margem de segurança e a conta */
export function BlocoGraham({ g, preco }: { g: any; preco: number }) {
  const t = useTema();
  if (!g) return null;
  const caixa = { borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, paddingVertical: t.espaco.e3, paddingHorizontal: t.espaco.e4, marginBottom: t.espaco.e4 };
  if (g.valor == null) {
    return (
      <View style={[caixa, { backgroundColor: t.cores.bg3 }]}>
        <Rot>Preço justo de Graham</Rot>
        <T style={{ fontSize: 18, fontWeight: "700", color: t.cores.ink2 }}>não se aplica</T>
        <T style={{ fontSize: 13.5, color: t.cores.ink2, marginTop: 6 }}>{g.motivo}.</T>
      </View>
    );
  }
  const topo = Math.max(preco, g.valor) * 1.18;
  const pP = (preco / topo) * 100, pJ = (g.valor / topo) * 100;
  const [ini, fim] = pP < pJ ? [pP, pJ] : [pJ, pP];
  const perto = Math.abs(pP - pJ) < 22;
  const desloca = (quem: "cota" | "justo") => {
    if (!perto) return 0;
    const primeiro = pP <= pJ ? "cota" : "justo";
    return quem === primeiro ? -0.42 : 0.42;
  };
  const marca = (quem: "cota" | "justo", pos: number, valor: number) => (
    <View style={{ position: "absolute", top: 0, left: `${pos}%` as any, alignItems: "center", gap: 6, transform: [{ translateX: -40 }], width: 80 }}>
      <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: quem === "justo" ? t.cores.acento : t.cores.ink }} />
      <View style={{ transform: [{ translateX: desloca(quem) * 80 }] }}>
        <T centro style={{ fontSize: 11.5, lineHeight: 14, color: t.cores.ink2 }}>{quem === "cota" ? "cotação" : "justo"}</T>
        <Num style={{ fontSize: 13, fontWeight: "600", textAlign: "center", color: quem === "justo" ? t.cores.acento : t.cores.ink }}>{FC.fmt.preco(valor)}</Num>
      </View>
    </View>
  );
  return (
    <View style={[caixa, { backgroundColor: t.cores.bg2, overflow: "hidden" }]}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        ...degrade(`linear-gradient(135deg, ${t.cores.acentoSuave}, transparent 70%)`) } as any} />
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <View><Rot>Preço justo de Graham</Rot><Num style={{ fontSize: 30, fontWeight: "700", letterSpacing: -0.9 }}>{FC.fmt.preco(g.valor)}</Num></View>
        <Pilula cor={g.cor}>{g.leitura}</Pilula>
      </View>
      <View style={{ height: 74, marginTop: 18, marginHorizontal: 6, marginBottom: 4 }} accessibilityElementsHidden>
        <View style={{ position: "absolute", left: 0, right: 0, top: 10, height: 8, borderRadius: 4, backgroundColor: t.cores.campo }}>
          <View style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 4, left: `${ini}%` as any, width: `${fim - ini}%` as any,
            backgroundColor: g.margem >= 0 ? t.cores.verde : t.cores.vermelho, opacity: g.margem >= 0 ? 0.55 : 0.45 }} />
        </View>
        {marca("cota", pP, preco)}
        {marca("justo", pJ, g.valor)}
      </View>
      <T style={{ fontSize: 13.5, color: t.cores.ink2, marginTop: 6 }}>
        √(22,5 × LPA {FC.fmt.preco(g.lpa)} × VPA {FC.fmt.preco(g.vpa)}) · margem de segurança <B cls={g.margem >= 0 ? "pos" : "neg"}>{FC.fmt.delta(g.margem, 0)}%</B>
      </T>
      <Detalhes rotulo="Como ler" tam={13.5} style={{ marginTop: 8 }}>
        <T v="p">Benjamin Graham, mentor de Warren Buffett, estimava o valor de uma ação pelo lucro (LPA) e pelo patrimônio (VPA) por ação. O 22,5 vem dos limites dele para uma ação defensiva: P/L até 15 e P/VP até 1,5. Cotação abaixo do preço justo sugere desconto — Graham pedia uma <B>margem de segurança</B> antes de comprar. Funciona melhor em empresas maduras e lucrativas; em empresas de crescimento, ciclo de commodity ou lucro extraordinário, a fórmula tende a errar.</T>
      </Detalhes>
    </View>
  );
}

// a posição dia a dia, tirada dos registros diários
function EvolucaoPosicao({ a }: { a: any }) {
  const t = useTema();
  const regs = ((FC.estado.dados && FC.estado.dados.registros) || []).map((r: any) => [r.data, (r.ativos || []).find((x: any) => x.ticker === a.ticker)]).filter(([, x]: any) => x);
  if (regs.length < 2) return null;
  const custo = regs.filter(([, x]: any) => ok(x.custo));
  return (
    <View>
      <T style={{ fontSize: 17, fontWeight: "600", marginTop: 8, marginBottom: 4 }}>Evolução da posição</T>
      <T v="p" style={{ marginBottom: t.espaco.e3 }}>quantidade × preço de cada dia registrado</T>
      <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Valor", pontos: regs.map(([d, x]: any) => [d, x.valor]), classe: "l1", area: true },
        ...(custo.length > 1 ? [{ nome: "Custo", pontos: custo.map(([d, x]: any) => [d, x.custo]), classe: "lref" }] : [])], altura: 200 })} />
      <View style={{ marginBottom: t.espaco.e4 }}>
        <Legenda itens={[{ cor: t.cores.s1, rotulo: "valor da posição" }, ...(custo.length > 1 ? [{ cor: t.cores.sref, rotulo: "custo", tipo: "tracejado" as const }] : [])]} />
      </View>
    </View>
  );
}

export function DetalheAtivo({ a }: { a: any }) {
  const t = useTema();
  if (a.erro) return <Mensagem tipo="alerta" icone="alerta">{a.erro}</Mensagem>;
  const pos = a.posicao;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, marginBottom: 20, alignItems: "center" }}>
        <Anel score={a.score} cor={a.cor} grande />
        <View style={{ flex: 1, minWidth: 180 }}>
          <T style={{ fontSize: 13, color: t.cores.ink2 }}>{a.tipo_rotulo}{a.segmento ? " · " + a.segmento : ""}{a.classe === "cripto" && a.cambio ? ` · US$ 1 = R$ ${FC.fmt.num(a.cambio)}` : ""}</T>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}><Pilula cor={a.cor}>{a.veredito}</Pilula></View>
          {a.grupo_pares ? <T v="p" style={{ marginTop: t.espaco.e2 }}>Comparado com: {a.grupo_pares}</T>
            : a.classe === "cripto" ? <T v="p" style={{ marginTop: t.espaco.e2 }}>Avaliada pelo preço contra a própria história</T> : null}
        </View>
      </View>
      <BlocoPreco a={a} />
      {pos ? (
        <Kpis style={{ marginBottom: t.espaco.e4 }}>
          <Kpi pequeno rotulo="Sua posição" valor={FC.fmt.brlTexto(pos.atual)} dinheiro peq={`${FC.fmt.qtd(pos.quantidade)} ${FC.unidade(a, pos.quantidade)}`} />
          {ok(pos.preco_medio) ? <Kpi pequeno rotulo="Preço médio" valor={FC.fmt.preco(pos.preco_medio)} /> : null}
          {ok(pos.variacao) ? <Kpi pequeno rotulo="Resultado" valor={`${FC.fmt.delta(pos.variacao)}%`} cls={pos.resultado >= 0 ? "pos" : "neg"}
            peq={<Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(pos.resultado)}</Rs>} /> : null}
        </Kpis>
      ) : null}
      <GraficoPreco a={a} />
      <BlocoGraham g={a.graham} preco={a.preco} />
      <BlocoFii a={a} />
      <BlocoRentabAtivo ticker={a.ticker} />
      <EvolucaoPosicao a={a} />
      <BlocoProventos a={a} />
      {(a.avisos || []).map((av: string, i: number) => <Mensagem key={i} tipo="alerta" icone="info" style={{ marginBottom: t.espaco.e3 }}>{av}</Mensagem>)}
      <T style={{ fontSize: 17, fontWeight: "600", marginTop: 20, marginBottom: 4 }}>Indicadores</T>
      <T v="p">Valor de hoje frente a cada referência. Na régua, o melhor fica sempre à direita.</T>
      {a.metricas.map((m: any, i: number) => (m.valor == null && !m.sinal_ruim) ? (
        <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha }}>
          <Ponto cor="cinza" /><T style={{ fontWeight: "600", color: t.cores.ink2, fontSize: 13.5 }}>{m.rotulo}</T>
          <T style={{ color: t.cores.ink3, fontSize: 13.5 }}>sem dado — não entra no score</T>
        </View>
      ) : (
        <View key={i} style={{ paddingVertical: t.espaco.e4, borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <T v="h4">{m.rotulo}</T>
            <T style={{ fontSize: 12, color: t.cores.ink3 }}>peso {m.peso}</T>
            {m.divergencia >= 25 ? <Pilula cor="amarelo">as referências discordam</Pilula> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espaco.e4, flexWrap: "wrap", marginBottom: 8 }}>
            <View>
              <Num style={{ fontSize: 28, fontWeight: "600", letterSpacing: -0.84 }}>{FC.fmt.metrica(m.valor, m.unidade)}</Num>
              <T style={{ fontSize: 12, color: t.cores.ink3 }}>hoje</T>
              {m.valor_alt ? <T style={{ fontSize: 12, color: t.cores.ink2, marginTop: 2 }}>{FC.fmt.num(m.valor_alt.valor)}% {m.valor_alt.rotulo}</T> : null}
              {m.sinal_ruim ? <T style={{ fontSize: 12, color: t.cores.vermelho, marginTop: 2 }}>negativo — reprovado</T> : null}
            </View>
            {m.serie && m.serie.length > 4 ? (
              <View>
                <Grafico marcador={FC.graficos.sparkline(m.serie)} />
                <T style={{ fontSize: 11, color: t.cores.ink3 }}>3 anos{m.chave === "pvp" ? " · aproximado" : ""}</T>
              </View>
            ) : null}
            {m.nota != null ? (
              <View style={{ marginLeft: "auto", alignItems: "flex-end" }}>
                <Num style={{ fontSize: 24, fontWeight: "600" }}>{Math.round(m.nota)}</Num>
                <T style={{ fontSize: 11, color: t.cores.ink3 }}>nota</T>
              </View>
            ) : null}
          </View>
          <Grafico marcador={FC.graficos.regua(m)} />
          <View style={{ gap: 2, marginTop: 10 }}>
            {m.lentes.map((L: any, k: number) => <Lente key={k} L={L} />)}
          </View>
        </View>
      ))}
      <T v="p" style={{ marginTop: t.espaco.e4 }}>O score aplica mecanicamente os critérios das suas regras (Ajustes → Regras). Não é recomendação de compra ou venda.</T>
    </View>
  );
}

function Lente({ L }: { L: any }) {
  const t = useTema();
  const calada = L.nota == null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6, opacity: calada ? 0.5 : 1, flexWrap: "wrap" }}>
      <View style={{ width: 14, paddingTop: 4 }}><Ponto cor={L.cor} /></View>
      <T style={{ width: 92, fontWeight: "600", fontSize: 13 }}>{L.titulo}</T>
      <T style={{ flex: 1, minWidth: 140, fontSize: 13, color: t.cores.ink2 }}>{L.texto}</T>
      <Num style={{ width: 36, textAlign: "right", fontWeight: "600", fontSize: 13 }}>{L.nota != null ? Math.round(L.nota) : ""}</Num>
    </View>
  );
}

export function abreAtivo(ticker: string) {
  const a = acharAtivo(ticker);
  if (!a) return;
  ui.folha({
    titulo: a.ticker, larga: true,
    corpo: () => <DetalheAtivo a={acharAtivo(ticker) || a} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={() => { api.fechar(); setTimeout(() => abreComparar([a.ticker], a.classe), 240); }}>Comparar</Botao>
        <Botao variante="sec" icone="editar" onPress={() => { api.fechar(); setTimeout(() => formAtivo(a.item), 240); }}>Editar</Botao>
        <Botao onPress={() => { api.fechar(); router.push(`/aportes/${a.ticker}` as any); }}>Registrar aporte</Botao>
      </>
    ),
  });
}

/** tocar e segurar um ativo: os atalhos do rodapé do detalhe, sem abrir o detalhe */
export function acoesRapidasAtivo(ticker: string) {
  const a = acharAtivo(ticker);
  if (!a) return;
  const vai = (api: { fechar: () => void }, fn: () => void) => { api.fechar(); setTimeout(fn, 240); };
  ui.folha({
    titulo: a.ticker,
    corpo: (api) => (
      <Lista>
        <Item chevron titulo="Registrar aporte" onPress={() => { api.fechar(); router.push(`/aportes/${a.ticker}` as any); }} />
        <Item chevron titulo="Ver detalhes" onPress={() => vai(api, () => abreAtivo(a.ticker))} />
        <Item chevron titulo="Comparar" onPress={() => vai(api, () => abreComparar([a.ticker], a.classe))} />
        <Item chevron titulo="Editar" onPress={() => vai(api, () => formAtivo(a.item))} />
      </Lista>
    ),
  });
}

/** busca o histórico e a cotação de um código fora da lista e avalia (lança erro se não achar) */
export async function avaliaCodigo(ticker: string, classe: string) {
  const anos = FC.estado.prefs.regras.janela_historico_anos || 3;
  const [h, spot] = await Promise.all([
    FC.mercado.historicos([{ ticker, classe }], anos),
    FC.mercado.cotacoes([{ ticker, classe }]).catch(() => ({})),
  ]);
  const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
  if (h[ticker] && h[ticker].erro && !(u.acoes[ticker] || u.fiis[ticker])) {
    throw new Error(`Não achei ${ticker} (${FC.CLASSES[classe] || classe}). Confira o código ou escolha o tipo certo.`);
  }
  const a = FC.avaliador.avalia(ticker, classe, u, h, FC.estado.prefs.regras, spot[ticker]);
  if (a.erro) throw new Error(a.erro);
  const s = spot[ticker];
  if (s && ok(s.preco)) { a.preco = s.preco; a.variacao_dia = s.variacao_dia; a.fonte_preco = s.fonte; a.preco_quando = s.quando; }
  a.pilar = ({ fii: "real_estate", acao_br: "acoes", acao_us: "acoes" } as any)[classe] || "alternativos";
  a.classe = a.classe || classe;
  return a;
}

export async function analisaAvulso(ticker: string, classe: string) {
  let a: any;
  try { a = await avaliaCodigo(ticker, classe); } catch (e) { ui.erro(e); return; }
  ui.folha({
    titulo: `${a.ticker} · análise`, larga: true, corpo: <DetalheAtivo a={a} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={() => { api.fechar(); setTimeout(() => abreComparar([a.ticker], classe), 240); }}>Comparar</Botao>
        {(["watchlist", "carteira"] as const).map((lista) => (
          <Botao key={lista} variante={lista === "watchlist" ? "sec" : "primario"}
            onPress={() => { api.fechar(); setTimeout(() => formAtivo({ ticker: a.ticker, classe, pilar: a.pilar, lista, quantidade: 0, _novo: true }), 240); }}>
            {lista === "watchlist" ? "Acompanhar" : "Adicionar à carteira"}
          </Botao>
        ))}
      </>
    ),
  });
}

export { KpiValor };
