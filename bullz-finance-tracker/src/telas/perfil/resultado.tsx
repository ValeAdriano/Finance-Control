/* Resultado do perfil e plano — port de telas/perfil-resultado.js: o perfil
 * em destaque, os três eixos, o plano em passos, alocação atual contra alvo,
 * candidatos por classe e Aplicar plano (com o antes e o depois).
 * Rotas /perfil (resultado) e /perfil/relatorio. */
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTema } from "../../tema";
import { useEstado, rerender } from "../../estado/app";
import { Pagina } from "../../casca/casca";
import { Ajuda, Anel, B, BarraAlocacao, Botao, Cabecalho, Cartao, Detalhes, Grade, Item, Lista, Mensagem, Pilula, Roda, T, Vazio } from "../../ui/kit";
import { Segmentado } from "../../ui/campos";
import { Icone } from "../../ui/icone";
import { folhaForm, ui } from "../../ui/folha";
import { ItemAlerta } from "../comum/alertas";
import { abreAtivo } from "../comum/ativo";
import { depoisDeMudar } from "../comum/dados";
import { NumPasso, Regua, Relatorio } from "./relatorio";
import { abre, carrega } from "./fluxo";
import FC from "../../nucleo";

const pct0 = (v: number) => FC.fmt.num(v, 0) + "%";
const brl = (v: number) => FC.fmt.brlTexto(v, 0);
const COR_PERFIL: Record<string, string> = { conservador: "azul", moderado: "amarelo", arrojado: "verde" };

// recalcula com o que o app sabe agora; se falhar, o plano guardado na avaliação
export function recomendacao(reg: any, planoGuardado: any, modo: string) {
  const e = FC.estado;
  try {
    const res = FC.perfil.calcula(reg.respostas);
    return { res, rec: FC.recomendacao.gera({ resp: reg.respostas, res, prefs: e.prefs, dados: e.dados, base: e.base, mercado: e.mercado, modo }) };
  } catch (x) {
    console.error(x);
    return planoGuardado ? { res: FC.perfil.calcula(reg.respostas), rec: planoGuardado.plano } : null;
  }
}
FC.perfilRecomendacao = recomendacao;

function Eixo({ rotulo, valor, dica }: { rotulo: string; valor: number | null; dica: string }) {
  const t = useTema();
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><T style={{ fontSize: 14.5 }}>{rotulo}</T><Ajuda texto={dica} /></View>
        <B style={{ fontSize: 20 }}>{valor == null ? "—" : FC.fmt.int(valor)}</B>
      </View>
      <View>
        <Regua pct={valor || 0} />
        {[34, 64].map((p) => <View key={p} style={{ position: "absolute", top: 0, bottom: 0, width: 2, left: `${p}%` as any, backgroundColor: t.cores.bg, opacity: 0.8 }} />)}
      </View>
    </View>
  );
}

function Eixos({ res, rec }: { res: any; rec: any }) {
  const t = useTema();
  const nec = rec.necessidade, ref = rec.retorno_referencia;
  const linhaNec = nec == null ? "Informe o valor da meta para calcular o retorno que o objetivo exige."
    : nec === Infinity ? "Nem com 100% ao ano a meta fecha."
    : `O objetivo exige ${FC.fmt.num(nec * 100, 1)}% ao ano acima da inflação; o perfil rende em torno de ${FC.fmt.num(ref * 100, 1)}%.`;
  return (
    <View style={{ gap: t.espaco.e3, marginTop: t.espaco.e4 }}>
      <Eixo rotulo="Tolerância" valor={res.tolerancia} dica="O quanto você aguenta sentir uma queda. Vem das perguntas do bloco 4." />
      <Eixo rotulo="Capacidade" valor={res.capacidade} dica="O quanto você pode perder sem mexer na sua vida: renda, reserva, dívidas, prazo." />
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><T style={{ fontSize: 14.5 }}>Necessidade</T><Ajuda texto="O retorno real por ano que o seu objetivo exige. É uma conta, não uma pergunta." /></View>
          <B style={{ fontSize: 20 }}>{nec == null ? "—" : nec === Infinity ? "impossível" : FC.fmt.num(nec * 100, 1) + "%"}</B>
        </View>
        <T style={{ fontSize: 13.5, color: t.cores.ink2, lineHeight: 19.5 }}>{linhaNec}</T>
      </View>
    </View>
  );
}

