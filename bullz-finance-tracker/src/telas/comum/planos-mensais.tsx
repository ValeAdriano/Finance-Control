/* Linha do tempo dos planos mensais (Marco 8): cada mês com o plano salvo
 * (previsto) e o que foi executado; detalhe por destino; criar o plano do
 * mês seguinte a partir da previsão; gráfico de 12 meses.
 *
 * Fechado, o cartão responde três perguntas, nesta ordem: quanto entrou,
 * quanto do plano foi cumprido e se algo pede atenção. O resto (destino a
 * destino, divisão por classe, renda) fica atrás do "ver detalhes". */
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { corCss, useTema } from "../../tema";
import { Botao, Cartao, Composicao, Item, Legenda, Lista, Pilula, Rs, Secao, T, Trilha } from "../../ui/kit";
import { Icone } from "../../ui/icone";
import { ui } from "../../ui/folha";
import { depoisDeMudar } from "./dados";
import FC from "../../nucleo";

// as cores dos pilares (tokens do tema): RF verde, Ações azul, Cripto roxo
const COR_GRUPO: Record<string, string> = { rf: "var(--s2)", acoes: "var(--s1)", cripto: "var(--s4)" };
const NOME_GRUPO: Record<string, string> = { rf: "Renda fixa", acoes: "Ações e FIIs", cripto: "Cripto" };
const COR: Record<string, string> = { ...COR_GRUPO, ativo: "var(--s1)", titulo_rf: "var(--s2)", pote: "var(--s2)", parcela: "var(--terra)", categoria: "var(--sref)" };
const corDe = (d: any) => (d.grupo && COR[d.grupo]) || (d.tipo === "categoria" ? COR[d.alvo] : COR[d.tipo]) || "var(--sref)";
const nomeMes = (m: string) => `${FC.planoMensal.nomeMes(m)} de ${m.slice(0, 4)}`;
const Maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS: Record<string, string> = { rascunho: "amarelo", ativo: "azul", fechado: "cinza" };
const brl = (v: number) => FC.fmt.brlTexto(v);
const pct0 = (v: number) => `${FC.fmt.num(v, 0)}%`;

/** um aviso de uma linha: ícone, texto e cor do estado */
function Aviso({ cor, icone, children }: { cor: "amarelo" | "vermelho" | "verde" | "cinza"; icone: "alerta" | "check" | "info"; children: React.ReactNode }) {
  const t = useTema();
  const fg = cor === "amarelo" ? t.cores.amarelo : cor === "vermelho" ? t.cores.vermelho : cor === "verde" ? t.cores.verde : t.cores.ink2;
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <View style={{ marginTop: 1 }}><Icone nome={icone} tam={16} cor={fg} /></View>
      <T style={{ flex: 1, fontSize: 13, lineHeight: 18, color: cor === "cinza" ? t.cores.ink2 : fg }}>{children}</T>
    </View>
  );
}

/** a situação de um destino: no alvo, passou ou falta */
function situacao(x: any, fechado: boolean): { texto: string; cor: string } {
  if (x.desvio < -0.5) return { texto: `${fechado ? "faltou" : "faltam"} ${brl(-x.desvio)}`, cor: "vermelho" };
  if (x.desvio > 0.5) return { texto: `+${brl(x.desvio)} acima`, cor: "cinza" };
  return { texto: "no alvo", cor: "verde" };
}

/** os aportes de um destino num resumo curto (o ativo já está no título) */
function resumoAportes(x: any) {
  const aportes = x.aportes || [];
  if (!aportes.length) return Number(x.aportado) > 0 ? "" : "nenhum aporte ainda";
  const datas = [...new Set(aportes.map((a: any) => FC.datas.br(a.data).slice(0, 5)))];
  return aportes.length === 1 ? `aporte em ${datas[0]}` : `${aportes.length} aportes · ${datas.join(", ")}`;
}

