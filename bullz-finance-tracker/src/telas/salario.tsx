/* Salário: seus ganhos, o plano de investimento e o guia de cada mês — port
 * de telas/salario.js. */
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../tema";
import { useEstado, rerender } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Pagina } from "../casca/casca";
import { B, Botao, BotaoIcone, Cabecalho, Cartao, Chip, Conta, Grade, Item, Kpi, KpiValor, Kpis, Lista, Mensagem, Pilula, Rs, Secao, T, Tabela, Trilha, Vazio, Valores } from "../ui/kit";
import { Campo, CampoData, Entrada, Form, Interruptor, LinhaCampos, Segmentado, Seletor } from "../ui/campos";
import { Icone } from "../ui/icone";
import { ui, type ApiFolha } from "../ui/folha";
import { CartaoSequencia, sequencia } from "./comum/sequencia";
import { depoisDeMudar } from "./comum/dados";
import FC from "../nucleo";

let mesVisto: string | null = null;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => { const tx = `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`; return tx[0].toUpperCase() + tx.slice(1); };
const somaMes = (m: string, n: number) => { let [a, mm] = m.split("-").map(Number); mm += n; while (mm > 12) { mm -= 12; a++; } while (mm < 1) { mm += 12; a--; } return `${a}-${String(mm).padStart(2, "0")}`; };

// dividendos que caíram no mês (a mesma conta da retrospectiva)
function dividendosDoMes(mes: string) {
  const e = FC.estado;
  return FC.salario.dividendosDoMes({ dados: e.dados, base: e.base, proventos: e.proventos }, mes);
}

