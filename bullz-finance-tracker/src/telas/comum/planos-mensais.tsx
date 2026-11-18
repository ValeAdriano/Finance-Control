/* Linha do tempo dos planos mensais (Marco 8): cada mês com o plano salvo
 * (previsto) e o que foi executado; detalhe por destino; criar o plano do
 * mês seguinte a partir da previsão; gráfico de 12 meses. */
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useTema } from "../../tema";
import { Botao, Cartao, Composicao, Item, Lista, Pilula, Rs, Secao, T, Trilha } from "../../ui/kit";
import { ui } from "../../ui/folha";
import { depoisDeMudar } from "./dados";
import FC from "../../nucleo";

// as cores dos pilares (tokens do tema): RF verde, Ações azul, Cripto roxo
const COR: Record<string, string> = { rf: "var(--s2)", acoes: "var(--s1)", cripto: "var(--s4)", ativo: "var(--s1)", titulo_rf: "var(--s2)", pote: "var(--s2)", parcela: "var(--terra)", categoria: "var(--sref)" };
const corDe = (d: any) => (d.grupo && COR[d.grupo]) || (d.tipo === "categoria" ? COR[d.alvo] : COR[d.tipo]) || "var(--sref)";
const nomeMes = (m: string) => `${FC.planoMensal.nomeMes(m)} de ${m.slice(0, 4)}`;
const STATUS: Record<string, string> = { rascunho: "amarelo", ativo: "azul", fechado: "cinza" };

function CartaoMes({ p, e }: { p: any; e: any }) {
  const t = useTema();
  const [aberto, setAberto] = useState(false);
  const i = FC.planoMensal.indicadores(p, e);
  const destinos = FC.planoMensal.comGrupo(p.destinos, e.base);
  const salva = async (campos: any, msg: string) => {
    try { await FC.db.atualizar("planos_mensais", p.id, campos); await depoisDeMudar(msg); } catch (err) { ui.erro(err); }
  };
  const ativar = async () => {
    const v = FC.planoMensal.validaDivisao(p, e);
    let aceitar = false;
    if (!v.ok) {
      const m = v.mais_proxima;
      aceitar = await ui.confirma(`${v.violacoes.map((x: any) => x.texto).join("; ")}. A divisão válida mais próxima é RF ${FC.fmt.num(m.rf, 0)}%, Ações ${FC.fmt.num(m.acoes, 0)}%, Cripto ${FC.fmt.num(m.cripto, 0)}%.`,
        { titulo: "Este plano quebra a hierarquia", botao: "Ativar assim mesmo", perigo: true });
      if (!aceitar) return;
    }
    const outro = (e.base.planosMensais || []).find((x: any) => x.status === "ativo" && x.mes !== p.mes);
    try {
      if (outro) await FC.db.atualizar("planos_mensais", outro.id, { status: "fechado", fechado_em: new Date().toISOString(), ...FC.planoMensal.realizado(outro, e) });
      await salva({ status: "ativo", ativado_em: new Date().toISOString(), regras_snapshot: FC.planoMensal.snapshot(e, v, aceitar) },
        outro ? `Plano de ${nomeMes(p.mes)} ativo; ${nomeMes(outro.mes)} foi fechado` : `Plano de ${nomeMes(p.mes)} ativo`);
    } catch (err) { ui.erro(err); }
  };
  const fechar = () => salva({ status: "fechado", fechado_em: new Date().toISOString(), ...FC.planoMensal.realizado(p, e) }, `Plano de ${nomeMes(p.mes)} fechado`);
  return (
    <Cartao>
      <Pressable onPress={() => setAberto(!aberto)} accessibilityRole="button" accessibilityLabel={`Plano de ${nomeMes(p.mes)}`}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <T style={{ fontWeight: "600", fontSize: 16 }}>{nomeMes(p.mes)}</T>
            <Pilula cor={STATUS[p.status]}>{p.status}</Pilula>
            {p.origem === "reconstruido" ? <Pilula cor="cinza" semPonto>reconstruído</Pilula> : null}
          </View>
          <Rs style={{ fontSize: 15, fontWeight: "600" }}>{`${FC.fmt.brlTexto(i.aportado)} de ${FC.fmt.brlTexto(i.meta)}`}</Rs>
        </View>
        <View style={{ marginTop: 10 }}><Trilha pct={Math.min(100, i.pct_executado || 0)} cor={i.cem_por_cento ? t.cores.verde : t.cores.acento} /></View>
        <View style={{ marginTop: 10, gap: 4 }}>
          <Composicao altura={10} partes={destinos.map((d: any) => ({ valor: Number(d.valor) || 0, cor: corDe(d) }))} />
          <Composicao altura={10} partes={i.execucao.map((x: any, k: number) => ({ valor: x.aportado, cor: corDe(destinos[k] || x) })).concat(i.fora_do_plano > 0 ? [{ valor: i.fora_do_plano, cor: "var(--vermelho)" }] : [])} />
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {i.cem_por_cento ? <Pilula cor="verde">100% executado</Pilula> : null}
          {i.fora_do_plano > 0.5 ? <Pilula cor="vermelho">{`${FC.fmt.brlTexto(i.fora_do_plano)} fora do plano`}</Pilula> : null}
          {i.hierarquia_respeitada === true ? <Pilula cor="verde">hierarquia respeitada</Pilula> : i.hierarquia_respeitada === false ? <Pilula cor="amarelo">hierarquia violada</Pilula> : null}
          {i.renda_real != null ? <Pilula cor="cinza" semPonto>{`renda ${FC.fmt.brlTexto(i.renda_real)} de ${FC.fmt.brlTexto(i.renda_prevista)} prevista`}</Pilula> : null}
        </View>
      </Pressable>
      {aberto ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          {(p.renda_prevista || []).length ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>{p.renda_prevista.map((r: any) => `${FC.fmt.brlTexto(r.valor)} = ${r.origem}`).join(" · ")}</T> : null}
          {(p.contexto && p.contexto.mes_anterior || []).map((c: string, k: number) => <T key={k} style={{ fontSize: 13, color: t.cores.ink2 }}>{c}</T>)}
          <Lista style={{ boxShadow: "none" } as any}>
            {i.execucao.map((x: any, k: number) => (
              <Item key={k} titulo={<T style={{ fontWeight: "600" }}>{x.rotulo}{destinos[k] && destinos[k].sugestao ? ` (sugestão: ${destinos[k].sugestao})` : ""}</T>}
                detalhe={x.aportes.length ? x.aportes.map((a: any) => `${FC.datas.br(a.data).slice(0, 5)} ${a.ticker || a.titulo || ""} ${FC.fmt.brlTexto(a.valor)}`).join(" · ") : "sem aportes"}
                valores={<View style={{ alignItems: "flex-end" }}>
                  <Rs style={{ fontWeight: "600" }}>{`${FC.fmt.brlTexto(x.aportado)} de ${FC.fmt.brlTexto(x.previsto)}`}</Rs>
                  <T style={{ fontSize: 12.5, color: x.desvio < -0.5 ? t.cores.vermelho : t.cores.ink2 }}>{x.desvio < -0.5 ? `faltou ${FC.fmt.brlTexto(-x.desvio)}` : x.desvio > 0.5 ? `passou ${FC.fmt.brlTexto(x.desvio)}` : "no alvo"}</T>
                </View>} />
            ))}
            {i.fora.map((a: any, k: number) => <Item key={"f" + k} titulo={<T style={{ fontWeight: "600" }}>{a.ticker || a.titulo}</T>} detalhe="fora do plano" valores={<Rs>{FC.fmt.brlTexto(a.valor)}</Rs>} />)}
          </Lista>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {p.status === "rascunho" ? <Botao onPress={ativar}>Ativar este plano</Botao> : null}
            {p.status === "ativo" ? <Botao variante="sec" onPress={fechar}>Fechar o mês</Botao> : null}
          </View>
        </View>
      ) : null}
    </Cartao>
  );
}

