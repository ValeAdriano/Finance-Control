/* Relatório do perfil: o porquê de cada recomendação — port de
 * telas/perfil-relatorio.js. Exporta em PDF (impressão no web, expo-print no
 * celular) e o JSON do titular. */
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTema } from "../../tema";
import { B, Botao, Cartao, Codigo, Grade, Kpi, Kpis, T } from "../../ui/kit";
import { ui } from "../../ui/folha";
import FC from "../../nucleo";

const brl = (v: number) => FC.fmt.brlTexto(v, 0);
const quando = (iso: any) => (iso ? FC.datas.br(String(iso).slice(0, 10)) : "—");
const ROTULO_ORIGEM: Record<string, string> = { cadastro: "Cadastro", migracao: "Primeiro login após a novidade", revisao: "Revisão", comportamento: "Alerta de comportamento" };

export function Regua({ pct }: { pct: number }) {
  const t = useTema();
  return (
    <View style={{ height: 10, borderRadius: 6, backgroundColor: t.cores.campo, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct || 0))}%` as any, borderRadius: 6, backgroundColor: "#0a84ff",
        ...(Platform.OS === "web" ? { backgroundImage: "linear-gradient(90deg, #0a84ff, #5e5ce6)" } : {}) } as any} />
    </View>
  );
}

/** .rel-lista: linhas com rótulo à esquerda e número à direita */
export function RelLista({ itens }: { itens: Array<{ rotulo: React.ReactNode; sub?: React.ReactNode; valor?: React.ReactNode }> }) {
  const t = useTema();
  return (
    <View>
      {itens.map((x, k) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: t.espaco.e3, paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderTopColor: t.cores.linha }}>
          <View style={{ flex: 1, gap: 2 }}>
            {typeof x.rotulo === "string" ? <T style={{ fontSize: 14 }}>{x.rotulo}</T> : x.rotulo}
            {x.sub != null ? <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{x.sub}</T> : null}
          </View>
          {x.valor != null ? (typeof x.valor === "string" ? <B style={{ fontSize: 14 }}>{x.valor}</B> : x.valor) : null}
        </View>
      ))}
    </View>
  );
}
function H4({ children, topo }: { children: React.ReactNode; topo?: boolean }) {
  const t = useTema();
  return <T style={{ fontSize: 13, color: t.cores.ink2, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: t.espaco.e2, marginTop: topo ? t.espaco.e4 : 0 }}>{children}</T>;
}

/** cartão compartilhado com o Início: plano contra realidade */
export function CartaoPlanoRealidade({ p, embutido = false }: { p: any; embutido?: boolean }) {
  const t = useTema();
  const tem = p.aporte_sugerido != null;
  const pctAporte = tem && p.aporte_sugerido > 0 ? Math.min(100, (p.aporte_feito / p.aporte_sugerido) * 100) : 0;
  const miolo = (
    <View>
      {embutido ? null : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T v="h3">Plano contra realidade</T>
          <Botao variante="texto" pequeno onPress={() => router.push("/perfil" as any)}>Ver plano</Botao>
        </View>
      )}
      <Grade colunas={2} style={{ marginTop: t.espaco.e3 }}>
        <View>
          <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>Aporte do mês</T>
          <T style={{ fontSize: 15, marginTop: 2, marginBottom: 8 }}><B>{brl(p.aporte_feito)}</B>{tem ? ` de ${brl(p.aporte_sugerido)}` : ""}</T>
          {tem ? <Regua pct={pctAporte} /> : null}
        </View>
        {p.reserva ? (
          <View>
            <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>Reserva de emergência</T>
            <T style={{ fontSize: 15, marginTop: 2, marginBottom: 8 }}><B>{FC.fmt.num(p.reserva.meses_atual, 1)}</B> de {p.reserva.meses_alvo} meses</T>
            <Regua pct={(p.reserva.meses_atual / p.reserva.meses_alvo) * 100} />
          </View>
        ) : null}
      </Grade>
      {p.desvios.length ? (
        <View style={{ marginTop: t.espaco.e3 }}>
          <RelLista itens={p.desvios.map((d: any) => ({ rotulo: d.nome, valor: <T style={{ fontWeight: "600", fontSize: 14, color: Math.abs(d.desvio) > 5 ? t.cores.amarelo : t.cores.ink }}>{FC.fmt.num(d.atual, 0)}% <T style={{ fontSize: 12, color: t.cores.ink2, fontWeight: "400" }}>alvo {FC.fmt.num(d.alvo, 0)}%</T></T> }))} />
        </View>
      ) : null}
    </View>
  );
  return embutido ? miolo : <Cartao style={{ marginBottom: t.espaco.e3 }}>{miolo}</Cartao>;
}

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  const t = useTema();
  return (
    <Cartao style={{ marginTop: t.espaco.e3 }}>
      <T v="h3">{titulo}</T>
      {sub ? <T style={{ fontSize: 13, color: t.cores.ink2 }}>{sub}</T> : null}
      <View style={{ marginTop: t.espaco.e3 }}>{children}</View>
    </Cartao>
  );
}

function Historico() {
  const t = useTema();
  const [l, setL] = useState<any[]>([]);
  useEffect(() => { FC.perfilDb.historico().then(setL).catch(() => {}); }, []);
  return (
    <Bloco titulo="Histórico" sub="Cada avaliação fica guardada como foi feita. Nada é sobrescrito.">
      <View style={{ paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: t.cores.linha, gap: t.espaco.e3 }}>
        {l.map((r, k) => {
          const ant = l[k + 1];
          const dif = ant ? FC.perfil.diferencas(ant, r) : [];
          return (
            <View key={r.id || k}>
              <T style={{ fontSize: 14 }}><B>{quando(r.criado_em)}</B> · {FC.perfil.nomeDoPerfil(r.perfil)} · score {r.score} <T style={{ fontSize: 12, color: t.cores.ink2 }}>({ROTULO_ORIGEM[r.origem] || r.origem}, {r.versao_modelo})</T></T>
              <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{ant ? (dif.length ? `Mudou: ${dif.slice(0, 6).map((d: any) => `${d.pergunta.replace(/\?$/, "")}: ${d.de} → ${d.para}`).join("; ")}${dif.length > 6 ? ` e mais ${dif.length - 6}` : ""}.` : "Mesmas respostas da avaliação anterior.") : "Primeira avaliação."}</T>
            </View>
          );
        })}
      </View>
    </Bloco>
  );
}

// ---------------------------------------------------------------- exportar
function htmlRelatorio(e: any, res: any, rec: any) {
  const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[c]);
  const li = (a: any, b?: any) => `<li><span>${esc(a)}</span>${b != null ? `<b>${esc(b)}</b>` : ""}</li>`;
  const contrib = FC.perfil.contribuicoes(e.atual.respostas);
  const eixo = (k: string, nome: string) => `<h4>${nome}</h4><ul>${contrib.filter((x: any) => x.eixo === k).map((x: any) => li(`${x.pergunta} — ${x.resposta}`, `${x.pontos}/${x.max}`)).join("")}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório do perfil · Bullz</title>
  <style>body{font:14px -apple-system,Segoe UI,Arial,sans-serif;color:#1d1d1f;padding:24px}h1{font-size:24px}h3{margin-top:24px}h4{font-size:12px;text-transform:uppercase;color:#6e6e73}
  ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-top:1px solid #eee}small{color:#6e6e73}</style></head><body>
  <h1>Relatório do perfil do investidor</h1>
  <p>Perfil <b>${esc(res.faixa.nome)}</b> · score ${res.score} · tolerância ${res.tolerancia} · capacidade ${res.capacidade} · consistência ${res.consistencia === "alta" ? "alta" : "baixa"}</p>
  <p><small>Avaliado em ${quando(e.atual.criado_em)} (${esc(ROTULO_ORIGEM[e.atual.origem] || e.atual.origem)}), válido até ${quando(e.atual.valido_ate)}, modelo ${esc(e.atual.versao_modelo)}.</small></p>
  <h3>Por que este perfil</h3>${eixo("capacidade", "Capacidade")}${eixo("tolerancia", "Tolerância")}
  <h3>Plano</h3><ol>${rec.plano.passos.map((s: any) => `<li><span><b>${esc(s.titulo)}</b><br><small>${esc(s.texto)}</small></span></li>`).join("")}</ol>
  <h3>Alocação alvo</h3><ul>${FC.recomendacao.CLASSES.map((c: any) => li(c.nome, rec.alocacao.classes[c.chave] + "%")).join("")}</ul>
  <h3>Por que cada recomendação</h3><ul>${rec.alocacao.notas.map((n: any) => li(n.texto)).join("")}${rec.conflitos.map((c: any) => li(`${c.titulo}. ${c.texto}`)).join("")}</ul>
  <p><small>Este relatório é uma ferramenta pessoal baseada no questionário que você respondeu. Não é recomendação de investimento nem substitui a análise de um profissional habilitado.</small></p>
  </body></html>`;
}
async function exportaPdf(e: any, res: any, rec: any) {
  try {
    if (Platform.OS === "web") { document.title = "Relatório do perfil · Bullz"; window.print(); return; }
    const { uri } = await Print.printToFileAsync({ html: htmlRelatorio(e, res, rec) });
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Relatório do perfil" });
  } catch (x) { ui.erro(x); }
}
async function exportaJson() {
  try {
    const dados = await FC.perfilDb.exporta();
    await FC.baixar(`perfil-bullz-${FC.datas.hoje()}.json`, JSON.stringify({ app: "bullz", tipo: "perfil", gerado: new Date().toISOString(), ...dados }, null, 2));
  } catch (x) { ui.erro(x); }
}

export function Relatorio({ e, res, rec }: { e: any; res: any; rec: any }) {
  const t = useTema();
  const r = e.atual;
  const contrib = FC.perfil.contribuicoes(r.respostas);
  const blocoEixo = (eixo: string, titulo: string) => {
    const l = contrib.filter((x: any) => x.eixo === eixo).sort((a: any, b: any) => a.pontos / (a.max || 1) - b.pontos / (b.max || 1));
    return (
      <View>
        <H4>{titulo}</H4>
        <RelLista itens={l.map((x: any) => ({ rotulo: x.pergunta, sub: `${x.resposta}${x.neutro ? " (sem resposta: pontos neutros)" : ""}`, valor: `${x.pontos}/${x.max}` }))} />
      </View>
    );
  };
  const dec = e.plano ? e.plano.decisao : null;
  const pcr = FC.recomendacao.planoContraRealidade({ plano: rec.plano, alocacaoAlvo: FC.estado.prefs.alocacao_alvo, dados: FC.estado.dados, base: FC.estado.base });
  const comport = rec.conflitos.filter((c: any) => ["carteira_acima_perfil", "vendas_em_queda"].includes(c.id));
  return (
    <View>
      <View dataSet={{ imprimir: "nao" }} style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
        <T style={{ fontSize: 13, color: t.cores.ink2 }}>Relatório do perfil</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Botao variante="sec" pequeno icone="exportar" onPress={exportaJson}>Baixar JSON</Botao>
          <Botao variante="sec" pequeno icone="recibo" onPress={() => exportaPdf(e, res, rec)}>Exportar PDF</Botao>
        </View>
      </View>
      <Bloco titulo="Resumo">
        <Kpis>
          <Kpi pequeno rotulo="Perfil" valor={res.faixa.nome} />
          <Kpi pequeno rotulo="Score" valor={String(res.score)} />
          <Kpi pequeno rotulo="Tolerância" valor={String(res.tolerancia)} />
          <Kpi pequeno rotulo="Capacidade" valor={String(res.capacidade)} />
          <Kpi pequeno rotulo="Consistência" valor={res.consistencia === "alta" ? "Alta" : "Baixa"} />
        </Kpis>
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Avaliado em {quando(r.criado_em)} ({ROTULO_ORIGEM[r.origem] || r.origem}), válido até {quando(r.valido_ate)}, calculado pelo modelo <Codigo>{r.versao_modelo}</Codigo>.</T>
      </Bloco>
      <Bloco titulo="Por que este perfil" sub="As respostas que mais limitaram cada eixo aparecem primeiro.">
        <Grade colunas={2}>{blocoEixo("capacidade", "Capacidade")}{blocoEixo("tolerancia", "Tolerância")}</Grade>
        {res.tetos.length || res.descontos.length ? (
          <View><H4 topo>Tetos aplicados</H4>
            <RelLista itens={[...res.tetos, ...res.descontos].map((x: any) => ({ rotulo: FC.recomendacao.texto(x.regra, x) }))} /></View>
        ) : null}
        <T v="p" style={{ marginTop: t.espaco.e3 }}>Perfil final = menor valor entre tolerância e capacidade. Conhecimento declarado: <B>{({ nenhum: "nenhum em renda variável", basico: "básico", experiente: "experiente" } as any)[res.conhecimento]}</B>; ele limita produtos, não o perfil.</T>
      </Bloco>
      <Bloco titulo="Plano e decisão">
        <T v="p">{dec === "aplicado" ? `Aplicado às metas em ${quando(e.plano.decidido_em)}.` : dec === "recusado" ? `Recusado em ${quando(e.plano.decidido_em)}: as metas atuais foram mantidas.` : "Ainda sem decisão."}</T>
        <View style={{ gap: t.espaco.e3, marginTop: t.espaco.e3 }}>
          {rec.plano.passos.map((s: any, k: number) => (
            <View key={k} style={{ flexDirection: "row", gap: 14 }}>
              <NumPasso n={k + 1} feito={s.feito} />
              <View style={{ flex: 1 }}>
                <B style={{ fontSize: 15 }}>{s.titulo}</B>
                <T style={{ fontSize: 14, color: t.cores.ink2, marginTop: 3 }}>{s.texto}</T>
                <T style={{ fontSize: 12, color: t.cores.ink2 }}>regra <Codigo>{s.regra}</Codigo></T>
              </View>
            </View>
          ))}
        </View>
        <H4 topo>Alocação alvo</H4>
        <RelLista itens={FC.recomendacao.CLASSES.map((c: any) => ({ rotulo: c.nome, valor: `${rec.alocacao.classes[c.chave]}%` }))} />
        <H4 topo>Por que cada recomendação</H4>
        <RelLista itens={[...rec.alocacao.notas.map((n: any) => ({ rotulo: n.texto, sub: <Codigo>{n.regra}</Codigo> })),
          ...rec.conflitos.map((c: any) => ({ rotulo: `${c.titulo}. ${c.texto}`, sub: <Codigo>{c.regra}</Codigo> }))]} />
      </Bloco>
      {pcr ? <Bloco titulo="Aderência"><CartaoPlanoRealidade p={pcr} embutido /></Bloco> : null}
      <Bloco titulo="Comportamento">
        {comport.length ? <RelLista itens={comport.map((c: any) => ({ rotulo: <B>{c.titulo}</B>, sub: c.texto }))} />
          : <T v="p">Nenhum alerta: a carteira e as vendas dos últimos 12 meses estão coerentes com o perfil declarado.</T>}
      </Bloco>
      <Historico />
      <T v="p" style={{ marginTop: t.espaco.e4 }}>Este relatório é uma ferramenta pessoal baseada no questionário que você respondeu. Não é recomendação de investimento nem substitui a análise de um profissional habilitado.</T>
    </View>
  );
}

export function NumPasso({ n, feito }: { n: number; feito?: boolean }) {
  const t = useTema();
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: feito ? t.cores.verdeSuave : t.cores.acentoSuave }}>
      <T style={{ fontWeight: "600", fontSize: 14, color: feito ? t.cores.verde : t.cores.acento }}>{feito ? "✓" : n}</T>
    </View>
  );
}

FC.perfilRelatorio = { CartaoPlanoRealidade };