// ---------------------------------------------------------------- ganho
function FormGanho({ item, novo, api }: { item: any; novo: boolean; api: ApiFolha }) {
  const t = useTema();
  const [tipo, setTipo] = useState(item.tipo);
  const [nome, setNome] = useState(item.nome || "");
  const [cat, setCat] = useState(item.categoria || "salario");
  const [valor, setValor] = useState(item.valor ? String(item.valor).replace(".", ",") : "");
  const [inicio, setInicio] = useState(item.inicio);
  const [fim, setFim] = useState(item.fim || "");
  const [regra, setRegra] = useState(item.dia_regra ?? "");
  const [dia, setDia] = useState(item.dia_numero != null ? String(item.dia_numero) : "");
  const [obs, setObs] = useState(item.observacao || "");
  // prévia das próximas datas pela regra escolhida (com feriados)
  const n = Math.round(FC.lerNum(dia) || 0);
  const hoje = FC.datas.hoje();
  const meses = [hoje.slice(0, 7), FC.datas.soma(hoje.slice(0, 7) + "-28", 7).slice(0, 7), FC.datas.soma(hoje.slice(0, 7) + "-28", 38).slice(0, 7)];
  const ds = meses.map((m) => FC.salario.dataRecebimento({ tipo: "recorrente", dia_regra: regra || null, dia_numero: n || 1 }, m)).filter(Boolean);
  const previa = ds.length ? "cai em " + ds.map((d: string) => FC.datas.br(d).slice(0, 5)).join(", ") : "";

  FormGanho.salvar.set(api.id, async () => {
    const v = FC.lerNum(valor);
    if (!nome.trim()) { ui.aviso("Dê um nome ao ganho.", "erro"); return; }
    if (!(v > 0)) { ui.aviso("Informe o valor.", "erro"); return; }
    const r = tipo === "recorrente" ? regra || null : null;
    if (r === "dia_util" && !(n >= 1 && n <= 23)) { ui.aviso("O dia útil vai de 1 a 23.", "erro"); return; }
    if (r === "dia_fixo" && !(n >= 1 && n <= 31)) { ui.aviso("O dia do mês vai de 1 a 31.", "erro"); return; }
    const linha = { nome: nome.trim(), categoria: cat, tipo, valor: v, inicio, fim: tipo === "recorrente" && fim ? fim : null, observacao: obs || "",
      dia_regra: r, dia_numero: r === "dia_util" || r === "dia_fixo" ? n : null };
    if (linha.fim && linha.fim < linha.inicio) { ui.aviso("A data final vem antes da inicial.", "erro"); return; }
    try {
      if (novo) await FC.db.inserir("ganhos", linha); else await FC.db.atualizar("ganhos", item.id, linha);
      api.fechar();
      await depoisDeMudar(novo ? "Ganho adicionado" : "Ganho atualizado");
    } catch (err) { ui.erro(err); }
  });

  return (
    <Form>
      <Segmentado valor={tipo} aoMudar={setTipo} rotuloA11y="Tipo de ganho" opcoes={[{ v: "recorrente", rotulo: "Todo mês" }, { v: "avulso", rotulo: "Uma vez" }]} />
      <LinhaCampos>
        <Campo rotulo="Nome"><Entrada valor={nome} aoMudar={setNome} placeholder="Salário empresa X" maxLength={80} autoCapitalize="sentences" accessibilityLabel="Nome" /></Campo>
        <Campo rotulo="Categoria"><Seletor valor={cat} aoMudar={setCat} rotuloA11y="Categoria"
          opcoes={Object.entries<string>(FC.CATEGORIAS_GANHO).map(([k, v]) => ({ v: k, rotulo: v }))} /></Campo>
      </LinhaCampos>
      <LinhaCampos n={3}>
        <Campo rotulo="Valor líquido (R$)" dica="o que cai na conta"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor líquido" /></Campo>
        <Campo rotulo={tipo === "avulso" ? "Data" : "Desde"}><CampoData valor={inicio} aoMudar={setInicio} rotuloA11y={tipo === "avulso" ? "Data" : "Desde"} /></Campo>
        {tipo === "avulso" ? null : <Campo rotulo="Até (opcional)" dica="vazio = continua"><CampoData valor={fim} aoMudar={setFim} rotuloA11y="Até" /></Campo>}
      </LinhaCampos>
      {tipo === "avulso" ? null : (
        <LinhaCampos>
          <Campo rotulo="Quando cai"><Seletor valor={regra} aoMudar={setRegra} rotuloA11y="Quando cai"
            opcoes={[{ v: "dia_util", rotulo: "Nº dia útil do mês" }, { v: "dia_fixo", rotulo: "Dia fixo do mês" }, { v: "ultimo_dia_util", rotulo: "Último dia útil" }, { v: "", rotulo: "Sem dia definido" }]} /></Campo>
          {!regra || regra === "ultimo_dia_util" ? <T style={{ fontSize: 12, color: t.cores.ink3, alignSelf: "flex-end", paddingBottom: 12 }}>{previa}</T> : (
            <Campo rotulo={regra === "dia_fixo" ? "Dia do mês" : "Qual dia útil"} dica={previa}>
              <Entrada valor={dia} aoMudar={setDia} keyboardType="number-pad" placeholder="5" accessibilityLabel="Dia" />
            </Campo>
          )}
        </LinhaCampos>
      )}
      <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={160} autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
    </Form>
  );
}
FormGanho.salvar = new Map<number, () => Promise<void>>();

export function formGanho(item?: any) {
  const novo = !item;
  const it = item || { tipo: "recorrente", categoria: "salario", inicio: FC.datas.hoje().slice(0, 8) + "01", dia_regra: "dia_util", dia_numero: 5 };
  ui.folha({
    titulo: novo ? "Novo ganho" : "Editar ganho",
    corpo: (api) => <FormGanho item={it} novo={novo} api={api} />,
    rodape: (api) => (
      <>
        {novo ? null : <Botao variante="perigo" icone="lixo" style={{ marginRight: "auto" }} onPress={async () => {
          if (!(await ui.confirma(`Excluir "${it.nome}"?`, { botao: "Excluir", perigo: true }))) return;
          try { await FC.db.apagar("ganhos", it.id); api.fechar(); await depoisDeMudar("Ganho excluído"); } catch (e) { ui.erro(e); }
        }}>Excluir</Botao>}
        <Botao variante="sec" onPress={api.fechar}>Cancelar</Botao>
        <Botao onPress={() => FormGanho.salvar.get(api.id)?.()}>Salvar</Botao>
      </>
    ),
  });
}

