/* Rentabilidade (comum.js): resumoInvestido, kpisRentab, comparaIndices,
 * tabelaLotesRF e blocoRentabAtivo.
 *
 * O retorno não é "valor de hoje ÷ total aportado": cada aporte conta com a
 * sua data (retorno no período, Modified Dietz) e a TIR anualiza isso. */
import React from "react";
import { View } from "react-native";
import { useTema } from "../../tema";
import { B, Cartao, Detalhes, Item, Kpi, KpiValor, Kpis, Lista, Mensagem, Num, Ponto, Rs, Secao, T, Tabela, Valores } from "../../ui/kit";
import FC from "../../nucleo";

const ok = (v: any) => FC.ok(v);
export const pctTxt = (v: any, casas = 2) => (ok(v) ? `${FC.fmt.delta(v, casas)}%` : "—");
export const corPct = (v: any) => (ok(v) ? (v >= 0 ? "pos" : "neg") : "fraco");
const sinal = (v: number) => (v >= 0 ? "+" : "−");

const NOMES_CLASSE: Array<[string, string, string]> = [["bolsa", "Ações, FIIs e ETFs", "s1"], ["cripto", "Cripto", "s3"],
  ["renda_fixa", "Renda fixa", "s2"], ["agro", "Agronegócio", "s5"]];

/** Quanto foi colocado, quanto vale e quanto rendeu — por classe e no total. */
export function ResumoInvestido({ d, compacto = false }: { d: any; compacto?: boolean }) {
  const t = useTema();
  const rt = d.rentab;
  if (!rt || !rt.total) return null;
  const classes = NOMES_CLASSE.filter(([k]) => rt.classes[k] && (k !== "agro" || FC.modulo("agro")));
  const tt = rt.total, e = FC.estado;
  const pc = d.resumo.por_classe || {};
  const fontes = [pc.cripto ? "cripto pelo CoinGecko" : "", pc.bolsa ? "bolsa pelo Yahoo Finance (atraso de ~15 min)" : "", rt.classes.renda_fixa ? "renda fixa pelo CDI/IPCA do Banco Central" : ""].filter(Boolean).join(", ");
  // um número só para o cliente: ao ano (TIR) quando há 90 dias; antes, no período
  const principal = ok(tt.xirr) ? [tt.xirr, "ao ano"] : ok(tt.periodo_pct) ? [tt.periodo_pct, "desde o primeiro aporte"] : null;
  const colocou = tt.aplicado - (tt.devolvido || 0);
  return (
    <Secao titulo="Seu dinheiro investido" sub={`${e.spotEm ? `preços de ${FC.datas.ha(e.spotEm)}` : "buscando preços…"}${fontes ? " · " + fontes : ""}`}>
      <Cartao>
        <Kpis>
          <Kpi rotulo="Você colocou" valor={FC.fmt.brlTexto(colocou)} dinheiro
            peq={tt.devolvido > 0.005 ? `aportou ${FC.fmt.brlTexto(tt.aplicado)} e já voltaram ${FC.fmt.brlTexto(tt.devolvido)}` : "o que saiu do seu bolso"} />
          <Kpi rotulo="Vale agora" valor={FC.fmt.brlTexto(tt.valor_atual)} dinheiro peq="preço de agora · renda fixa com rendimento" />
          <Kpi rotulo="Ganho" valor={<KpiValor dinheiro cls={tt.ganho >= 0 ? "pos" : "neg"}>{sinal(tt.ganho)}{FC.fmt.brlTexto(Math.abs(tt.ganho))}</KpiValor>}
            peq={principal ? <><B cls={principal[0] >= 0 ? "pos" : "neg"}>{pctTxt(principal[0])}</B> {principal[1]}</> : undefined} />
        </Kpis>
        <Detalhes>
          {compacto && classes.length < 2 ? null : (
            <Lista style={{ boxShadow: "none" } as any}>
              {classes.map(([k, nome, cor]) => {
                const c = rt.classes[k];
                return (
                  <Item key={k} esquerda={<Ponto cor={(t.cores as any)[cor]} tam={12} />} titulo={nome}
                    detalhe={`colocou ${FC.fmt.brlTexto(c.aplicado)}${c.devolvido > 0.005 ? ` · voltou ${FC.fmt.brlTexto(c.devolvido)}` : ""} · vale ${FC.fmt.brlTexto(c.valor_atual)}${ok(c.xirr) ? ` · TIR ${pctTxt(c.xirr)} a.a.` : ""}`}
                    detalheLinhas={2}
                    valores={<Valores cls={c.ganho >= 0 ? "pos" : "neg"} b={`${sinal(c.ganho)}${FC.fmt.brlTexto(Math.abs(c.ganho))}`} small={`${pctTxt(c.periodo_pct)} no período`} />} />
                );
              })}
            </Lista>
          )}
          <Kpis style={{ marginTop: t.espaco.e3 }}>
            <Kpi pequeno rotulo="No período" valor={pctTxt(tt.periodo_pct)} cls={corPct(tt.periodo_pct)} peq={tt.desde ? "desde " + FC.datas.br(tt.desde) : undefined} />
            <Kpi pequeno rotulo="TIR" valor={pctTxt(tt.xirr)} cls={corPct(tt.xirr)} peq={ok(tt.xirr) ? "ao ano" : "precisa de 90 dias"} />
          </Kpis>
          <T v="p" style={{ marginTop: t.espaco.e3 }}>Cada aporte entra com a sua data: o retorno no período divide o ganho pelo capital médio que ficou aplicado (Modified Dietz), e a TIR é a taxa anual equivalente — aparece a partir de 90 dias de história.</T>
        </Detalhes>
        {rt.sem_custo.length ? <T v="p" style={{ marginTop: t.espaco.e2 }}>Fora da conta: {rt.sem_custo.join(", ")}, sem preço médio — sem o custo não dá para saber o ganho. Preencha em Investimentos → Editar.</T> : null}
        {rt.sem_preco && rt.sem_preco.length ? <T v="p" style={{ marginTop: t.espaco.e2 }}>Fora da conta por enquanto: {rt.sem_preco.join(", ")}, sem cotação no momento.</T> : null}
      </Cartao>
    </Secao>
  );
}