/** tudo o que o cartão de um mês precisa: números, avisos e ações */
function usePlano(p: any, e: any) {
  const t = useTema();
  const i = FC.planoMensal.indicadores(p, e);
  const destinos = FC.planoMensal.comGrupo(p.destinos, e.base);
  const fechado = p.status === "fechado";
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
  const fechar = async () => {
    const ok = await ui.confirma(`O que foi aportado em ${nomeMes(p.mes)} fica congelado no histórico. Aportes lançados depois com data deste mês não entram mais na conta.`,
      { titulo: `Fechar ${nomeMes(p.mes)}?`, botao: "Fechar o mês" });
    if (ok) await salva({ status: "fechado", fechado_em: new Date().toISOString(), ...FC.planoMensal.realizado(p, e) }, `Plano de ${nomeMes(p.mes)} fechado`);
  };

  // quanto do plano foi cumprido (o que passou num destino não cobre o que faltou em outro)
  const cumprido = Math.min(100, i.pct_executado || 0);
  const acima = i.investido - i.meta;
  const falta = Math.max(0, i.meta - i.aportado);
  const linhaMeta = i.meta <= 0 ? "sem meta definida"
    : falta > 0.5 ? `${fechado ? "faltou" : "faltam"} ${brl(falta)} para cumprir o plano de ${brl(i.meta)}`
    : acima > 0.5 ? `plano de ${brl(i.meta)} cumprido, com ${brl(acima)} a mais`
    : `plano de ${brl(i.meta)} cumprido`;
  const corPct = i.cem_por_cento ? t.cores.verde : t.cores.acento;

  // avisos: só o que pede atenção (o "tudo certo" já aparece no número)
  const hierarquiaOff = i.hierarquia_aplica && i.hierarquia_respeitada === false;
  const avisos: React.ReactNode[] = [];
  if (i.fora_do_plano > 0.5) avisos.push(<Aviso key="fora" cor="vermelho" icone="alerta">{`${brl(i.fora_do_plano)} aportados fora do plano`}</Aviso>);
  if (hierarquiaOff) avisos.push(
    <Aviso key="hier" cor="amarelo" icone="alerta">
      {`Fora da hierarquia: ${i.hierarquia_violacoes[0] || "a divisão do mês saiu das faixas"}`}
      {i.hierarquia_violacoes.length > 1 ? ` (e mais ${i.hierarquia_violacoes.length - 1})` : ""}
      {i.violacao_aceita ? ". Você aceitou isso ao ativar o plano." : ""}
    </Aviso>);
  return { i, destinos, fechado, cumprido, linhaMeta, corPct, hierarquiaOff, avisos, ativar, fechar };
}
type Plano = ReturnType<typeof usePlano>;

/** "ver detalhes" / "ocultar detalhes" */
function Alternar({ aberto, onPress, rotulo }: { aberto: boolean; onPress: () => void; rotulo: string }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: aberto }}
      style={({ pressed }: any) => ({ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
      <T style={{ fontSize: 13.5, fontWeight: "500", color: t.cores.acento }}>{aberto ? "Ocultar detalhes" : rotulo}</T>
      <View style={{ transform: [{ rotate: aberto ? "-90deg" : "90deg" }] }}><Icone nome="chevron" tam={14} cor={t.cores.acento} /></View>
    </Pressable>
  );
}

/** destino a destino, divisão por classe, renda e as ações do mês */
function Detalhes({ p, pl }: { p: any; pl: Plano }) {
  const t = useTema();
  const { i, destinos, fechado, hierarquiaOff } = pl;
  const grupos = (["rf", "acoes", "cripto"] as const).filter((g) => i.divisao_executada && i.divisao_executada[g] > 0.05);
  const rendaPrevista = (p.renda_prevista || []).filter((r: any) => Number(r.valor) > 0);
  const notas = (p.contexto && p.contexto.mes_anterior) || [];
  return (
    <View style={{ gap: 16 }}>
      <Lista style={{ boxShadow: "none" } as any}>
        {i.execucao.map((x: any, k: number) => {
          const s = situacao(x, fechado);
          const d = destinos[k];
          return (
            <Item key={k}
              esquerda={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corCss(t.cores, corDe(d || x)) } as any} />}
              titulo={<T style={{ fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{Maiuscula(x.rotulo || "")}</T>}
              detalhe={<T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={2}>
                <T style={{ fontSize: 13, fontWeight: "500", color: s.cor === "vermelho" ? t.cores.vermelho : s.cor === "verde" ? t.cores.verde : t.cores.ink2 }}>{s.texto}</T>
                {[resumoAportes(x), d && d.sugestao ? `sugestão: ${d.sugestao}` : ""].filter(Boolean).map((z) => ` · ${z}`).join("")}
              </T>}
              valores={<View style={{ alignItems: "flex-end", gap: 2 }}>
                <Rs style={{ fontWeight: "600" }}>{brl(x.aportado)}</Rs>
                <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`de ${brl(x.previsto)}`}</T>
              </View>} />
          );
        })}
        {i.fora.map((a: any, k: number) => (
          <Item key={"f" + k}
            esquerda={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cores.vermelho }} />}
            titulo={<T style={{ fontWeight: "600", fontSize: 15 }}>{a.ticker || a.titulo}</T>}
            detalhe={`fora do plano · ${FC.datas.br(a.data).slice(0, 5)}`}
            valores={<Rs style={{ fontWeight: "600" }}>{brl(a.valor)}</Rs>} />
        ))}
      </Lista>

      {grupos.length ? (
        <View>
          <T v="rot" style={{ marginBottom: 8 }}>Divisão do que entrou</T>
          <Composicao altura={10} partes={grupos.map((g) => ({ valor: i.divisao_executada[g], cor: COR_GRUPO[g] }))} />
          <Legenda itens={grupos.map((g) => ({ cor: COR_GRUPO[g], tipo: "quadrado" as const, rotulo: `${NOME_GRUPO[g]} ${pct0(i.divisao_executada[g])}` }))} />
          {hierarquiaOff && i.hierarquia_violacoes.length > 1 ? (
            <View style={{ gap: 4, marginTop: 10 }}>
              {i.hierarquia_violacoes.map((v: string, k: number) => <T key={k} v="peq">{`· ${v}`}</T>)}
            </View>
          ) : null}
        </View>
      ) : null}

      {rendaPrevista.length || i.renda_real != null || notas.length ? (
        <View style={{ gap: 4 }}>
          {rendaPrevista.length ? <T v="peq">{`Renda prevista ${brl(i.renda_prevista)}: ${rendaPrevista.map((r: any) => `${r.origem || r.nome} ${brl(r.valor)}`).join(" + ")}`}</T> : null}
          {i.renda_real != null ? <T v="peq">{`Renda real ${brl(i.renda_real)}${i.sobra_real != null ? ` · sobra ${brl(i.sobra_real)}` : ""}`}</T> : null}
          {notas.map((c: string, k: number) => <T key={k} v="peq">{Maiuscula(c)}</T>)}
        </View>
      ) : null}

      {p.status === "rascunho" ? <Botao onPress={pl.ativar} style={{ alignSelf: "flex-start" }}>Ativar este plano</Botao> : null}
      {p.status === "ativo" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Botao variante="sec" pequeno onPress={pl.fechar}>{`Fechar ${FC.planoMensal.nomeMes(p.mes)}`}</Botao>
          <T v="dica" style={{ flexShrink: 1 }}>congela o realizado no histórico</T>
        </View>
      ) : null}
    </View>
  );
}