// ---------------------------------------------------------------- plano
function opcoesAlvo(tipo: string, sel: string | null) {
  const b = FC.estado.base;
  if (tipo === "pilar") return FC.PILARES.filter((p: any) => FC.pilaresLigados().includes(p) || p.chave === sel).map((p: any) => ({ v: p.chave, rotulo: p.nome }));
  const lista: string[] = tipo === "ativo" ? [...new Set<string>(b.ativos.map((a: any) => a.ticker))].sort() : b.rendaFixa.map((r: any) => r.nome);
  if (sel && !lista.includes(sel)) lista.unshift(sel);
  return lista.length ? lista.map((x) => ({ v: x, rotulo: x })) : [{ v: "", rotulo: tipo === "ativo" ? "cadastre um ativo primeiro" : "cadastre um título primeiro" }];
}

function CartaoPlano({ plano, rendaFixa, ganhos }: { plano: any; rendaFixa: number; ganhos: any[] }) {
  const t = useTema();
  const [modo, setModo] = useState(plano.modo === "valor" ? "valor" : "percentual");
  const [pct, setPct] = useState(String(plano.percentual ?? ""));
  const [val, setVal] = useState(String(plano.valor ?? "").replace(".", ","));
  const [reinv, setReinv] = useState(!!plano.reinvestir_dividendos);
  const [dest, setDest] = useState<any[]>(plano.destinos.map((d: any) => ({ ...d, pct: d.pct ?? "" })));
  const soma = FC.soma(dest, (d: any) => FC.lerNum(String(d.pct)) || 0);
  const r = FC.salario.rendaDoMes(ganhos, FC.datas.hoje().slice(0, 7));
  const pctN = FC.lerNum(pct) || 0;
  const muda = (i: number, campo: string, v: any) => setDest(dest.map((d, k) => (k === i ? { ...d, [campo]: v, ...(campo === "tipo" ? { alvo: opcoesAlvo(v, null)[0]?.v ?? null } : {}) } : d)));
  const salvar = async () => {
    const destinos = dest.map((d) => ({ tipo: d.tipo, alvo: d.alvo || opcoesAlvo(d.tipo, null)[0]?.v, pct: FC.lerNum(String(d.pct)) || 0 })).filter((d) => d.alvo && d.pct > 0);
    const s = FC.soma(destinos, (d: any) => d.pct);
    if (destinos.length && Math.abs(s - 100) > 0.5) { ui.aviso(`Os destinos somam ${FC.fmt.num(s, 0)}% — ajuste para 100%.`, "erro"); return; }
    const novo = { modo, percentual: pctN, valor: FC.lerNum(val) || 0, reinvestir_dividendos: reinv, destinos };
    try { await FC.db.gravaPrefs({ plano: novo }); await depoisDeMudar("Plano salvo — as projeções já usam ele"); } catch (err) { ui.erro(err); }
  };
  return (
    <Cartao>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
        <T v="h3">Seu plano</T>
        <Segmentado valor={modo} aoMudar={setModo} rotuloA11y="Modo do plano" opcoes={[{ v: "percentual", rotulo: "% da renda" }, { v: "valor", rotulo: "Valor fixo" }]} />
      </View>
      <LinhaCampos>
        {modo === "valor"
          ? <Campo rotulo="Investir por mês (R$)"><Entrada valor={val} aoMudar={setVal} decimal accessibilityLabel="Investir por mês" /></Campo>
          : <Campo rotulo="Investir (% da renda do mês)" dica={r.total ? `= ${FC.fmt.brlTexto((r.total * pctN) / 100)} este mês` : undefined}>
              <Entrada valor={pct} aoMudar={setPct} decimal accessibilityLabel="Percentual da renda" /></Campo>}
        <View style={{ justifyContent: "flex-end" }}><Interruptor valor={reinv} aoMudar={setReinv} rotulo="Reinvestir os dividendos do mês" /></View>
      </LinhaCampos>
      <T style={{ fontSize: 13, fontWeight: "500", color: t.cores.ink2, marginTop: t.espaco.e4, marginBottom: t.espaco.e3 }}>Para onde vai o dinheiro</T>
      <Lista style={{ boxShadow: "none" } as any}>
        {dest.map((d, i) => (
          <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
            <View style={{ width: 150 }}><Seletor compacto valor={d.tipo} aoMudar={(v) => muda(i, "tipo", v)} rotuloA11y="Tipo de destino"
              opcoes={[{ v: "pilar", rotulo: "Pilar" }, { v: "ativo", rotulo: "Ativo" }, { v: "renda_fixa", rotulo: "Renda fixa" }]} /></View>
            <View style={{ flex: 1, minWidth: 140 }}><Seletor compacto valor={d.alvo ?? ""} aoMudar={(v) => muda(i, "alvo", v)} rotuloA11y="Destino" opcoes={opcoesAlvo(d.tipo, d.alvo)} /></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Entrada compacto valor={String(d.pct)} aoMudar={(v) => muda(i, "pct", v)} decimal style={{ width: 80, textAlign: "right" }} accessibilityLabel="Percentual" />
              <T style={{ color: t.cores.ink2 }}>%</T>
            </View>
            <BotaoIcone nome="lixo" tam={16} rotulo="Remover destino" onPress={() => setDest(dest.filter((_, k) => k !== i))} />
          </View>
        ))}
      </Lista>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        <Botao variante="texto" pequeno icone="aportes" onPress={() => {
          const usados = new Set(dest.filter((d) => d.tipo === "pilar").map((d) => d.alvo));
          const livre = FC.pilaresLigados().find((p: any) => !usados.has(p.chave));
          setDest([...dest, { tipo: "pilar", alvo: livre ? livre.chave : "acoes", pct: Math.max(0, 100 - soma) }]);
        }}>Destino</Botao>
        <T cls={Math.abs(soma - 100) < 0.5 ? "pos" : "neg"}>{`Soma: ${FC.fmt.num(soma, 0)}%`}</T>
        <Botao onPress={salvar}>Salvar plano</Botao>
      </View>
      <T v="p" style={{ marginTop: t.espaco.e3 }}>Os destinos podem ser um pilar inteiro (ex.: 25% em Real Estate) ou um ativo/título específico (ex.: 40% em BTC). A projeção usa este plano para simular os próximos anos, com a renda fixa mensal de <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(rendaFixa)}</Rs>.</T>
    </Cartao>
  );
}

