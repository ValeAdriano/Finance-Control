/* Projeções: a aritmética das premissas, em moeda de hoje — port de
 * telas/projecoes.js. Mexer num campo recalcula na hora; "Salvar como
 * padrão" grava no Supabase. */
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { B, Botao, Cabecalho, Cartao, Composicao, Grade, Item, Kpi, Kpis, Legenda, Lista, Mensagem, Ponto, Rs, Secao, T, Tabela } from "../ui/kit";
import { Campo, Entrada, Interruptor, Seletor } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { ui } from "../ui/folha";
import { depoisDeMudar } from "./comum/dados";
import FC from "../nucleo";

const ok = (v: any) => FC.ok(v);
let rascunho: any = null;
const txt = (v: any) => (v == null || v === "" ? "" : String(v).replace(".", ","));
const anoDe = (anos: number) => new Date().getFullYear() + Math.round(anos);
const pct0 = (v: number) => FC.fmt.num(v, 0) + "%";

// média do que entrou nos últimos 12 meses fechados (desde o primeiro aporte)
function aporteObservado(base: any) {
  if (!base || !base.aportes) return null;
  const mesAtual = FC.datas.hoje().slice(0, 7);
  const datas = base.aportes.map((a: any) => a.data).filter(Boolean).sort();
  if (!datas.length) return null;
  const primeiro = datas[0].slice(0, 7);
  const meses = FC.salario.mesesAte(mesAtual, 13).slice(0, 12).filter((m: string) => m >= primeiro);
  if (meses.length < 3) return null;
  return { media: FC.soma(meses, (m: string) => FC.salario.investidoNoMes(base, m)) / meses.length, meses: meses.length };
}

function Independencia({ p }: { p: any }) {
  const t = useTema();
  const ind = p.independencia;
  const anos = p.premissas.horizonte_anos;
  if (!ind) {
    return (
      <Mensagem tipo="info" icone="alvo" style={{ marginTop: t.espaco.e4 }}>
        <T style={{ fontSize: 14 }}>Informe a <B>renda mensal</B> que você quer ter da carteira (ou o custo de vida em <Text style={{ color: t.cores.acento }} onPress={() => router.push("/salario" as any)}>Salário</Text>) para ver a chance de chegar à independência financeira.</T>
      </Mensagem>
    );
  }
  const brl0 = (v: number) => FC.fmt.brlTexto(v, 0);
  const chance = ind.chance_no_horizonte;
  const cls = chance >= 80 ? "pos" : chance < 50 ? "neg" : null;
  return (
    <Secao titulo="Independência financeira" sub={`viver de ${brl0(ind.renda_alvo)} por mês sacando ${FC.fmt.num(ind.taxa_saque, 1)}% ao ano pede ${brl0(ind.patrimonio_alvo)} investidos`}>
      <Cartao>
        <Kpis>
          <Kpi rotulo={`Chance em ${anos} anos`} valor={ind.ja_atingido ? "já chegou" : pct0(chance)} cls={ind.ja_atingido ? "pos" : cls}
            peq={`dos ${FC.fmt.int(p.mc.caminhos)} caminhos simulados, quantos terminam acima do alvo`} />
          <Kpi rotulo="Quando, na mediana" valor={ind.ja_atingido ? "hoje" : ind.ano_mediano != null ? String(anoDe(ind.ano_mediano)) : `depois de ${anoDe(anos)}`}
            peq={ind.ano_p10 != null ? `num cenário ruim (P10): ${anoDe(ind.ano_p10)}` : "metade dos caminhos chega antes disso"} />
          <Kpi rotulo="Aporte para 80% de chance" valor={ind.aporte_para_80 != null ? brl0(ind.aporte_para_80) : chance >= 80 || ind.ja_atingido ? "o atual basta" : "—"} dinheiro={ind.aporte_para_80 != null}
            peq={ind.aporte_para_80 != null ? `por mês, no lugar de ${brl0(p.base.aportado / (anos * 12))} de média` : "com as premissas de hoje"} />
        </Kpis>
        <T v="p" style={{ marginTop: t.espaco.e4 }}>A taxa de saque de <B>{FC.fmt.num(ind.taxa_saque, 1)}%</B> é a parte do patrimônio que dá para tirar por ano, corrigindo pela inflação, sem esgotar o dinheiro. A regra dos 4% vem de dados americanos (Bengen, Trinity). No Brasil, estudos com carteira majoritária em renda fixa chegam a 5%, e simulações mais duras ficam abaixo de 4%. Para viver de renda por 40 anos ou mais, 3% a 3,5% é a margem prudente. {ind.renda_alvo_origem === "objetivos" ? "A renda-alvo vem dos seus objetivos." : ""}</T>
      </Cartao>
    </Secao>
  );
}