function Grafico12({ planos }: { planos: any[] }) {
  const t = useTema();
  const ult = [...planos].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  if (!ult.length) return null;
  const max = Math.max(1, ...ult.map((p) => Math.max(Number(p.meta_total) || 0, Number(p.aportado_total) || 0, Number(p.sobra_real) || 0)));
  const barra = (v: number, cor: string) => <View style={{ width: 8, height: Math.max(2, (Math.max(0, v) / max) * 120), backgroundColor: cor, borderRadius: 3 }} />;
  return (
    <Cartao>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, height: 140 }}>
        {ult.map((p) => (
          <View key={p.mes} style={{ alignItems: "center", gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
              {barra(Number(p.meta_total) || 0, t.cores.ink3)}{barra(Number(p.aportado_total) || 0, t.cores.acento)}{barra(Number(p.sobra_real) || 0, t.cores.verde)}
            </View>
            <T style={{ fontSize: 11, color: t.cores.ink2 }}>{p.mes.slice(5)}</T>
          </View>
        ))}
      </View>
      <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 8 }}>cinza: meta · cor: aportado · verde: sobra real</T>
    </Cartao>
  );
}

export function PlanosMensais({ e }: { e: any }) {
  const t = useTema();
  if (!FC.planoMensal || (FC.db.temTabela && !FC.db.temTabela("planos_mensais"))) return null;
  const planos = [...(e.base.planosMensais || [])].sort((a, b) => b.mes.localeCompare(a.mes));
  const atual = FC.datas.hoje().slice(0, 7);
  const ultimo = planos[0] ? planos[0].mes : null;
  const proximo = ultimo && ultimo >= atual ? FC.rendaMes.seguinte(ultimo) : atual;
  const criar = async () => {
    try {
      const r = FC.planoMensal.gera(e, proximo);
      await FC.db.inserir("planos_mensais", r);
      await depoisDeMudar(`Rascunho de ${nomeMes(proximo)} criado`);
    } catch (err) { ui.erro(err); }
  };
  return (
    <Secao titulo="Plano de cada mês" sub="o que era para investir e onde, e o que foi feito"
      direita={<Botao pequeno onPress={criar}>{`Criar plano de ${FC.planoMensal.nomeMes(proximo)}`}</Botao>}>
      <View style={{ gap: t.espaco.e3 }}>
        {planos.length ? planos.map((p) => <CartaoMes key={p.id || p.mes} p={p} e={e} />)
          : <T v="p">Nenhum plano salvo ainda. Crie o do mês: ele congela a meta e os destinos, e o histórico não muda quando você mexer no plano.</T>}
        <Grafico12 planos={planos} />
      </View>
    </Secao>
  );
}