// ---------------------------------------------------------------- tela
export default function Salario() {
  const t = useTema();
  const e = useEstado();
  const { estreito } = useMedidas();
  const hoje = FC.datas.hoje().slice(0, 7);
  const [mes, setMes] = useState(mesVisto || hoje);
  useEffect(() => { mesVisto = mes; }, [mes]);
  useEffect(() => { if (!e.proventos && e.mercado.universo) FC.carregaProventos().then(() => rerender()); }, [e.proventos, e.mercado.universo]);
  if (!e.base || !e.prefs) return <Pagina>{null}</Pagina>;
  const b = e.base;
  const plano = JSON.parse(JSON.stringify(e.prefs.plano));
  const ganhos = b.ganhos || [];
  const guia = FC.salario.planoDoMes({ plano, ganhos, base: b, mes, dividendosDoMes: dividendosDoMes(mes) });
  const renda = guia.renda;
  const historico = FC.salario.mesesAte(hoje, 6).map((m: string) => {
    const g = FC.salario.planoDoMes({ plano, ganhos, base: b, mes: m, dividendosDoMes: 0 });
    return { mes: m, renda: g.renda.total, meta: g.valor_base, investido: FC.salario.investidoNoMes(b, m) };
  });
  const seq = sequencia();
  const fixos = ganhos.filter((g: any) => g.tipo === "recorrente").sort((x: any, y: any) => (x.fim ? 1 : 0) - (y.fim ? 1 : 0) || y.valor - x.valor);
  const avulsos = ganhos.filter((g: any) => g.tipo === "avulso").sort((x: any, y: any) => y.inicio.localeCompare(x.inicio)).slice(0, 24);
  const proximos = FC.salario.proximos(ganhos, FC.datas.hoje(), 2);
  const recebimentos = renda.itens.map((g: any) => ({ g, data: FC.salario.dataRecebimento(g, mes) })).sort((x: any, y: any) => (x.data || "9").localeCompare(y.data || "9"));
  const chipV = (rot: React.ReactNode, v: string) => <Chip><Text style={{ fontSize: 13, color: t.cores.ink2 }}>{rot} </Text><Rs style={{ fontSize: 13, fontWeight: "600" }}>{v}</Rs></Chip>;
  const tam = estreito ? 38 : 56;
  return (
    <Pagina>
      <Cabecalho titulo="Salário" sub="Seus ganhos e o plano de investimento de cada mês." direita={<Botao icone="aportes" onPress={() => formGanho()}>Ganho</Botao>} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <BotaoIcone nome="voltar" tam={18} rotulo="Mês anterior" onPress={() => setMes(somaMes(mes, -1))} />
          <T style={{ fontSize: 17, fontWeight: "600", minWidth: 150, textAlign: "center" }}>{nomeMes(mes)}</T>
          {mes >= somaMes(hoje, 1) ? <View style={{ width: 36 }} /> : <BotaoIcone nome="chevron" tam={18} rotulo="Próximo mês" onPress={() => setMes(somaMes(mes, 1))} />}
        </View>
        {mes !== hoje ? <Botao variante="texto" pequeno onPress={() => setMes(hoje)}>Voltar para este mês</Botao> : null}
      </View>

      <Cartao style={{ paddingTop: estreito ? 24 : 48, paddingHorizontal: estreito ? 24 : 48, paddingBottom: 24 }}>
        <T style={{ fontSize: 15, color: t.cores.ink2 }}>Renda de {nomeMes(mes).split(" de ")[0].toLowerCase()}</T>
        <Conta valor={renda.total} style={{ fontSize: tam, lineHeight: tam * 1.08, fontWeight: "600", letterSpacing: -tam * 0.035, marginTop: 6, marginBottom: 16 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
          {renda.fixa ? chipV("Fixa", FC.fmt.brlTexto(renda.fixa)) : null}
          {renda.avulsa ? chipV("Extra", FC.fmt.brlTexto(renda.avulsa)) : null}
          <Chip icone={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.cores.s1 }} />}>
            <Text style={{ fontSize: 13, color: t.cores.ink2 }}>Investir </Text><Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(guia.total)}</Rs>
            <Text style={{ fontSize: 13, color: t.cores.ink2 }}>{plano.modo !== "valor" ? ` (${FC.fmt.num(plano.percentual, 0)}%${guia.dividendos ? " + dividendos" : ""})` : ""}</Text>
          </Chip>
          {chipV("Sobra para gastar", FC.fmt.brlTexto(Math.max(0, guia.sobra_renda)))}
        </View>
        {recebimentos.some((x: any) => x.data) ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: t.espaco.e4 }}>
            {recebimentos.map((x: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 980, backgroundColor: t.cores.bg3 }}>
                <Icone nome="carteira" tam={14} cor={t.cores.ink2} />
                <Text style={{ fontSize: 13, color: t.cores.ink2 }}>{x.g.nome} <Text style={{ fontWeight: "600", color: t.cores.ink }}>{x.data ? FC.datas.br(x.data).slice(0, 5) : "no mês"}</Text>{x.data && x.data < FC.datas.hoje() ? " ✓" : ""}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Cartao>
      {proximos.length && mes === hoje ? (() => {
        const p = proximos[0];
        const dias = FC.datas.dias(FC.datas.hoje(), p.data);
        const regra = FC.salario.descreveRegra(p.ganho);
        return (
          <Mensagem tipo="info" icone="carteira" style={{ marginTop: t.espaco.e3 }}>
            <T style={{ fontSize: 14 }}>Próximo recebimento: <B>{p.ganho.nome}</B> de <Rs style={{ fontSize: 14, fontWeight: "600" }}>{FC.fmt.brlTexto(p.valor)}</Rs> em <B>{FC.datas.br(p.data)}</B> ({dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}{regra ? ", " + regra : ""}).</T>
          </Mensagem>
        );
      })() : null}

      {seq ? <Secao titulo="Sequência de aportes" sub="meses seguidos batendo a meta do plano"><CartaoSequencia st={seq} /></Secao> : null}

      <Secao titulo="Guia do mês" sub="o que o plano manda aportar e quanto já foi">
        {!plano.destinos.length ? (
          <Lista><Vazio icone="🧭" titulo="Monte o seu plano" texto="Diga quanto da renda quer investir e para onde vai cada parte. Todo mês esta seção mostra o valor de cada aporte e o que falta." /></Lista>
        ) : !renda.total && plano.modo !== "valor" ? (
          <Mensagem tipo="info" icone="info">{`Cadastre seus ganhos para o plano calcular quanto investir em ${nomeMes(mes)}.`}</Mensagem>
        ) : (
          <Cartao>
            <Kpis style={{ marginBottom: 24 }}>
              <Kpi rotulo="Investir no mês" valor={FC.fmt.brlTexto(guia.total)} dinheiro
                peq={guia.dividendos ? <>inclui <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(guia.dividendos)}</Rs> de dividendos para reinvestir</> : undefined} />
              <Kpi rotulo="Já aportado no plano" valor={<KpiValor dinheiro cls={guia.aportado >= guia.total - 0.5 ? "pos" : null}>{FC.fmt.brlTexto(guia.aportado)}</KpiValor>}
                peq={guia.investido - guia.aportado > 0.5 ? <>investido no mês: <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(guia.investido)}</Rs> (o que passa de um destino não cobre outro)</> : undefined} />
              <Kpi rotulo="Falta" valor={FC.fmt.brlTexto(guia.falta)} dinheiro />
            </Kpis>
            <Lista style={{ boxShadow: "none" } as any}>
              {guia.destinos.map((d: any, i: number) => (
                <Item key={i}
                  titulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <T style={{ fontWeight: "600", fontSize: 15 }}>{d.rotulo}</T><T style={{ fontSize: 13, color: t.cores.ink2 }}>{FC.fmt.num(d.pct, 0)}%</T>
                    {d.feito >= 99.5 ? <Pilula cor="verde">feito</Pilula> : null}</View>}
                  detalhe={<View style={{ maxWidth: 320, marginTop: t.espaco.e2 }}><Trilha pct={d.feito} cor={d.feito >= 99.5 ? t.cores.verde : t.cores.acento} /></View>}
                  valores={<View style={{ alignItems: "flex-end" }}>
                    <Rs style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(d.aportado)} de {FC.fmt.brlTexto(d.valor)}</Rs>
                    <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{d.falta > 0.5 ? <>falta <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{FC.fmt.brlTexto(d.falta)}</Rs></> : "completo"}</T>
                  </View>}
                  direita={d.falta > 0.5 && mes === hoje ? (d.tipo !== "pilar"
                    ? <Botao pequeno onPress={() => FC.aportarRapido({ tipo: d.tipo === "ativo" ? "ativo" : "caixa", nome: d.alvo, valor: d.falta })}>Aportar</Botao>
                    : <Botao variante="sec" pequeno onPress={() => router.push("/aportes" as any)}>Aportar</Botao>) : null} />
              ))}
            </Lista>
            {guia.soma_pct && Math.abs(guia.soma_pct - 100) > 0.5 ? <T v="p" cls="neg" style={{ marginTop: t.espaco.e3 }}>{`Os destinos somam ${FC.fmt.num(guia.soma_pct, 0)}% — o valor foi dividido proporcionalmente.`}</T> : null}
          </Cartao>
        )}
      </Secao>

      <Secao><CartaoPlano key={JSON.stringify(plano)} plano={plano} rendaFixa={FC.salario.rendaDoMes(ganhos, hoje).fixa} ganhos={ganhos} /></Secao>

      <Secao titulo="Últimos 6 meses" sub="quanto entrou e quanto virou investimento">
        <Cartao semPad>
          <Tabela minimo={640} cabecas={[{ t: "Mês", largura: 170 }, { t: "Renda", n: true }, { t: "Meta do plano", n: true }, { t: "Investido", n: true }, { t: "% da renda", n: true }, { t: "", largura: 150 }]}
            linhas={[...historico].reverse().map((h: any) => [
              nomeMes(h.mes), { v: FC.fmt.brlTexto(h.renda), dinheiro: true }, { v: h.meta ? FC.fmt.brlTexto(h.meta) : "—", dinheiro: true },
              { v: FC.fmt.brlTexto(h.investido), dinheiro: true }, h.renda ? FC.fmt.num((h.investido / h.renda) * 100, 0) + "%" : "—",
              { v: h.meta ? (h.investido >= h.meta - 0.5 ? <Pilula cor="verde">meta cumprida</Pilula> : <Pilula cor={h.mes === hoje ? "cinza" : "amarelo"}>{h.mes === hoje ? "em andamento" : "abaixo da meta"}</Pilula>) : null },
            ])} />
        </Cartao>
      </Secao>

      <Secao titulo="Ganhos" sub="fixos valem todo mês; extras, só no mês em que caem">
        <Grade colunas={2}>
          <View>
            <T style={{ fontSize: 13, fontWeight: "500", color: t.cores.ink2, marginBottom: t.espaco.e3 }}>Todo mês</T>
            <Lista>
              {fixos.length ? fixos.map((g: any) => {
                const regra = FC.salario.descreveRegra(g);
                return (
                  <Item key={g.id} chevron onPress={() => formGanho(g)}
                    titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><T style={{ fontWeight: "600", fontSize: 15 }}>{g.nome}</T>{FC.salario.valeNoMes(g, hoje) ? null : <Pilula cor="cinza">encerrado</Pilula>}</View>}
                    detalhe={`${regra ? regra + (FC.salario.valeNoMes(g, mes) ? " · " + FC.datas.br(FC.salario.dataRecebimento(g, mes)).slice(0, 5) : "") + " · " : ""}${FC.CATEGORIAS_GANHO[g.categoria]} · desde ${FC.datas.mesAno(g.inicio)}${g.fim ? " até " + FC.datas.mesAno(g.fim) : ""}`}
                    valores={<Valores b={FC.fmt.brlTexto(g.valor)} small="por mês" />} />
                );
              }) : <Vazio icone="💼" titulo="Nenhum ganho fixo" texto="Salário, pró-labore, aluguel — o que entra todo mês." />}
            </Lista>
          </View>
          <View>
            <T style={{ fontSize: 13, fontWeight: "500", color: t.cores.ink2, marginBottom: t.espaco.e3 }}>Extras</T>
            <Lista>
              {avulsos.length ? avulsos.map((g: any) => (
                <Item key={g.id} chevron onPress={() => formGanho(g)} titulo={g.nome} detalhe={`${FC.CATEGORIAS_GANHO[g.categoria]} · ${FC.datas.br(g.inicio)}`}
                  valores={<Valores b={FC.fmt.brlTexto(g.valor)} />} />
              )) : <Vazio icone="🎁" titulo="Nenhum extra" texto="Bônus, 13º, férias, freelas." />}
            </Lista>
          </View>
        </Grade>
      </Secao>
    </Pagina>
  );
}