/** resumo consolidado: aplicado, ganho e UM percentual; Dietz e TIR em "ver detalhes" */
export function KpisRentab({ r, titulo = "" }: { r: any; titulo?: string }) {
  const t = useTema();
  if (!r) return null;
  const anual = ok(r.xirr);
  const v = anual ? r.xirr : r.periodo_pct;
  return (
    <View style={{ marginBottom: t.espaco.e3 }}>
      <Kpis style={{ rowGap: 10, columnGap: 24 }}>
        <Kpi pequeno rotulo={`Aplicado${titulo}`} valor={r.aplicado != null ? FC.fmt.brlTexto(r.aplicado) : "—"} dinheiro
          peq={r.devolvido > 0.005 ? `${FC.fmt.brlTexto(r.devolvido)} já voltou` : undefined} />
        <Kpi pequeno rotulo="Ganho" valor={r.ganho != null ? <KpiValor pequeno dinheiro cls={corPct(r.ganho)}>{sinal(r.ganho)}{FC.fmt.brlTexto(Math.abs(r.ganho))}</KpiValor> : "—"} />
        <Kpi pequeno rotulo="Rendeu" ajuda="Quanto o seu dinheiro rendeu por ano, contando a data de cada aporte, resgate e provento. Antes de 90 dias de história, mostra o rendimento no período, sem anualizar."
          valor={pctTxt(v)} cls={corPct(v)} peq={anual ? "ao ano" : r.desde ? "desde " + FC.datas.br(r.desde) : undefined} />
      </Kpis>
      <Detalhes tam={13.5} style={{ marginTop: t.espaco.e2 }}>
        <Kpis>
          <Kpi pequeno rotulo="No período" ajuda="Ganho dividido pelo capital médio que ficou aplicado, ponderado pelo tempo de cada aporte (Modified Dietz)."
            valor={pctTxt(r.periodo_pct)} cls={corPct(r.periodo_pct)} peq={r.desde ? "desde " + FC.datas.br(r.desde) : undefined} />
          <Kpi pequeno rotulo="TIR" ajuda="Taxa interna de retorno com as datas de cada aporte, resgate e provento (XIRR). Aparece a partir de 90 dias de história."
            valor={anual ? pctTxt(r.xirr) : "—"} cls={corPct(r.xirr)} peq={anual ? "ao ano" : r.dias != null && r.dias < 90 ? "precisa de 90 dias" : undefined} />
        </Kpis>
      </Detalhes>
    </View>
  );
}