function Resultado({ p }: { p: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const b = p.base, mc = p.mc, f = mc.faixas;
  const colocou = b.inicial + b.aportado;
  const brl0 = (v: number) => FC.fmt.brlTexto(v, 0);
  const zero = (s: any[]) => [[0, b.inicial], ...s];
  const ind = p.independencia;
  return (
    <View>
      {p.alerta_caixa ? (
        <Mensagem tipo="alerta" icone="alerta" style={{ marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 14 }}><B>A premissa macro está conduzindo a projeção.</B> Mesmo com o juro convergindo para {FC.fmt.num(p.macro_lp.juro_real)}% real, o caixa rende {FC.fmt.num(p.caixa_real_lp)}% real ao ano no longo prazo, mais que a renda variável nas suas premissas. Isso empurra tudo para a renda fixa. Revise as premissas de valorização ou o cenário macro de longo prazo.</T>
        </Mensagem>
      ) : null}
      <Independencia p={p} />
      <Secao titulo="Patrimônio projetado" sub={`a linha é a mediana; a faixa escura junta metade dos ${FC.fmt.int(mc.caminhos)} caminhos simulados, a clara 80% deles`}>
        <Cartao>
          <Kpis style={{ marginBottom: 24 }}>
            <Kpi rotulo="Hoje" valor={brl0(b.inicial)} dinheiro />
            <Kpi rotulo={`Em ${p.premissas.horizonte_anos} anos, na mediana`} valor={brl0(mc.p50.final)} dinheiro peq={<Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`entre ${brl0(mc.p10.final)} e ${brl0(mc.p90.final)}`}</Rs>} />
            <Kpi rotulo="Depois do IR" valor={brl0(mc.p50.final_liquido)} dinheiro peq="se resgatasse tudo no fim" />
            <Kpi rotulo="Multiplicador" valor={colocou ? FC.fmt.num(mc.p50.final / colocou, 1) + "×" : "—"} peq="sobre o que você tem hoje + os aportes" />
          </Kpis>
          <Grafico marcador={FC.graficos.linhas({
            series: [{ nome: "Mediana", pontos: zero(f.p50), classe: "l1" }, { nome: "Cenário ruim (P10)", pontos: zero(f.p10), classe: "lref2" }, { nome: "Cenário bom (P90)", pontos: zero(f.p90), classe: "lref2" }],
            banda: [{ inf: zero(f.p10), sup: zero(f.p90) }, { inf: zero(f.p25), sup: zero(f.p75), classe: "banda2" }],
            alvo: ind && !ind.ja_atingido ? { valor: ind.patrimonio_alvo, rotulo: "independência" } : null, x: "anos", altura: 300 })} />
          <Legenda itens={[{ cor: t.cores.s1, rotulo: "mediana" }, { cor: t.cores.s1, rotulo: "50% e 80% dos caminhos", tipo: "banda" }, ...(ind && !ind.ja_atingido ? [{ cor: t.cores.verde, rotulo: "patrimônio para a independência" }] : [])]} />
        </Cartao>
      </Secao>
      <Secao titulo="Cenários" sub={`em ${p.premissas.horizonte_anos} anos, em moeda de hoje`}>
        <Cartao semPad>
          <Tabela minimo={estreito ? 460 : 760} cabecas={[{ t: "Cenário", largura: 150 }, { t: "Patrimônio", n: true, largura: 140 }, { t: "Depois do IR", n: true, largura: 140 }, { t: "Proventos/mês", n: true, largura: 130 }, ...(estreito ? [] : [{ t: "Leitura", largura: 260 }])]}
            linhas={([["Ruim (P10)", mc.p10, "neg", "9 em cada 10 caminhos terminam acima"], ["Mediana (P50)", mc.p50, null, "metade acima, metade abaixo"], ["Bom (P90)", mc.p90, "pos", "só 1 em cada 10 termina acima"]] as Array<[string, any, string | null, string]>).map(([nome, c, cls, leitura]) => [
              { v: <B>{nome}</B> }, { v: brl0(c.final), dinheiro: true, cls, peso: "600" }, { v: brl0(c.final_liquido), dinheiro: true }, { v: FC.fmt.brlTexto(c.renda_mensal_final), dinheiro: true },
              ...(estreito ? [] : [{ v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{leitura}</T> }]),
            ])} />
        </Cartao>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Cada caminho sorteia, mês a mês, o retorno de cada pilar em torno da sua premissa, com a <B>volatilidade</B> da tabela abaixo e a correlação entre eles (ações e FIIs andam mais juntos que ações e cripto). A renda fixa segue o contratado até o vencimento e depois o CDI, que sai de {FC.fmt.num(p.macro_lp.cdi_hoje)}% hoje e chega a {FC.fmt.num(p.macro_lp.cdi)}% em {p.macro_lp.meses} meses (juro real de {FC.fmt.num(p.macro_lp.juro_real_hoje)}% para {FC.fmt.num(p.macro_lp.juro_real)}%). O IR é o que se pagaria resgatando tudo no fim: 15% sobre o ganho em ações, ETFs, cripto e renda fixa tributável, 20% em FIIs. Não é previsão: é a distribuição do que as premissas permitem.</T>
      </Secao>
      <Secao>
        <Grade colunas={2}>
          <Cartao>
            <T v="h3">Renda de proventos</T>
            <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>quanto a carteira deposita por mês, pelo DY que os seus ativos pagaram nos últimos 12 meses</T>
            <Kpis style={{ marginBottom: t.espaco.e3 }}>
              <Kpi pequeno rotulo="Hoje" valor={FC.fmt.brlTexto(b.renda_mensal_hoje)} dinheiro peq="por mês" />
              <Kpi pequeno rotulo={`Em ${p.premissas.horizonte_anos} anos`} valor={FC.fmt.brlTexto(mc.p50.renda_mensal_final)} dinheiro
                peq={<>por mês, na mediana · entre <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{brl0(mc.p10.renda_mensal_final)}</Rs> e <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{brl0(mc.p90.renda_mensal_final)}</Rs></>} />
            </Kpis>
            <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Provento mensal", pontos: b.renda, classe: "l2", area: false }], x: "anos", altura: 200 })} />
          </Cartao>
          <Cartao>
            <T v="h3">De onde vem o patrimônio</T>
            <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>no caminho sem sorte nem azar: só a valorização depende de premissa</T>
            <Composicao partes={[{ valor: b.inicial, cor: t.cores.sref }, { valor: b.aportado, cor: t.cores.s1 }, { valor: p.premissas.reinvestir_proventos ? b.proventos : 0, cor: t.cores.s2 }, { valor: Math.max(0, b.valorizacao), cor: t.cores.s3 }]} />
            <Kpis style={{ marginTop: t.espaco.e4 }}>
              {([["Hoje", t.cores.sref, b.inicial], ["Aportes", t.cores.s1, b.aportado], ["Proventos", t.cores.s2, b.proventos], ["Valorização", t.cores.s3, b.valorizacao]] as Array<[string, string, number]>).map(([nome, cor, v]) => (
                <Kpi key={nome} pequeno rotulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Ponto cor={cor} /><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{nome}</Text></View>}
                  valor={brl0(v)} dinheiro peq={nome === "Proventos" && !p.premissas.reinvestir_proventos ? "sacados, fora do total" : undefined} />
              ))}
            </Kpis>
          </Cartao>
        </Grade>
      </Secao>
      <Secao titulo="Premissas por pilar" sub="o retorno total é o número que você precisa achar plausível; o seu histórico ajuda a calibrar">
        <Cartao semPad>
          <Tabela minimo={estreito ? 640 : 980} cabecas={[{ t: "Pilar", largura: 140 }, { t: "Valor hoje", n: true }, { t: "Proventos", n: true }, { t: "Valorização real", n: true, largura: 130 }, { t: "Retorno total real", n: true, largura: 140 }, { t: "Volatilidade", n: true, largura: 110 }, { t: "Seu histórico real", n: true, largura: 140 }, ...(estreito ? [] : [{ t: "Origem do risco", largura: 230 }])]}
            linhas={p.pilares.map((l: any) => [{ v: <B>{l.nome}</B> }, { v: brl0(l.valor), dinheiro: true }, ok(l.dy) ? FC.fmt.num(l.dy) + "%" : "—",
              ok(l.valorizacao) ? FC.fmt.num(l.valorizacao) + "%" : "—",
              { v: l.chave === "caixa" ? `${FC.fmt.num(l.total)}% → ${FC.fmt.num(l.total_lp)}%` : FC.fmt.num(l.total) + "%", peso: "600" },
              ok(l.volatilidade) ? FC.fmt.num(l.volatilidade, 0) + "%" : "—",
              ok(l.historico_real) ? { v: FC.fmt.num(l.historico_real) + "%", cls: l.historico_real >= 0 ? "pos" : "neg" } : "—",
              ...(estreito ? [] : [{ v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{l.chave === "caixa" ? "taxa contratada de cada título; CDI depois do vencimento" : l.vol_origem}</T> }])])} />
        </Cartao>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Quando o pilar tem pouca série, a volatilidade mistura a dos seus ativos com uma referência de mercado (carteira de ações ~25% ao ano, FIIs ~12%, cripto ~60%, rebanho ~15%; o Ibovespa teve ~31% em 2000–2024). O histórico real é a TIR do que você já investiu, descontado o IPCA de 12 meses: um bom termômetro, mas poucos anos de bolsa dizem pouco sobre os próximos vinte.</T>
      </Secao>
      {p.titulos_caixa.length ? (
        <Secao titulo="Renda fixa contratada" sub="a parte que não depende de premissa de mercado, até vencer">
          <Lista>
            {p.titulos_caixa.map((tt: any, i: number) => (
              <Item key={i} titulo={tt.nome} detalhe={`${tt.posfixado ? "pós-fixado, segue o CDI" : `nominal ${FC.fmt.num(tt.nominal)}% a.a.`}${tt.vencimento ? ` · vence em ${FC.datas.br(tt.vencimento)}` : ""}${tt.isento ? " · isento de IR" : ""}`}
                valores={<View style={{ alignItems: "flex-end" }}><B style={{ fontSize: 15 }}>{FC.fmt.num(tt.real)}% real</B><Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{brl0(tt.valor)}</Rs></View>} />
            ))}
          </Lista>
        </Secao>
      ) : null}
    </View>
  );
}