function AlocacaoAtual({ rec }: { rec: any }) {
  const t = useTema();
  const aloc = rec.alocacao;
  const d = FC.estado.dados;
  const atual: Record<string, number> = {};
  if (d && d.alocacao) for (const l of d.alocacao) atual[l.chave] = l.pct_meta != null ? l.pct_meta : l.pct;
  const temCarteira = d && d.resumo && d.resumo.patrimonio > 0;
  const CL = FC.recomendacao.CLASSES;
  return (
    <Cartao>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <T v="h3">{rec.rotulos.alocacao}</T>
        <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{temCarteira ? "sua carteira × alvo do perfil" : "alvo do perfil"}</T>
      </View>
      <View style={{ gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        {CL.map((c: any, k: number) => {
          const alvo = aloc.classes[c.chave], at = atual[c.pilar], f = aloc.faixas[c.chave];
          return (
            <View key={c.chave} style={{ flexDirection: "row", alignItems: "center", gap: t.espaco.e2 }}>
              <View style={{ flex: 1, minWidth: 96 }}><B style={{ fontSize: 14 }}>{c.nome}</B><T style={{ fontSize: 12, color: t.cores.ink2 }}>{f ? `faixa ${f[0]} a ${f[1]}%` : ""}</T></View>
              <View style={{ flex: 2, flexDirection: "row" }}><BarraAlocacao pct={temCarteira && at != null ? at : alvo} alvo={temCarteira ? alvo : null} escala={100} cor={(t.cores as any)["s" + (k + 1)]} /></View>
              <View style={{ width: 64, alignItems: "flex-end" }}><B style={{ fontSize: 14 }}>{pct0(alvo)}</B>{temCarteira && at != null ? <T style={{ fontSize: 11.5, color: t.cores.ink2 }}>hoje {pct0(at)}</T> : null}</View>
            </View>
          );
        })}
      </View>
      {aloc.notas.length ? <View style={{ marginTop: t.espaco.e3, gap: 4 }}>{aloc.notas.map((n: any, i: number) => <T key={i} style={{ fontSize: 13.5, color: t.cores.ink2 }}>•  {n.texto}</T>)}</View> : null}
      <Detalhes rotulo="Como dividir a renda fixa">
        <View style={{ flexDirection: "row", gap: t.espaco.e2, marginVertical: t.espaco.e2 }}>
          {aloc.renda_fixa_divisao.map((x: any, i: number) => (
            <View key={i} style={{ flex: 1, backgroundColor: t.cores.campo, borderRadius: t.raios.sm, paddingVertical: 10, paddingHorizontal: 12 }}>
              <B style={{ fontSize: 18 }}>{x.pct}%</B><T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{x.rotulo}</T>
            </View>
          ))}
        </View>
        <T style={{ fontSize: 13, color: t.cores.ink2 }}>A reserva de emergência fica em pós-fixado com liquidez diária. CDI alto puxa para pós-fixado; juro real alto puxa para IPCA+.</T>
      </Detalhes>
    </Cartao>
  );
}

function Plano({ rec }: { rec: any }) {
  const t = useTema();
  const p = rec.plano;
  return (
    <Cartao>
      <T v="h3">Seu plano</T>
      <View style={{ gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
        {p.passos.map((s: any, k: number) => (
          <View key={k} style={{ flexDirection: "row", gap: 14 }}>
            <NumPasso n={k + 1} feito={s.feito} />
            <View style={{ flex: 1 }}>
              <B style={{ fontSize: 15 }}>{s.titulo}</B>
              <T style={{ fontSize: 14, color: t.cores.ink2, marginTop: 3, lineHeight: 20 }}>{s.resumo}</T>
              {s.valor_total != null || s.valor_mensal != null || s.meses != null ? (
                <T style={{ fontSize: 14, marginTop: 3 }}>
                  {s.valor_total != null ? <>Falta <B>{brl(s.valor_total)}</B></> : null}
                  {s.valor_mensal != null && s.valor_total != null ? " · " : null}
                  {s.valor_mensal != null ? <><B>{brl(s.valor_mensal)}</B> por mês</> : null}
                  {s.meses != null ? <> · chega em cerca de <B>{s.meses}</B> {s.meses === 1 ? "mês" : "meses"}</> : null}
                </T>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {p.aporte_mensal != null && !p.exclusivo ? <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: t.espaco.e3 }}>Aporte sugerido: a sobra informada vezes {FC.fmt.num(p.fator * 100, 0)}% (fator do perfil). Ajuste como quiser em Salário.</T> : null}
    </Cartao>
  );
}

function Candidatos({ rec }: { rec: any }) {
  const t = useTema();
  const c = rec.candidatos;
  if (rec.plano.exclusivo) return null;
  const educativo = rec.modo !== "completo";
  const total = Object.values<any[]>(c.por_classe).reduce((s, l) => s + l.length, 0);
  const NOMES: Record<string, string> = { acoes: "Ações e ETFs", fiis: "FIIs", cripto: "Cripto" };
  return (
    <Cartao>
      <T v="h3">{rec.rotulos.candidatos}</T>
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>{educativo
        ? "Itens da sua carteira, da lista de acompanhamento e do universo de Renda que passam nos quatro filtros do perfil. É uma lista de verificação, não uma indicação."
        : "Do que o painel conhece, o que passa nos quatro filtros do perfil, do maior score para o menor."}</T>
      {total ? Object.entries<any[]>(c.por_classe).filter(([, l]) => l.length).map(([k, l]) => (
        <View key={k} style={{ marginTop: t.espaco.e4 }}>
          <T style={{ fontSize: 12.5, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: t.cores.ink2, marginBottom: t.espaco.e2 }}>{NOMES[k]}</T>
          <Lista>
            {l.map((a: any) => (
              <Item key={a.ticker} onPress={() => abreAtivo(a.ticker)} alinhar="flex-start"
                titulo={<T style={{ fontWeight: "600", fontSize: 15 }}>{a.ticker} {a.estudar ? <Pilula cor="cinza">para estudar</Pilula> : null}<Text style={{ fontWeight: "400", fontSize: 12.5, color: t.cores.ink2 }}> · {a.origem === "carteira" ? "na carteira" : a.origem === "watchlist" ? "acompanhando" : "universo de Renda"}</Text></T>}
                detalhe={<View style={{ gap: 2 }}>
                  <T style={{ fontSize: 13, color: t.cores.ink2 }}>{a.motivo}</T>
                  {a.alerta ? <T style={{ fontSize: 13, color: t.cores.amarelo }}>⚠ {a.alerta}</T> : null}
                  <T style={{ fontSize: 13, color: t.cores.ink2 }}>Peso máximo {a.peso_max}% da carteira{a.peso_atual > 0 ? ` · hoje ${FC.fmt.num(a.peso_atual, 1)}%` : ""}</T>
                </View>}
                direita={<Anel score={a.score} cor={a.cor} />} />
            ))}
          </Lista>
        </View>
      )) : <T v="p" style={{ marginTop: t.espaco.e3 }}>Nenhum item da sua carteira ou lista passa nos filtros agora. Cadastre ativos em Investimentos para ver como cada um se encaixa no seu perfil.</T>}
      {c.descartados.length ? (
        <Detalhes rotulo={`Por que ${c.descartados.length} ficaram de fora`}>
          <Lista>{c.descartados.slice(0, 40).map((d: any, i: number) => <Item key={i} titulo={d.ticker} detalhe={d.motivos.join("; ")} detalheLinhas={4} />)}</Lista>
        </Detalhes>
      ) : null}
      <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: t.espaco.e4 }}>{rec.rotulos.aviso}</T>
    </Cartao>
  );
}

// ---------------------------------------------------------------- aplicar o plano
function aplicar(planoReg: any, rec: any) {
  const antes = { ...FC.estado.prefs.alocacao_alvo };
  const depois = FC.recomendacao.metasDoPlano(rec.alocacao);
  folhaForm({
    titulo: "Aplicar o plano às suas metas", salvar: "Aplicar plano",
    corpo: (api, defineSalvar) => {
      defineSalvar(async () => {
        try {
          await FC.db.gravaPrefs({ alocacao_alvo: depois });
          if (planoReg) await FC.perfilDb.decide(planoReg.id, "aplicado", antes, depois);
          await FC.perfilDb.evento("plano_aplicado");
          FC.db.log("plano_aplicado", { perfil: rec.perfil, versao: FC.PERFIL.versao });
          api.fechar();
          await carrega();
          await depoisDeMudar("Plano aplicado às suas metas");
        } catch (x) { ui.erro(x); }
      });
      return <AntesDepois rec={rec} antes={antes} depois={depois} />;
    },
  });
}
function AntesDepois({ rec, antes, depois }: { rec: any; antes: any; depois: any }) {
  const t = useTema();
  const linha = (a: React.ReactNode, b: React.ReactNode, c: React.ReactNode, cab?: boolean, k?: any) => (
    <View key={k} style={{ flexDirection: "row", gap: 8, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: t.cores.linha }}>
      <View style={{ flex: 1 }}>{typeof a === "string" ? <T style={{ fontSize: cab ? 12.5 : 14.5, color: cab ? t.cores.ink2 : t.cores.ink }}>{a}</T> : a}</View>
      <View style={{ width: 70, alignItems: "flex-end" }}>{typeof b === "string" ? <T style={{ fontSize: cab ? 12.5 : 14.5, color: cab ? t.cores.ink2 : t.cores.ink }}>{b}</T> : b}</View>
      <View style={{ width: 70, alignItems: "flex-end" }}>{c}</View>
    </View>
  );
  return (
    <View>
      <T v="p">As metas de alocação de Ajustes passam a ser as do perfil {FC.perfil.nomeDoPerfil(rec.perfil)}. O rebalanceamento e o “onde colocar o aporte do mês” passam a apontar para a classe mais abaixo do alvo.</T>
      <View style={{ marginTop: t.espaco.e4 }}>
        {linha("", "Antes", <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>Depois</T>, true)}
        {FC.PILARES.filter((p: any) => depois[p.chave] != null || antes[p.chave]).map((p: any) => {
          const muda = (antes[p.chave] || 0) !== depois[p.chave];
          return linha(p.nome, pct0(antes[p.chave] || 0), <B style={{ fontSize: 14.5, color: muda ? t.cores.acento : t.cores.ink }}>{pct0(depois[p.chave] || 0)}</B>, false, p.chave);
        })}
      </View>
      <T style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: t.espaco.e4 }}>Dá para voltar atrás em Ajustes → Metas de alocação.</T>
    </View>
  );
}
async function recusar(planoReg: any, rec: any) {
  if (!(await ui.confirma("As metas atuais continuam como estão e a sua escolha fica registrada. Dá para aplicar depois.", { titulo: "Manter as metas atuais?", botao: "Manter" }))) return;
  try {
    if (planoReg) await FC.perfilDb.decide(planoReg.id, "recusado", FC.estado.prefs.alocacao_alvo, null);
    await FC.perfilDb.evento("plano_recusado");
    FC.db.log("plano_recusado", { perfil: rec.perfil, versao: FC.PERFIL.versao });
    await carrega();
    rerender();
    ui.aviso("Metas mantidas");
  } catch (x) { ui.erro(x); }
}

// ---------------------------------------------------------------- tela
export default function Perfil() {
  const t = useTema();
  const est = useEstado();
  const { aba: abaParam } = useLocalSearchParams<{ aba?: string }>();
  const aba = abaParam === "relatorio" ? "relatorio" : "resultado";
  const [carregando, setCarregando] = useState(!est.perfil);
  useEffect(() => { if (!est.perfil) carrega().then(() => { setCarregando(false); rerender(); }); }, [est.perfil]);
  const e = est.perfil;
  if (carregando || !e) {
    return <Pagina estreita><View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: 16 }}><Roda /><T style={{ color: t.cores.ink2 }}>Carregando seu perfil…</T></View></Pagina>;
  }
  if (e.indisponivel) {
    return <Pagina estreita><Cabecalho titulo="Perfil do investidor" sub="Seu perfil e o plano que sai dele." />
      <Mensagem tipo="alerta" icone="alerta">O perfil ainda não está disponível nesta instalação: aplique o schema.sql atualizado no Supabase.</Mensagem></Pagina>;
  }
  if (!e.atual) {
    return (
      <Pagina estreita>
        <Cabecalho titulo="Perfil do investidor" sub="Três minutos para o seu plano." />
        <Cartao>
          <Vazio icone="bussola" titulo={e.rascunho ? "Você parou no meio" : "Você ainda não fez o seu perfil"}
            texto={e.rascunho ? "Suas respostas estão salvas. Continue de onde parou." : "Cerca de 20 perguntas, uma por tela, e você recebe o perfil, quanto guardar por mês e a alocação por classe."}
            acao={<Botao onPress={() => abre({ origem: "cadastro" })}>{e.rascunho ? "Continuar" : "Começar"}</Botao>} />
        </Cartao>
      </Pagina>
    );
  }
  const r = recomendacao(e.atual, e.plano, e.modo);
  if (!r) return <Pagina estreita><Mensagem tipo="erro">Não consegui montar o resultado.</Mensagem></Pagina>;
  const { res, rec } = r;
  const rev = FC.perfil.revisao(e.atual);
  const planoReg = e.plano;
  return (
    <Pagina estreita>
      <Cabecalho titulo="Perfil do investidor"
        sub={`Avaliado em ${FC.datas.br(e.atual.criado_em.slice(0, 10))} · válido até ${FC.datas.br(e.atual.valido_ate)} · ${e.atual.versao_modelo}`}
        direita={<View dataSet={{ imprimir: "nao" }} ><Botao variante="sec" icone="atualizar" onPress={() => { FC.perfilDb.evento("revisao_aberta"); abre({ origem: "revisao" }); }}>Refazer</Botao></View>} />
      <View dataSet={{ imprimir: "nao" }} style={{ marginBottom: t.espaco.e4 }}>
        <Segmentado valor={aba} aoMudar={(v) => router.replace((v === "relatorio" ? "/perfil/relatorio" : "/perfil") as any)}
          opcoes={[{ v: "resultado", rotulo: "Resultado" }, { v: "relatorio", rotulo: "Relatório" }]} />
      </View>
      {rev.estado === "obrigatoria" ? <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}>Este perfil passou de 24 meses. Refaça para o plano continuar valendo.</Mensagem>
        : rev.estado === "sugerida" ? <Mensagem tipo="info" icone="info" style={{ marginBottom: t.espaco.e4 }}>Faz mais de 12 meses. Vale revisar se a sua situação mudou.</Mensagem> : null}
      {aba === "relatorio" ? <Relatorio e={e} res={res} rec={rec} /> : (
        <View>
          <Cartao style={{ padding: 24 }}>
            <T style={{ fontSize: 13, color: t.cores.ink2, fontWeight: "500" }}>Seu perfil</T>
            <T style={{ fontSize: 40, lineHeight: 46, fontWeight: "600", letterSpacing: -1.2, marginTop: 2, marginBottom: t.espaco.e2 }}>{res.faixa.nome}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pilula cor={COR_PERFIL[res.perfil]}>{`score ${res.score}`}</Pilula>
              {res.consistencia === "baixa" ? <Pilula cor="amarelo">baixa consistência</Pilula> : null}
              {res.precisao === "reduzida" ? <Pilula cor="cinza">precisão reduzida</Pilula> : null}
            </View>
            <T v="p" style={{ marginTop: t.espaco.e3 }}>{res.limitado_por === "capacidade"
              ? "O perfil é o menor entre tolerância e capacidade, e aqui o limite é a sua situação financeira."
              : "O perfil é o menor entre tolerância e capacidade, e aqui o limite é o quanto você se sente confortável com oscilação."}</T>
            {res.tetos.length ? <View style={{ marginTop: t.espaco.e3, gap: 4 }}>{res.tetos.map((x: any, i: number) => <T key={i} style={{ fontSize: 13.5, color: t.cores.ink2 }}>•  {FC.recomendacao.texto(x.regra, x)}</T>)}</View> : null}
            <Eixos res={res} rec={rec} />
          </Cartao>
          {rec.conflitos.length ? (
            <Lista style={{ marginTop: t.espaco.e4 }}>
              {rec.conflitos.map((c: any, i: number) => {
                const s = c.saidas;
                const extra = s ? [s.aporte_necessario != null ? `• Aportar ${brl(s.aporte_necessario)} por mês, mantendo o prazo;` : "",
                  s.prazo_necessario != null ? `• ou esperar ${FC.fmt.num(s.prazo_necessario, 1)} anos, com o aporte atual;` : "",
                  s.meta_possivel != null ? `• ou ajustar a meta para cerca de ${brl(s.meta_possivel)}.` : ""].filter(Boolean).join("\n") : "";
                return <ItemAlerta key={i} a={{ nivel: c.nivel, titulo: c.titulo, texto: c.texto + (extra ? "\n" + extra : "") }} />;
              })}
            </Lista>
          ) : null}
          <Grade colunas={2} style={{ marginTop: t.espaco.e4 }}><Plano rec={rec} /><AlocacaoAtual rec={rec} /></Grade>
          <View style={{ marginTop: t.espaco.e4 }}><Candidatos rec={rec} /></View>
          {rec.avisos.length ? <View style={{ marginTop: t.espaco.e4, gap: 4 }}>{rec.avisos.map((a: string, i: number) => <T key={i} style={{ fontSize: 13.5, color: t.cores.ink2 }}>•  {a}</T>)}</View> : null}
          {planoReg ? (
            <Cartao style={{ marginTop: t.espaco.e4, gap: t.espaco.e2 }}>
              {planoReg.decisao === "aplicado" ? (
                <>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Icone nome="check" tam={16} cor={t.cores.verde} /><T>Plano aplicado em {FC.datas.br((planoReg.decidido_em || "").slice(0, 10))}.</T></View>
                  <Botao variante="sec" pequeno onPress={() => aplicar(planoReg, rec)}>Aplicar de novo com os números de hoje</Botao>
                </>
              ) : planoReg.decisao === "recusado" ? (
                <>
                  <T>Você manteve as metas atuais em {FC.datas.br((planoReg.decidido_em || "").slice(0, 10))}.</T>
                  <Botao onPress={() => aplicar(planoReg, rec)}>Aplicar plano</Botao>
                </>
              ) : (
                <>
                  <T>Aplicar grava a alocação-alvo nas suas metas, depois de mostrar o antes e o depois.</T>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    <Botao onPress={() => aplicar(planoReg, rec)}>Aplicar plano</Botao>
                    <Botao variante="sec" onPress={() => recusar(planoReg, rec)}>Manter minhas metas</Botao>
                  </View>
                </>
              )}
            </Cartao>
          ) : null}
        </View>
      )}
      <T centro style={{ fontSize: 12.5, color: t.cores.ink2, marginTop: 48 }}>{rec.rotulos.aviso}</T>
    </Pagina>
  );
}