/** "E se cada aporte tivesse ido para a Selic ou o Ibovespa no mesmo dia?" */
export function ComparaIndices({ fluxos, valorAtual }: { fluxos: any[]; valorAtual: number }) {
  const t = useTema();
  const e = FC.estado, ix = e.mercado.indices, ibov = (e.bench || {}).ibov;
  if (!fluxos || !fluxos.length) return null;
  const c = FC.rentab.comparaIndices(fluxos, FC.datas.hoje(), ix, ibov);
  const item = (nome: string, cor: string, v: number | null) => {
    const marca = <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: cor, marginRight: 6 }} />;
    if (v == null) {
      return <Kpi pequeno rotulo={<>{nome}</>} valor={<KpiValor pequeno cls="fraco">—</KpiValor>}
        peq={nome === "Ibovespa" && !e.bench ? "carregando o histórico…" : "sem histórico desde o 1º aporte"} />;
    }
    const dif = valorAtual - v;
    return (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>{marca}<T v="rot" style={{ fontWeight: "400" }}>Se fosse {nome}</T></View>
        <KpiValor pequeno dinheiro>{FC.fmt.brlTexto(v)}</KpiValor>
        <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>você está <Rs cls={dif >= 0 ? "pos" : "neg"} style={{ fontSize: 12.5, fontWeight: "600" }}>{sinal(dif)}{FC.fmt.brlTexto(Math.abs(dif))}</Rs> {dif >= 0 ? "acima" : "abaixo"}</T>
      </View>
    );
  };
  return (
    <View style={{ marginBottom: t.espaco.e3 }}>
      <View style={{ paddingTop: 4, borderTopWidth: 1, borderTopColor: t.cores.linha }}>
        <Kpis style={{ marginBottom: t.espaco.e3 }}>{item("Selic", t.cores.s3, c.selic)}{item("Ibovespa", t.cores.s4, c.ibov)}</Kpis>
      </View>
      <T v="p">Cada aporte aplicado no índice no mesmo dia; vendas, resgates e proventos saem da conta na mesma data.</T>
    </View>
  );
}

/** tabela: cada aporte de um título com a sua data, a sua taxa e o seu rendimento */
export function TabelaLotesRF({ rent }: { rent: any }) {
  const t = useTema();
  if (!rent || !rent.lotes.length) return null;
  const linhas: any[] = rent.lotes.map((l: any) => [
    { v: FC.datas.br(l.data), leg: l.origem + (l.proprio ? " · taxa própria" : "") },
    l.rotulo_taxa,
    { v: FC.fmt.brlTexto(l.valor), dinheiro: true },
    { v: FC.fmt.brlTexto(l.valor_atual), dinheiro: true },
    l.valor > 0 ? { v: `${sinal(l.rendimento)}${FC.fmt.brlTexto(Math.abs(l.rendimento))}`, leg: pctTxt(l.pct), cls: corPct(l.rendimento), dinheiro: true } : "—",
    ok(l.pct_aa) ? pctTxt(l.pct_aa) : { v: "", leg: l.dias < 30 ? "menos de 30 dias" : "—" },
  ]);
  if (rent.manual) {
    linhas.push([{ v: FC.datas.br(rent.manual.data), leg: "valor informado" }, "ajuste", "—", { v: FC.fmt.brlTexto(rent.valor_atual), dinheiro: true },
      { v: `${sinal(rent.manual.ajuste)}${FC.fmt.brlTexto(Math.abs(rent.manual.ajuste))}`, leg: "conta como rendimento", cls: corPct(rent.manual.ajuste), dinheiro: true }, "—"]);
  }
  return (
    <View>
      <T style={{ fontSize: 17, fontWeight: "600", marginTop: 4, marginBottom: 8 }}>Rendimento por aporte</T>
      <KpisRentab r={rent} />
      <ComparaIndices fluxos={rent.lotes.map((l: any) => ({ data: l.data, valor: -l.valor }))} valorAtual={rent.valor_atual} />
      <Tabela cabecas={[{ t: "Data" }, { t: "Taxa" }, { t: "Aplicado", n: true }, { t: "Vale hoje", n: true }, { t: "Rendeu", n: true }, { t: "% ao ano", n: true }]} linhas={linhas} />
      {rent.sem_indices ? <Mensagem tipo="alerta" icone="info" style={{ marginTop: t.espaco.e3 }}>Índices do Banco Central ainda carregando: por enquanto os valores estão sem rendimento.</Mensagem>
        : rent.so_reserva ? <Mensagem tipo="alerta" icone="info" style={{ marginTop: t.espaco.e3 }}>A série diária do CDI/IPCA não carregou: o rendimento está estimado pela taxa anual de hoje do Banco Central e se ajusta quando a série voltar.</Mensagem>
        : rent.estimado ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Os dias mais recentes (ou anteriores à série disponível) usam o último índice conhecido — o valor se ajusta quando o Banco Central publica.</T> : null}
    </View>
  );
}