/** o mês em aberto (ativo ou rascunho): cartão inteiro, com os destinos à vista */
function CartaoMes({ p, e }: { p: any; e: any }) {
  const [aberto, setAberto] = useState(true);
  const pl = usePlano(p, e);
  const { i, cumprido, linhaMeta, corPct, avisos } = pl;
  return (
    <Cartao>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <T v="h3">{Maiuscula(nomeMes(p.mes))}</T>
        <Pilula cor={STATUS[p.status]}>{p.status}</Pilula>
        {p.origem === "reconstruido" ? <Pilula cor="cinza" semPonto>reconstruído</Pilula> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
        <View style={{ flexShrink: 1 }}>
          <T v="peq">investido no mês</T>
          <Rs style={{ fontSize: 28, lineHeight: 34, fontWeight: "600", letterSpacing: -0.6 }}>{brl(i.investido)}</Rs>
        </View>
        {i.meta > 0 ? (
          <View style={{ alignItems: "flex-end" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {i.cem_por_cento ? <Icone nome="check" tam={16} cor={corPct} /> : null}
              <T num style={{ fontSize: 17, fontWeight: "600", color: i.cem_por_cento ? corPct : undefined }}>{pct0(cumprido)}</T>
            </View>
            <T v="peq">do plano</T>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 10 }}><Trilha altura={8} pct={cumprido} cor={corPct} /></View>
      <T v="peq" style={{ marginTop: 8 }}>{linhaMeta}</T>
      {avisos.length ? <View style={{ gap: 6, marginTop: 12 }}>{avisos}</View> : null}

      <View style={{ marginTop: 12 }}><Alternar aberto={aberto} onPress={() => setAberto(!aberto)} rotulo="Ver destinos e detalhes" /></View>
      {aberto ? <View style={{ marginTop: 12 }}><Detalhes p={p} pl={pl} /></View> : null}
    </Cartao>
  );
}

/** um mês fechado: uma linha compacta que abre os detalhes */
function LinhaMes({ p, e }: { p: any; e: any }) {
  const t = useTema();
  const [aberto, setAberto] = useState(false);
  const pl = usePlano(p, e);
  const { i, cumprido, linhaMeta, corPct, avisos } = pl;
  return (
    <View>
      <Pressable onPress={() => setAberto(!aberto)} accessibilityRole="button" accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${nomeMes(p.mes)}: ${brl(i.investido)} investidos, ${pct0(cumprido)} do plano`}
        style={({ pressed, hovered }: any) => ({ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed || hovered ? t.cores.campo : "transparent" })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
            <T style={{ fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{Maiuscula(nomeMes(p.mes))}</T>
            {p.origem === "reconstruido" ? <Pilula cor="cinza" semPonto>reconstruído</Pilula> : null}
            {avisos.length ? <Icone nome="alerta" tam={15} cor={i.fora_do_plano > 0.5 ? t.cores.vermelho : t.cores.amarelo} /> : null}
          </View>
          <Rs style={{ fontWeight: "600" }}>{brl(i.investido)}</Rs>
          <T num style={{ width: 48, textAlign: "right", fontSize: 13.5, fontWeight: "600", color: i.cem_por_cento ? corPct : t.cores.ink2 }}>{pct0(cumprido)}</T>
          <View style={{ transform: [{ rotate: aberto ? "-90deg" : "90deg" }] }}><Icone nome="chevron" tam={14} cor={t.cores.ink3} /></View>
        </View>
        <View style={{ marginTop: 8, marginRight: 22 }}><Trilha altura={4} pct={cumprido} cor={corPct} /></View>
      </Pressable>
      {aberto ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
          <T v="peq">{linhaMeta}</T>
          {avisos.length ? <View style={{ gap: 6 }}>{avisos}</View> : null}
          <Detalhes p={p} pl={pl} />
        </View>
      ) : null}
    </View>
  );
}

/** meta × investido dos últimos 12 meses (só aparece com 2 meses ou mais) */
function Grafico12({ planos, e }: { planos: any[]; e: any }) {
  const t = useTema();
  const ult = [...planos].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  if (ult.length < 2) return null;
  const linhas = ult.map((p) => {
    const i = FC.planoMensal.indicadores(p, e);
    return { mes: p.mes, meta: i.meta, investido: i.investido, sobra: Number(p.sobra_real) || 0 };
  });
  const temSobra = linhas.some((l) => l.sobra > 0);
  const max = Math.max(1, ...linhas.map((l) => Math.max(l.meta, l.investido, temSobra ? l.sobra : 0)));
  const ALTURA = 120;
  const barra = (v: number, cor: string) => <View style={{ flex: 1, maxWidth: 12, height: Math.max(2, (Math.max(0, v) / max) * ALTURA), backgroundColor: cor, borderRadius: 3 }} />;
  return (
    <Cartao>
      <T v="rot" style={{ marginBottom: 12 }}>Meta × investido</T>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: ALTURA + 22 }}>
        {linhas.map((l) => (
          <View key={l.mes} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2, alignSelf: "stretch" }}>
              {barra(l.meta, t.cores.campo)}{barra(l.investido, l.investido >= l.meta - 0.5 ? t.cores.verde : t.cores.acento)}
              {temSobra ? barra(l.sobra, t.cores.ink3) : null}
            </View>
            <T style={{ fontSize: 11, color: t.cores.ink2 }}>{FC.planoMensal.nomeMes(l.mes).slice(0, 3)}</T>
          </View>
        ))}
      </View>
      <Legenda itens={[
        { cor: t.cores.campo, tipo: "quadrado", rotulo: "meta" },
        { cor: t.cores.verde, tipo: "quadrado", rotulo: "investido (meta batida)" },
        { cor: t.cores.acento, tipo: "quadrado", rotulo: "investido (abaixo da meta)" },
        ...(temSobra ? [{ cor: t.cores.ink3, tipo: "quadrado" as const, rotulo: "sobra real" }] : []),
      ]} />
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
  const abertos = planos.filter((p) => p.status !== "fechado");
  const fechados = planos.filter((p) => p.status === "fechado");
  const criar = async () => {
    try {
      const r = FC.planoMensal.gera(e, proximo);
      await FC.db.inserir("planos_mensais", FC.planoMensal.paraBanco(r));
      await depoisDeMudar(`Rascunho de ${nomeMes(proximo)} criado`);
    } catch (err) { ui.erro(err); }
  };
  return (
    <Secao titulo="Plano de cada mês" sub="quanto era para investir, onde, e o que foi feito"
      direita={<Botao pequeno variante="sec" icone="calendario" onPress={criar}>{`Planejar ${FC.planoMensal.nomeMes(proximo)}`}</Botao>}>
      <View style={{ gap: t.espaco.e3 }}>
        {!planos.length ? <T v="p">Nenhum plano salvo ainda. Crie o do mês: ele congela a meta e os destinos, e o histórico não muda quando você mexer no plano.</T> : null}
        {abertos.map((p) => <CartaoMes key={p.id || p.mes} p={p} e={e} />)}
        {fechados.length ? (
          <View>
            <T v="rot" style={{ marginBottom: 8, marginTop: abertos.length ? 4 : 0 }}>Meses anteriores</T>
            <Lista>{fechados.map((p) => <LinhaMes key={p.id || p.mes} p={p} e={e} />)}</Lista>
          </View>
        ) : null}
        <Grafico12 planos={planos} e={e} />
      </View>
    </Secao>
  );
}
