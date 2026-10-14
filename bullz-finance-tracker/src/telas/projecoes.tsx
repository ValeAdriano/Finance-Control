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
const sinal = (v: number, suf: string) => (v > 0 ? "+" : v < 0 ? "−" : "") + FC.fmt.num(Math.abs(v), Number.isInteger(v) ? 0 : 1) + suf;
const pp = (v: number) => sinal(v, " p.p.");
const explicaCenario = (d: any) => `valorização real ${pp(d.valorizacao)} ao ano por pilar de renda variável, CDI real ${pp(d.juro_real)} nos pós-fixados, proventos ${sinal(d.dy, "%")}`;
const txt = (v: any) => (v == null || v === "" ? "" : String(v).replace(".", ","));

function Resultado({ p }: { p: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const b = p.base;
  const colocou = b.inicial + b.aportado;
  const C = FC.projecao.CENARIOS;
  const brl0 = (v: number) => FC.fmt.brlTexto(v, 0);
  return (
    <View>
      {p.alerta_caixa ? (
        <Mensagem tipo="alerta" icone="alerta" style={{ marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 14 }}><B>A premissa macro está conduzindo a projeção.</B> Com CDI de {FC.fmt.num(p.macro_lp.cdi)}% e IPCA de {FC.fmt.num(p.macro_lp.ipca)}%, o caixa rende {FC.fmt.num(p.caixa_real)}% real ao ano — mais que a renda variável nas suas premissas. Projetar juro real de {FC.fmt.num(p.macro_lp.juro_real)}% por {p.premissas.horizonte_anos} anos empurra tudo para a renda fixa. Teste um cenário de longo prazo nos campos de CDI e IPCA.</T>
        </Mensagem>
      ) : null}
      <Secao titulo="Patrimônio projetado" sub="linha cheia é o cenário base; a faixa vai do pessimista ao otimista">
        <Cartao>
          <Kpis style={{ marginBottom: 24 }}>
            <Kpi rotulo="Hoje" valor={brl0(b.inicial)} dinheiro />
            <Kpi rotulo={`Em ${p.premissas.horizonte_anos} anos`} valor={brl0(b.final)} dinheiro peq={<Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`entre ${brl0(p.pessimista.final)} e ${brl0(p.otimista.final)}`}</Rs>} />
            <Kpi rotulo="Você coloca" valor={brl0(colocou)} dinheiro peq="o que tem hoje + os aportes" />
            <Kpi rotulo="Multiplicador" valor={colocou ? FC.fmt.num(b.final / colocou, 1) + "×" : "—"} peq="sobre o dinheiro que você colocou" />
          </Kpis>
          <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Cenário base", pontos: [[0, b.inicial], ...b.patrimonio], classe: "l1" },
            { nome: "Pessimista", pontos: [[0, b.inicial], ...p.pessimista.patrimonio], classe: "lref2" },
            { nome: "Otimista", pontos: [[0, b.inicial], ...p.otimista.patrimonio], classe: "lref2" }],
            banda: { inf: [[0, b.inicial], ...p.pessimista.patrimonio], sup: [[0, b.inicial], ...p.otimista.patrimonio] }, x: "anos", altura: 300 })} />
          <Legenda itens={[{ cor: t.cores.s1, rotulo: "cenário base" }, { cor: t.cores.s1, rotulo: "entre pessimista e otimista", tipo: "banda" }]} />
        </Cartao>
      </Secao>
      <Secao titulo="Três cenários" sub={`em ${p.premissas.horizonte_anos} anos, em moeda de hoje`}>
        <Cartao semPad>
          <Tabela minimo={estreito ? 420 : 760} cabecas={[{ t: "Cenário", largura: 120 }, { t: "Patrimônio final", n: true, largura: 150 }, { t: "Renda mensal", n: true, largura: 140 }, ...(estreito ? [] : [{ t: "O que muda", largura: 360 }])]}
            linhas={([["Pessimista", p.pessimista, "neg"], ["Base", p.base, null], ["Otimista", p.otimista, "pos"]] as Array<[string, any, string | null]>).map(([nome, c, cls]) => [
              { v: <B>{nome}</B> }, { v: brl0(c.final), dinheiro: true, cls, peso: "600" }, { v: FC.fmt.brlTexto(c.renda_mensal_final), dinheiro: true, leg: "por mês" },
              ...(estreito ? [] : [{ v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{nome === "Base" ? "as suas premissas, como estão acima" : explicaCenario(c.deltas)}</T> }]),
            ])} />
        </Cartao>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>O <B>base</B> é a aritmética das suas premissas. O <B>pessimista</B> e o <B>otimista</B> mexem nas três alavancas que mais pesam: a valorização real da renda variável (o campo “Pessimista/Otimista” acima; em branco vale {pp(C.pessimista.valorizacao)} e {pp(C.otimista.valorizacao)}), o juro real do CDI nos títulos pós-fixados ({pp(C.pessimista.juro_real)} e {pp(C.otimista.juro_real)}) e os proventos ({sinal(C.pessimista.dy, "%")} e {sinal(C.otimista.dy, "%")} sobre o DY observado). Prefixados e IPCA+ seguem a taxa contratada nos três. Não são probabilidades: são o mesmo plano com o mundo um pouco pior ou um pouco melhor.</T>
      </Secao>
      <Secao>
        <Grade colunas={2}>
          <Cartao>
            <T v="h3">Renda de proventos</T>
            <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>quanto a carteira deposita por mês, pelo DY que os seus ativos pagaram nos últimos 12 meses</T>
            <Kpis style={{ marginBottom: t.espaco.e3 }}>
              <Kpi pequeno rotulo="Hoje" valor={FC.fmt.brlTexto(b.renda_mensal_hoje)} dinheiro peq="por mês" />
              <Kpi pequeno rotulo={`Em ${p.premissas.horizonte_anos} anos`} valor={FC.fmt.brlTexto(b.renda_mensal_final)} dinheiro
                peq={<>por mês, em poder de compra de hoje · entre <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{brl0(p.pessimista.renda_mensal_final)}</Rs> e <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{brl0(p.otimista.renda_mensal_final)}</Rs></>} />
            </Kpis>
            <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Provento mensal", pontos: b.renda, classe: "l2", area: false }],
              banda: b.renda.length ? { inf: p.pessimista.renda, sup: p.otimista.renda } : null, x: "anos", altura: 200 })} />
          </Cartao>
          <Cartao>
            <T v="h3">De onde vem o patrimônio</T>
            <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: t.espaco.e3 }}>só a valorização depende de premissa; aportes são decisão sua e proventos vêm de dado observado</T>
            <Composicao partes={[{ valor: b.inicial, cor: t.cores.sref }, { valor: b.aportado, cor: t.cores.s1 }, { valor: p.premissas.reinvestir_proventos ? b.proventos : 0, cor: t.cores.s2 }, { valor: b.valorizacao, cor: t.cores.s3 }]} />
            <Kpis style={{ marginTop: t.espaco.e4 }}>
              {([["Hoje", t.cores.sref, b.inicial], ["Aportes", t.cores.s1, b.aportado], ["Proventos", t.cores.s2, b.proventos], ["Valorização", t.cores.s3, b.valorizacao]] as Array<[string, string, number]>).map(([nome, cor, v]) => (
                <Kpi key={nome} pequeno rotulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Ponto cor={cor} /><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{nome}</Text></View>}
                  valor={brl0(v)} dinheiro peq={nome === "Proventos" && !p.premissas.reinvestir_proventos ? "sacados, fora do total" : undefined} />
              ))}
            </Kpis>
          </Cartao>
        </Grade>
      </Secao>
      <Secao titulo="Premissas por pilar" sub="o retorno total é o número que você precisa achar plausível">
        <Cartao semPad>
          <Tabela minimo={estreito ? 520 : 820} cabecas={[{ t: "Pilar", largura: 150 }, { t: "Valor hoje", n: true }, { t: "Proventos", n: true }, { t: "Valorização real", n: true, largura: 140 }, { t: "Retorno total real", n: true, largura: 150 }, ...(estreito ? [] : [{ t: "Origem", largura: 260 }])]}
            linhas={p.pilares.map((l: any) => [{ v: <B>{l.nome}</B> }, { v: brl0(l.valor), dinheiro: true }, ok(l.dy) ? FC.fmt.num(l.dy) + "%" : "—",
              ok(l.valorizacao) ? FC.fmt.num(l.valorizacao) + "%" : "—", { v: FC.fmt.num(l.total) + "%", peso: "600" },
              ...(estreito ? [] : [{ v: <T style={{ fontSize: 13, color: t.cores.ink2 }}>{l.chave === "caixa" ? "taxa contratada de cada título" : l.chave === "agro" ? "sua premissa de valorização do rebanho" : "DY observado + sua premissa"}</T> }])])} />
        </Cartao>
      </Secao>
      {p.titulos_caixa.length ? (
        <Secao titulo="Renda fixa contratada" sub="a parte que não depende de premissa de mercado">
          <Lista>
            {p.titulos_caixa.map((tt: any, i: number) => (
              <Item key={i} titulo={tt.nome} detalhe={`nominal ${FC.fmt.num(tt.nominal)}% a.a.`}
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
      ...Object.fromEntries(FC.PILARES.filter((x: any) => x.chave !== "caixa").map((x: any) => ["val_" + x.chave, txt((p.valorizacao_real_anual || {})[x.chave] ?? 0)])),
      cen_pessimista: txt((p.cenarios || {}).pessimista), cen_otimista: txt((p.cenarios || {}).otimista),
      cdi_lp: txt(p.macro_longo_prazo.cdi), ipca_lp: txt(p.macro_longo_prazo.ipca),
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
      distribuicao_aporte: extra.distribuicao_aporte, reinvestir_proventos: extra.reinvestir_proventos,
      valorizacao_real_anual: Object.fromEntries(FC.PILARES.filter((p: any) => p.chave !== "caixa").map((p: any) => [p.chave, n("val_" + p.chave) ?? (base.valorizacao_real_anual || {})[p.chave] ?? 0])),
      // vazio cai no padrão do modelo (FC.projecao.CENARIOS)
      cenarios: { pessimista: n("cen_pessimista"), otimista: n("cen_otimista") },
      macro_longo_prazo: { cdi: n("cdi_lp"), ipca: n("ipca_lp") },
    });
  };
  useEffect(() => {
    if (!prefs) return;
    const id = setTimeout(() => setPremCalc(prem), 350);
    return () => clearTimeout(id);
  }, [prem, prefs]);
  const proj = useMemo(() => (d && premCalc ? FC.projecao.projeta({ ...d, plano_projecao: pp2 }, premCalc) : null), [d, premCalc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!prefs || !d || !prem) return <Pagina>{null}</Pagina>;
  const usando = temPlano && prem.usar_plano;
  const m = d.macro || {};
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
        {rot("Valorização real ao ano, sem contar proventos (%)")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {FC.pilaresLigados().filter((p: any) => p.chave !== "caixa").map((p: any) => campo("val_" + p.chave, p.nome))}
          {campo("cen_pessimista", "Pessimista (p.p.)", `vazio: ${FC.fmt.num(FC.projecao.CENARIOS.pessimista.valorizacao)}`, { placeholder: FC.fmt.num(FC.projecao.CENARIOS.pessimista.valorizacao) })}
          {campo("cen_otimista", "Otimista (p.p.)", `vazio: +${FC.fmt.num(FC.projecao.CENARIOS.otimista.valorizacao)}`, { placeholder: FC.fmt.num(FC.projecao.CENARIOS.otimista.valorizacao) })}
        </View>
        {rot("Cenário macro de longo prazo — em branco usa o de hoje")}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
          {campo("cdi_lp", "CDI (% a.a.)", `hoje ${ok(m.cdi) ? FC.fmt.num(m.cdi) : "—"}%`, { placeholder: ok(m.cdi) ? FC.fmt.num(m.cdi) : "" })}
          {campo("ipca_lp", "IPCA (% a.a.)", `hoje ${ok(m.ipca_12m) ? FC.fmt.num(m.ipca_12m) : "—"}%`, { placeholder: ok(m.ipca_12m) ? FC.fmt.num(m.ipca_12m) : "" })}
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