export default function Projecoes() {
  const t = useTema();
  const e = useEstado();
  const prefs = e.prefs, d = e.dados;
  const pp2 = prefs && e.base ? FC.salario.paraProjecao(prefs.plano, e.base.ganhos || [], e.base) : null;
  const temPlano = !!(pp2 && pp2.aporte_mensal > 0);
  const premInicial = () => {
    const prem = { ...(rascunho || prefs.premissas) };
    if (prem.usar_plano == null) prem.usar_plano = temPlano;
    if (!rascunho && !prefs.premissas_salvas) prem.reinvestir_proventos = prefs.plano.reinvestir_dividendos !== false;
    return prem;
  };
  const [prem, setPrem] = useState<any>(() => (prefs ? premInicial() : null));
  const [campos, setCampos] = useState<Record<string, string>>(() => {
    if (!prefs) return {};
    const p = premInicial();
    return {
      aporte_mensal: txt(p.aporte_mensal), horizonte_anos: txt(p.horizonte_anos),
      crescimento_aporte_real: txt(p.crescimento_aporte_real),
      ...Object.fromEntries(FC.PILARES.filter((x: any) => x.chave !== "caixa").map((x: any) => ["val_" + x.chave, txt((p.valorizacao_real_anual || {})[x.chave] ?? 0)])),
      ...Object.fromEntries(FC.PILARES.filter((x: any) => x.chave !== "caixa").map((x: any) => ["vol_" + x.chave, txt((p.volatilidade || {})[x.chave])])),
      cdi_lp: txt(p.macro_longo_prazo.cdi), ipca_lp: txt(p.macro_longo_prazo.ipca), meses_convergencia: txt(p.meses_convergencia),
      renda_alvo: txt(p.renda_alvo), taxa_saque: txt(p.taxa_saque),
    };
  });
  const [simulado, setSimulado] = useState(!!rascunho);
  // os números se recalculam 350 ms depois de parar de digitar
  const [premCalc, setPremCalc] = useState<any>(prem);
  const montaPrem = (base: any, c: Record<string, string>, extra: any) => {
    const n = (k: string) => FC.lerNum(c[k]);
    return FC.mescla(base, {
      usar_plano: extra.usar_plano, aporte_mensal: n("aporte_mensal") ?? base.aporte_mensal,
      horizonte_anos: Math.max(1, Math.min(60, Math.round(n("horizonte_anos") || base.horizonte_anos))),
      crescimento_aporte_real: n("crescimento_aporte_real") ?? 0,
      distribuicao_aporte: extra.distribuicao_aporte, reinvestir_proventos: extra.reinvestir_proventos,
      valorizacao_real_anual: Object.fromEntries(FC.PILARES.filter((p: any) => p.chave !== "caixa").map((p: any) => [p.chave, n("val_" + p.chave) ?? (base.valorizacao_real_anual || {})[p.chave] ?? 0])),
      // vazio cai no padrão do modelo (volatilidade dos seus ativos, longo prazo do Focus, objetivos)
      volatilidade: Object.fromEntries(FC.PILARES.filter((p: any) => p.chave !== "caixa").map((p: any) => [p.chave, n("vol_" + p.chave)])),
      macro_longo_prazo: { cdi: n("cdi_lp"), ipca: n("ipca_lp") },
      meses_convergencia: n("meses_convergencia"), renda_alvo: n("renda_alvo"), taxa_saque: n("taxa_saque"),
    });
  };
  useEffect(() => {
    if (!prefs) return;
    const id = setTimeout(() => setPremCalc(prem), 350);
    return () => clearTimeout(id);
  }, [prem, prefs]);
  const objetivos = prefs ? FC.objetivos(prefs) : null;
  const proj = useMemo(() => (d && premCalc ? FC.projecao.projeta({ ...d, plano_projecao: pp2, objetivos }, premCalc) : null), [d, premCalc]); // eslint-disable-line react-hooks/exhaustive-deps
  const obs = useMemo(() => aporteObservado(e.base), [e.base]);
  if (!prefs || !d || !prem) return <Pagina>{null}</Pagina>;
  const usando = temPlano && prem.usar_plano;
  const m = d.macro || {};
  const lpPadrao = { cdi: ((1 + FC.projecao.LONGO_PRAZO.juro_real / 100) * (1 + FC.projecao.LONGO_PRAZO.ipca / 100) - 1) * 100 };
  const linhaPilar = (k: string) => (proj ? proj.pilares.find((l: any) => l.chave === k) : null);
  const volCalc = (k: string) => { const l = linhaPilar(k); return l && (campos["vol_" + k] ?? "") === "" ? l.volatilidade : l ? l.vol_observada : null; };
  const hist = (k: string) => { const l = linhaPilar(k); return l && ok(l.historico_real) ? `seu histórico: ${FC.fmt.num(l.historico_real)}% real (com proventos)` : undefined; };
  const muda = (c: Record<string, string>, extra: any = {}) => {
    const novo = montaPrem(prefs.premissas, c, { usar_plano: prem.usar_plano, distribuicao_aporte: prem.distribuicao_aporte, reinvestir_proventos: prem.reinvestir_proventos, ...extra });
    rascunho = novo; setCampos(c); setPrem(novo); setSimulado(true);
  };
  const campo = (id: string, rot: string, dica?: string, opcoes: { desabilitado?: boolean; placeholder?: string } = {}) => (
    <View key={id} style={{ flexBasis: 150, flexGrow: 1 }}>
      <Campo rotulo={rot} dica={dica}>
        <Entrada valor={opcoes.desabilitado && usando ? txt(Number(pp2.aporte_mensal.toFixed(2))) : campos[id] ?? ""} aoMudar={(v) => muda({ ...campos, [id]: v })}
          decimal editable={!opcoes.desabilitado} placeholder={opcoes.placeholder} accessibilityLabel={rot} style={opcoes.desabilitado ? { opacity: 0.5 } : undefined} />
      </Campo>
    </View>
  );
  const salvar = async () => {
    const p = montaPrem(prefs.premissas, campos, { usar_plano: prem.usar_plano, distribuicao_aporte: prem.distribuicao_aporte, reinvestir_proventos: prem.reinvestir_proventos });
    try { await FC.db.gravaPrefs({ premissas: p }); rascunho = null; setSimulado(false); await depoisDeMudar("Premissas salvas"); } catch (err) { ui.erro(err); }
  };
  const restaurar = async () => {
    // volta ao padrão sem apagar objetivos e dados dos títulos
    const p = e.base.prefsBrutas.premissas || {};
    const fica = p.objetivos || p.titulos ? { objetivos: p.objetivos, titulos: p.titulos } : null;
    try { await FC.db.gravaPrefs({ premissas: fica }); rascunho = null; setSimulado(false); await depoisDeMudar("Premissas padrão restauradas"); } catch (err) { ui.erro(err); }
  };
  const rot = (texto: string) => <T style={{ fontSize: 13, fontWeight: "500", color: t.cores.ink2, marginTop: t.espaco.e4, marginBottom: t.espaco.e3 }}>{texto}</T>;
  return (
    <Pagina>
      <Cabecalho titulo="Projeções" sub="Projeção não é previsão: é a aritmética das premissas, em moeda de hoje." />
      <Cartao>
        {temPlano ? (
          <View style={{ marginBottom: t.espaco.e3 }}>
            <Interruptor valor={usando} aoMudar={(v) => muda(campos, { usar_plano: v })} rotulo={
              <T style={{ fontSize: 15, flexShrink: 1 }}>Usar meu plano do <Text style={{ color: t.cores.acento }} onPress={() => router.push("/salario" as any)}>Salário</Text>: <Rs style={{ fontSize: 15, fontWeight: "600" }}>{FC.fmt.brlTexto(pp2.aporte_mensal)}</Rs> por mês, divididos como no plano</T>} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginBottom: t.espaco.e3 }}>
            <Icone nome="info" tam={14} cor={t.cores.ink2} />
            <T v="p">Monte um plano em <Text style={{ color: t.cores.acento }} onPress={() => router.push("/salario" as any)}>Salário</Text> para a projeção usar a sua renda e a divisão dos aportes.</T>
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {campo("aporte_mensal", "Aporte mensal (R$)", usando ? "vem do plano" : undefined, { desabilitado: usando })}
          {campo("horizonte_anos", "Horizonte (anos)")}
          {campo("crescimento_aporte_real", "Aporte cresce (% a.a.)", "acima da inflação", { placeholder: "0" })}
          <View style={{ flexBasis: 160, flexGrow: 1 }}>
            <Campo rotulo="Destino do aporte">
              {usando ? <Seletor valor="plano" aoMudar={() => {}} opcoes={[{ v: "plano", rotulo: "Conforme o plano" }]} rotuloA11y="Destino do aporte" />
                : <Seletor valor={prem.distribuicao_aporte} aoMudar={(v) => muda(campos, { distribuicao_aporte: v })} rotuloA11y="Destino do aporte"
                    opcoes={[{ v: "rebalancear", rotulo: "Pilar mais defasado" }, { v: "proporcional", rotulo: "Proporcional à meta" }]} />}
            </Campo>
          </View>
          <View style={{ flexBasis: 160, flexGrow: 1, justifyContent: "flex-end" }}>
            <Interruptor valor={!!prem.reinvestir_proventos} aoMudar={(v) => muda(campos, { reinvestir_proventos: v })} rotulo="Reinvestir dividendos" />
          </View>
        </View>
        {obs && !usando && Math.abs(obs.media - (Number(prem.aporte_mensal) || 0)) > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: t.espaco.e3 }}>
            <Icone nome="info" tam={14} cor={t.cores.ink2} />
            <T style={{ fontSize: 13, color: t.cores.ink2, flexShrink: 1 }}>Nos últimos {obs.meses} meses você aportou em média <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(obs.media, 0)}</Rs> por mês.</T>
            <Botao variante="texto" pequeno onPress={() => muda({ ...campos, aporte_mensal: txt(Math.round(obs.media)) })}>Usar esse valor</Botao>
          </View>
        ) : null}
        {rot("Valorização real ao ano, sem contar proventos (%) — é a mediana de cada pilar")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {FC.pilaresLigados().filter((p: any) => p.chave !== "caixa").map((p: any) => campo("val_" + p.chave, p.nome, hist(p.chave)))}
        </View>
        {rot("Volatilidade ao ano (%) — em branco usa a dos seus ativos misturada à de mercado")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {FC.pilaresLigados().filter((p: any) => p.chave !== "caixa").map((p: any) => {
            const v = volCalc(p.chave);
            return campo("vol_" + p.chave, p.nome, v != null ? `calculada: ${FC.fmt.num(v, 0)}%` : undefined, { placeholder: v != null ? FC.fmt.num(v, 0) : "" });
          })}
        </View>
        {rot(`Juro de longo prazo — em branco, o CDI e o IPCA de hoje convergem para ${FC.fmt.num(lpPadrao.cdi, 1)}% e ${FC.fmt.num(FC.projecao.LONGO_PRAZO.ipca, 1)}% (juro real de ${FC.fmt.num(FC.projecao.LONGO_PRAZO.juro_real, 1)}%, na linha do Focus)`)}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {campo("cdi_lp", "CDI de longo prazo (% a.a.)", `hoje ${ok(m.cdi) ? FC.fmt.num(m.cdi) : "—"}%`, { placeholder: FC.fmt.num(lpPadrao.cdi, 1) })}
          {campo("ipca_lp", "IPCA de longo prazo (% a.a.)", `hoje ${ok(m.ipca_12m) ? FC.fmt.num(m.ipca_12m) : "—"}%`, { placeholder: FC.fmt.num(FC.projecao.LONGO_PRAZO.ipca, 1) })}
          {campo("meses_convergencia", "Chega lá em (meses)", undefined, { placeholder: String(FC.projecao.LONGO_PRAZO.meses) })}
        </View>
        {rot("Independência financeira")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {campo("renda_alvo", "Renda mensal desejada (R$)", objetivos && objetivos.renda_desejada_mensal ? "vazio: a dos seus objetivos" : "ex.: o seu custo de vida", { placeholder: objetivos && objetivos.renda_desejada_mensal ? FC.fmt.num(objetivos.renda_desejada_mensal, 0) : "" })}
          {campo("taxa_saque", "Taxa de saque (% a.a.)", "3,5% a 5% no Brasil", { placeholder: FC.fmt.num(FC.projecao.TAXA_SAQUE, 1) })}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: t.espaco.e3, marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 13, color: t.cores.ink2, flexShrink: 1 }}>{simulado ? "Simulação não salva — os números usam os valores acima." : prefs.premissas_salvas ? "Usando as premissas que você salvou." : "Usando as premissas padrão."}</T>
          <View style={{ flexDirection: "row", gap: t.espaco.e3 }}>
            {prefs.premissas_salvas ? <Botao variante="texto" onPress={restaurar}>Voltar ao padrão</Botao> : null}
            <Botao onPress={salvar}>Salvar como padrão</Botao>
          </View>
        </View>
      </Cartao>
      {proj ? <Resultado p={proj} /> : null}
    </Pagina>
  );
}