/** ações, FIIs e cripto: cada compra como um lote (vendas consomem os mais antigos) */
export function BlocoRentabAtivo({ ticker }: { ticker: string }) {
  const t = useTema();
  const rt = FC.estado.dados && FC.estado.dados.rentab;
  const r = rt && rt.ativos.find((x: any) => x.ticker === ticker);
  if (!r || !r.lotes.length) return null;
  const hoje = FC.datas.hoje();
  return (
    <View>
      <T style={{ fontSize: 17, fontWeight: "600", marginTop: 22, marginBottom: 8 }}>Rentabilidade por aporte</T>
      {r.sem_custo ? <Mensagem tipo="alerta" icone="info" style={{ marginBottom: t.espaco.e3 }}>Sem o preço médio da posição inicial não dá para medir o retorno do ativo. Preencha em Editar.</Mensagem>
        : r.sem_preco ? <Mensagem tipo="alerta" icone="info" style={{ marginBottom: t.espaco.e3 }}>Sem a cotação de agora não dá para medir o retorno do ativo. Tente atualizar.</Mensagem>
        : <><KpisRentab r={r} /><ComparaIndices fluxos={r.fluxos} valorAtual={r.valor_atual} /></>}
      <Tabela minimo={760}
        cabecas={[{ t: "Data" }, { t: "Qtd.", n: true, largura: 80 }, { t: "Preço pago", n: true }, { t: "Vale hoje", n: true }, { t: "Resultado", n: true }, { t: "% ao ano", n: true }, { t: "Na Selic", n: true }, { t: "No Ibovespa", n: true }]}
        linhas={r.lotes.map((l: any) => [
          { v: FC.datas.br(l.data), leg: l.origem },
          FC.fmt.qtd(l.quantidade),
          l.preco != null ? FC.fmt.preco(l.preco) : "—",
          l.valor_atual != null ? { v: FC.fmt.brlTexto(l.valor_atual), dinheiro: true } : "—",
          l.rendimento != null ? { v: `${sinal(l.rendimento)}${FC.fmt.brlTexto(Math.abs(l.rendimento))}`, leg: pctTxt(l.pct), cls: corPct(l.rendimento), dinheiro: true } : "—",
          ok(l.pct_aa) ? pctTxt(l.pct_aa) : { v: "", leg: l.dias < 30 ? "menos de 30 dias" : "—" },
          ...["selic", "ibov"].map((ind) => {
            const g = l.custo != null ? FC.rentab.crescimentoIndice(ind, l.data, hoje, FC.estado.mercado.indices, (FC.estado.bench || {}).ibov) : null;
            return g == null ? { v: "—", cls: "fraco" } : { v: FC.fmt.brlTexto(l.custo * g), leg: pctTxt((g - 1) * 100), dinheiro: true };
          }),
        ])} />
      {r.realizados.length ? <T v="p" style={{ marginTop: t.espaco.e3 }}>Vendas: {r.realizados.map((v: any) => `${FC.fmt.qtd(v.q)} em ${FC.datas.br(v.data_venda)}${ok(v.pct) ? ` (${pctTxt(v.pct)})` : ""}`).join(" · ")}.</T> : null}
      {r.proventos > 0.005 ? <T v="p" style={{ marginTop: t.espaco.e2 }}>Inclui <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(r.proventos)}</Rs> em proventos já pagos, contados como dinheiro que voltou.</T> : null}
    </View>
  );
}

export { Num };
