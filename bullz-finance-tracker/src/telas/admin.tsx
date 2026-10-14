/* Painel do administrador (/admin/[aba]) — port de telas/admin.js: vídeos de
 * divulgação, cliques, jornadas, onboarding e logs com insights. A análise é
 * a do site (FC.admin.analisa / insights / nomeRota); aqui só a tela.
 * Só abre para quem está em public.admins (a RLS garante o resto). */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pagina } from "../casca/casca";
import { useTema } from "../tema";
import { useApp } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Botao, Cabecalho, Cartao, Grade, Kpi, Kpis, Lista, Item, Mensagem, Pilula, Roda, Secao, T, Tabela, Vazio, Chip } from "../ui/kit";
import { Entrada, Seletor, Segmentado } from "../ui/campos";
import { Grafico } from "../ui/grafico";
import { Icone } from "../ui/icone";
import { abrePromo } from "./promo";
import FC from "../nucleo";

const fmt = FC.fmt;
const nomeRota = (r: string) => FC.admin.nomeRota(r);
const mediana = (xs: number[]) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const dur = (ms: number | null | undefined) => {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const quando = (t: number) => { const d = new Date(t); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const pct = (x: number | null | undefined) => (x == null ? "—" : fmt.num(x * 100, 0) + "%");

// ---------------------------------------------------------------- dados
let cache: any = { dias: null, em: 0, eventos: null, erros: null };
async function carrega(dias: number, forcar = false) {
  if (!forcar && cache.dias === dias && Date.now() - cache.em < 120000) return cache;
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const eventos: any[] = [];
  for (let de = 0; de < 60000; de += 1000) {
    const { data, error } = await FC.sb.from("uso_eventos").select("quando,visitante,sessao,tipo,rota,alvo,duracao_ms,aparelho,detalhe")
      .gte("quando", desde).order("quando", { ascending: true }).range(de, de + 999);
    if (error) throw error;
    eventos.push(...data);
    if (data.length < 1000) break;
  }
  const r = await FC.sb.rpc("admin_erros_sistema", { dias });
  cache = { dias, em: Date.now(), eventos, erros: r.error ? [] : r.data || [] };
  return cache;
}

const ABAS = [{ v: "videos", rotulo: "Vídeos" }, { v: "cliques", rotulo: "Cliques" }, { v: "jornadas", rotulo: "Jornadas" }, { v: "onboarding", rotulo: "Onboarding" }, { v: "logs", rotulo: "Logs e insights" }] as const;
type Aba = (typeof ABAS)[number]["v"];
// o filtro sobrevive à troca de aba, como no site
const filtro = { dias: 30, comparaA: null as string | null, comparaB: null as string | null, tipo: "", rota: "", busca: "", sessao: null as string | null };

export default function Admin() {
  const admin = useApp((s) => s.admin);
  useApp((s) => s.versao);
  // o banco ainda não respondeu se é admin: espera antes de mandar embora
  const verificado = !!FC.estado.adminVerificado;
  const { aba: abaParam } = useLocalSearchParams<{ aba?: string }>();
  const aba: Aba = ABAS.some((a) => a.v === abaParam) ? (abaParam as Aba) : "cliques";
  const [dias, setDias] = useState(filtro.dias);
  const [rec, setRec] = useState(0);
  const [estado, setEstado] = useState<{ carregando: boolean; erro?: string; d?: any }>({ carregando: true });

  useEffect(() => { if (verificado && !admin) router.replace("/inicio" as any); }, [admin, verificado]);
  useEffect(() => {
    if (!admin || aba === "videos" || aba === "onboarding") return;
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true }));
    carrega(dias, rec > 0).then((d) => vivo && setEstado({ carregando: false, d }), (e) => vivo && setEstado({ carregando: false, erro: String(e.message || e) }));
    return () => { vivo = false; };
  }, [admin, aba, dias, rec]);
  const a = useMemo(() => (estado.d ? FC.admin.analisa(estado.d.eventos) : null), [estado.d]);
  if (!admin) return verificado ? null : <Pagina><View style={{ minHeight: 240, alignItems: "center", justifyContent: "center" }}><Roda /></View></Pagina>;

  const trocaDias = (d: string) => { filtro.dias = Number(d); setDias(filtro.dias); };
  return (
    <Pagina>
      <Cabecalho titulo="Administração" sub="Uso do sistema, anônimo, e material de divulgação."
        direita={<Botao variante="sec" icone="atualizar" onPress={() => { cache.em = 0; setRec((x) => x + 1); }}>Atualizar</Botao>} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <Segmentado valor={aba} aoMudar={(v) => router.replace(`/admin/${v}` as any)} rotuloA11y="Seções da administração" opcoes={ABAS as any} />
        {aba !== "videos" ? <Segmentado valor={String(dias)} aoMudar={trocaDias} rotuloA11y="Período" opcoes={[7, 30, 90].map((d) => ({ v: String(d), rotulo: `${d} dias` }))} /> : null}
      </View>
      {aba === "videos" ? <AbaVideos />
        : aba === "onboarding" ? <AbaOnboarding dias={dias} />
        : estado.carregando && !a ? <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12 }}><Roda /><T>Lendo o uso…</T></View>
        : estado.erro ? <Mensagem tipo="erro" icone="alerta">Não deu para ler o uso: {estado.erro}</Mensagem>
        : a && estado.d ? (aba === "cliques" ? <AbaCliques a={a} dias={dias} /> : aba === "jornadas" ? <AbaJornadas a={a} /> : <AbaLogs a={a} d={estado.d} dias={dias} />)
        : null}
    </Pagina>
  );
}

function SemDados() {
  return <Vazio icone="grafico" titulo="Ainda sem dados de uso" texto="Os eventos aparecem aqui quando pessoas que aceitaram a coleta anônima usarem o app. Erros técnicos aparecem para todos." />;
}
const H2 = ({ children }: { children: React.ReactNode }) => <T style={{ fontSize: 17, fontWeight: "600", marginBottom: 12 }}>{children}</T>;

// ---------------------------------------------------------------- 1. vídeos
function AbaVideos() {
  const t = useTema();
  return (
    <Grade colunas={2}>
      <Cartao>
        <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acento, marginBottom: 12 }}>
          <Icone nome="play" tam={28} cor="#fff" />
        </View>
        <T style={{ fontSize: 21, fontWeight: "700", marginBottom: 6 }}>Vídeo de divulgação</T>
        <T v="p">{Math.round(FC.promo.TOTAL)} s com trilha, em formato vertical (stories e reels) ou horizontal, gerado no aparelho com os números da conta logada. Dá para esconder os valores e trocar a frase final e o endereço do site.</T>
        <View style={{ marginTop: 16, alignItems: "flex-start" }}><Botao icone="play" onPress={abrePromo}>Gerar vídeo</Botao></View>
      </Cartao>
      <Cartao>
        <T style={{ fontSize: 17, fontWeight: "600", marginBottom: 8 }}>Como fica bom</T>
        {[
          "Use uma conta com histórico de pelo menos 6 meses: o gráfico e a retrospectiva ficam mais bonitos.",
          "Para publicar, ligue Esconder valores: os números viram percentuais.",
          "A conta de demonstração tem dados fictícios prontos para isso.",
          "O arquivo sai em MP4 ou WebM, conforme o aparelho. Instagram e TikTok aceitam os dois.",
        ].map((x) => (
          <View key={x} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <T style={{ color: t.cores.acento }}>•</T><T v="p" style={{ flex: 1 }}>{x}</T>
          </View>
        ))}
      </Cartao>
    </Grade>
  );
}

// ---------------------------------------------------------------- 2. cliques
function AbaCliques({ a, dias }: { a: any; dias: number }) {
  const [, re] = useState(0);
  if (!a.cliques) return <SemDados />;
  const rotas: string[] = a.telas.map((t: any) => t.rota);
  filtro.comparaA = rotas.includes(filtro.comparaA as string) ? filtro.comparaA : rotas[0];
  filtro.comparaB = rotas.includes(filtro.comparaB as string) ? filtro.comparaB : rotas[1] || rotas[0];
  const ds: any[] = [];
  for (let i = dias - 1; i >= 0; i--) { const dd = FC.datas.soma(FC.datas.hoje(), -i); ds.push([dd, a.porDia[dd] || 0]); }
  const barras = Object.entries(a.porRota as Record<string, number>).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([r, n]) => ({ rotulo: nomeRota(r).slice(0, 10), valor: n }));
  const tA = a.telas.find((t: any) => t.rota === filtro.comparaA), tB = a.telas.find((t: any) => t.rota === filtro.comparaB);
  const linhaCmp = (rot: string, f: (t: any) => any, melhorMaior: boolean, formata: (x: any) => string) => {
    const va = f(tA), vb = f(tB);
    const ganha = va == null || vb == null || va === vb ? 0 : (va > vb) === melhorMaior ? 1 : -1;
    return [rot, { v: formata(va), cls: ganha > 0 ? "pos" : null }, { v: formata(vb), cls: ganha < 0 ? "pos" : null }];
  };
  const opcoes = rotas.map((r) => ({ v: r, rotulo: nomeRota(r) }));
  return (
    <View>
      <Cartao style={{ marginBottom: 16 }}>
        <Kpis>
          <Kpi rotulo="Cliques" valor={fmt.int(a.cliques)} />
          <Kpi rotulo="Sessões" valor={fmt.int(a.sessoes.length)} />
          <Kpi rotulo="Visitantes anônimos" valor={fmt.int(a.visitantes)} />
          <Kpi rotulo="Cliques por sessão" valor={fmt.num(a.cliques / (a.sessoes.length || 1), 1)} />
        </Kpis>
      </Cartao>
      <Grade colunas={2}>
        <Cartao><H2>Cliques por dia</H2>
          <Grafico marcador={FC.graficos.linhas({ series: [{ nome: "Cliques", pontos: ds, classe: "l1", area: true }], y: "int", altura: 220, zero: true, privado: false })} /></Cartao>
        <Cartao><H2>Cliques por página</H2>
          <Grafico marcador={FC.graficos.colunas({ barras, y: "int", altura: 220, privado: false })} /></Cartao>
      </Grade>
      <Secao titulo="Elementos mais clicados" sub="o elemento é descrito sem dados da pessoa">
        <Cartao semPad>
          <Tabela minimo={640} cabecas={[{ t: "Elemento", largura: 220 }, { t: "Página" }, { t: "Cliques", n: true, largura: 90 }, { t: "Sessões", n: true, largura: 90 }, { t: "% das sessões da página", n: true, largura: 180 }]}
            linhas={a.elementos.slice(0, 25).map((e: any) => [e.alvo, nomeRota(e.rota), fmt.int(e.cliques), fmt.int(e.sessoes), pct(e.pct_sessoes)])} />
        </Cartao>
      </Secao>
      <Secao titulo="Comparar telas" sub="em verde, a melhor das duas em cada linha">
        <Cartao>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <View style={{ flex: 1, minWidth: 160, gap: 6 }}><T style={{ fontSize: 13 }}>Tela A</T>
              <Seletor valor={filtro.comparaA as string} opcoes={opcoes} aoMudar={(v) => { filtro.comparaA = v; re((x) => x + 1); }} rotuloA11y="Tela A" /></View>
            <View style={{ flex: 1, minWidth: 160, gap: 6 }}><T style={{ fontSize: 13 }}>Tela B</T>
              <Seletor valor={filtro.comparaB as string} opcoes={opcoes} aoMudar={(v) => { filtro.comparaB = v; re((x) => x + 1); }} rotuloA11y="Tela B" /></View>
          </View>
          {tA && tB ? (
            <Tabela minimo={420} cabecas={[{ t: "" }, { t: nomeRota(filtro.comparaA as string), n: true, largura: 130 }, { t: nomeRota(filtro.comparaB as string), n: true, largura: 130 }]}
              linhas={[
                linhaCmp("Visitas", (t) => t.visitas, true, fmt.int),
                linhaCmp("Sessões", (t) => t.sessoes, true, fmt.int),
                linhaCmp("Cliques por visita", (t) => t.cliques_visita, true, (x) => fmt.num(x, 1)),
                linhaCmp("Tempo mediano", (t) => t.tempo_mediano, true, dur),
                linhaCmp("Termina a sessão", (t) => t.taxa_saida, false, pct),
                linhaCmp("Idas e voltas rápidas", (t) => (t.visitas ? t.voltas / t.visitas : 0), false, pct),
                linhaCmp("Formulários enviados", (t) => t.taxa_envio, true, pct),
              ]} />
          ) : null}
        </Cartao>
      </Secao>
      <Secao titulo="Fluxos entre telas" sub="de onde para onde as pessoas vão">
        <Cartao><Fluxos fl={a.fluxos.slice(0, 12)} /></Cartao>
      </Secao>
    </View>
  );
}
function Fluxos({ fl }: { fl: any[] }) {
  const t = useTema();
  if (!fl.length) return <T v="p">Ainda sem navegação entre telas.</T>;
  const max = fl[0].n;
  return (
    <View style={{ gap: 10 }}>
      {fl.map((f) => (
        <View key={f.de + f.para} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T style={{ width: 110, fontSize: 13.5 }} numberOfLines={1}>{nomeRota(f.de)}</T>
          <Icone nome="chevron" tam={14} cor={t.cores.ink3} />
          <T style={{ width: 110, fontSize: 13.5 }} numberOfLines={1}>{nomeRota(f.para)}</T>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.cores.campo, overflow: "hidden" }}>
            <View style={{ width: `${(f.n / max) * 100}%`, height: "100%", backgroundColor: t.cores.acento, borderRadius: 4 }} />
          </View>
          <T num style={{ width: 40, textAlign: "right", fontWeight: "700" }}>{fmt.int(f.n)}</T>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- 3. jornadas
function AbaJornadas({ a }: { a: any }) {
  const t = useTema();
  const { estreito } = useMedidas();
  const [sessao, setSessao] = useState(filtro.sessao);
  if (!a.sessoes.length) return <SemDados />;
  const sel = a.sessoes.find((s: any) => s.id === sessao) || a.sessoes[0];
  filtro.sessao = sel.id;
  const ultimas: Record<string, number> = {};
  for (const s of a.sessoes) if (s.passos.length) ultimas[s.ultima] = (ultimas[s.ultima] || 0) + 1;
  const barrasUlt = Object.entries(ultimas).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([r, n]) => ({ rotulo: nomeRota(r).slice(0, 10), valor: n }));
  return (
    <View>
      <Cartao style={{ marginBottom: 16 }}>
        <Kpis>
          <Kpi rotulo="Sessões" valor={fmt.int(a.sessoes.length)} />
          <Kpi rotulo="Duração mediana" valor={dur(mediana(a.sessoes.map((s: any) => s.duracao)))} />
          <Kpi rotulo="Telas por sessão" valor={fmt.num(mediana(a.sessoes.map((s: any) => s.passos.length)) || 0, 0)} />
          <Kpi rotulo="Saíram no meio de um formulário" valor={pct(a.sessoes.filter((s: any) => s.abandonou.length).length / a.sessoes.length)} />
        </Kpis>
      </Cartao>
      <View style={{ flexDirection: estreito ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
        <Cartao semPad style={{ width: estreito ? "100%" : 340 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: t.cores.linha }}>
            <T style={{ fontWeight: "600" }}>Sessões</T><T style={{ color: t.cores.ink2 }}>{fmt.int(a.sessoes.length)}</T>
          </View>
          <View style={{ maxHeight: 560 }}>
            {/* lista rolável das sessões */}
            <ListaSessoes sessoes={a.sessoes.slice(0, 150)} sel={sel.id} aoEscolher={setSessao} />
          </View>
        </Cartao>
        <Cartao style={{ flex: 1, width: estreito ? "100%" : undefined }}><LinhaDoTempo s={sel} /></Cartao>
      </View>
      <Grade colunas={2} style={{ marginTop: 16 }}>
        <Cartao><H2>Onde as sessões terminam</H2>
          <Grafico marcador={FC.graficos.colunas({ barras: barrasUlt, y: "int", altura: 200, cor: "var(--s3)", privado: false })} /></Cartao>
        <Cartao><H2>Formulários abandonados</H2>
          {a.folhas.length ? (
            <Tabela minimo={360} cabecas={[{ t: "Formulário" }, { t: "Abertos", n: true, largura: 80 }, { t: "Enviados", n: true, largura: 80 }, { t: "Abandono", n: true, largura: 90 }]}
              linhas={a.folhas.slice(0, 8).map((f: any) => [{ v: f.alvo, leg: nomeRota(f.rota) }, String(f.abertas), String(f.enviadas), { v: pct(f.abandono), cls: f.abandono >= 0.5 ? "neg" : null }])} />
          ) : <T v="p">Nenhum formulário aberto no período.</T>}
        </Cartao>
      </Grade>
      <Secao titulo="Caminhos mais comuns" sub="as três primeiras telas de cada sessão">
        <Cartao>
          <View style={{ gap: 10 }}>
            {a.caminhos.slice(0, 8).map((c: any) => (
              <View key={c.passos.join(">")} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                {c.passos.map((p: string, i: number) => (
                  <React.Fragment key={i}>
                    {i ? <Icone nome="chevron" tam={13} cor={t.cores.ink3} /> : null}
                    <Chip>{nomeRota(p)}</Chip>
                  </React.Fragment>
                ))}
                <T style={{ marginLeft: "auto", fontWeight: "700" }}>{fmt.int(c.n)}×</T>
              </View>
            ))}
          </View>
        </Cartao>
      </Secao>
    </View>
  );
}
function ListaSessoes({ sessoes, sel, aoEscolher }: { sessoes: any[]; sel: string; aoEscolher: (id: string) => void }) {
  const t = useTema();
  return (
    <ScrollView nestedScrollEnabled style={{ maxHeight: 560 }}>
      {sessoes.map((s) => (
        <Pressable key={s.id} onPress={() => aoEscolher(s.id)} accessibilityRole="button" accessibilityState={{ selected: s.id === sel }}
          style={({ hovered }: any) => ({ padding: 12, gap: 3, borderBottomWidth: 1, borderBottomColor: t.cores.linha,
            backgroundColor: s.id === sel ? t.cores.acentoSuave : hovered ? t.cores.bg3 : "transparent", borderLeftWidth: 3, borderLeftColor: s.id === sel ? t.cores.acento : "transparent" })}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <T style={{ fontWeight: "600", fontSize: 13.5 }}>{quando(s.inicio)}</T><T style={{ fontSize: 13, color: t.cores.ink2 }}>{dur(s.duracao)}</T>
          </View>
          <T style={{ fontSize: 13, color: t.cores.ink2 }} numberOfLines={1}>{s.passos.slice(0, 5).map((p: any) => nomeRota(p.rota)).join(" › ")}{s.passos.length > 5 ? " ›…" : ""}</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <Icone nome={s.aparelho === "celular" ? "celular" : "inicio"} tam={12} cor={t.cores.ink3} />
            <T style={{ fontSize: 12, color: t.cores.ink3 }}>{s.aparelho || ""} · {s.cliques} cliques</T>
            {s.erros ? <T cls="neg" style={{ fontSize: 12 }}>· {s.erros} erro{s.erros > 1 ? "s" : ""}</T> : null}
            {s.abandonou.length ? <T style={{ fontSize: 12, color: t.cores.amarelo }}>· abandonou formulário</T> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function LinhaDoTempo({ s }: { s: any }) {
  const t = useTema();
  const total = s.passos.reduce((x: number, p: any) => x + (p.duracao || 0), 0) || 1;
  const CORES = [t.cores.acento, t.cores.verde, t.cores.amarelo, t.cores.s4, t.cores.vermelho];
  return (
    <View>
      <T style={{ fontSize: 17, fontWeight: "600" }}>Sessão de {quando(s.inicio)}</T>
      <T style={{ fontSize: 13, color: t.cores.ink2, marginBottom: 12 }}>visitante {s.visitante.slice(0, 6)} · {s.aparelho || "—"} · {dur(s.duracao)} · {s.passos.length} telas</T>
      <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2, marginBottom: 16 }}>
        {s.passos.map((p: any, i: number) => <View key={i} accessibilityLabel={`${nomeRota(p.rota)} · ${dur(p.duracao)}`} style={{ flex: Math.max(p.duracao || 0, total * 0.02), backgroundColor: CORES[i % CORES.length] }} />)}
      </View>
      {s.passos.map((p: any, i: number) => {
        const acoes = [
          ...p.cliques.map((c: any) => ({ t: c.t, icone: "alvo", txt: c.alvo + (c.folha ? ` em “${c.folha}”` : ""), cls: null })),
          ...p.folhas.map((f: any) => ({ t: f.t, icone: f.tipo === "folha_envia" ? "check" : "recibo", cls: f.tipo === "folha_envia" ? "pos" : null,
            txt: `${f.tipo === "folha_abre" ? "abriu" : f.tipo === "folha_envia" ? "enviou" : f.enviou ? "fechou" : "fechou sem enviar"} “${f.alvo}”` })),
          ...p.erros.map((e: any) => ({ t: e.t, icone: "alerta", txt: e.alvo, cls: "neg" })),
        ].sort((x, y) => x.t - y.t);
        const ultimo = i === s.passos.length - 1;
        return (
          <View key={i} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", width: 14 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: CORES[i % CORES.length] }} />
              {!ultimo ? <View style={{ flex: 1, width: 2, backgroundColor: t.cores.linha }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T style={{ fontWeight: "600" }}>{nomeRota(p.rota)}</T><T style={{ fontSize: 13, color: t.cores.ink2 }}>{dur(p.duracao)}</T>
              </View>
              {acoes.map((x, k) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Icone nome={x.icone as any} tam={12} cor={x.cls === "neg" ? t.cores.vermelho : x.cls === "pos" ? t.cores.verde : t.cores.ink3} />
                  <T cls={x.cls} style={{ fontSize: 13, flex: 1 }}>{x.txt}</T>
                </View>
              ))}
              {ultimo ? <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 6, fontStyle: "italic" }}>
                {s.abandonou.length ? `Saiu com “${s.abandonou.join("”, “")}” aberto, sem enviar.` : "Fim da sessão."}</T> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- 4. onboarding e perfil
function AbaOnboarding({ dias }: { dias: number }) {
  const [f, setF] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setF(null); setErro(null);
    FC.perfilDb.funil(Math.max(dias, 7)).then((x: any) => vivo && setF(x), (e: any) => vivo && setErro(String(e.message || e)));
    return () => { vivo = false; };
  }, [dias]);
  if (erro) return <Mensagem tipo="erro" icone="alerta">Não deu para ler o funil: {erro}. Aplique o schema.sql atualizado.</Mensagem>;
  if (!f) return <View style={{ minHeight: 200, alignItems: "center", justifyContent: "center" }}><Roda /></View>;
  const taxa = (a: number, b: number) => (b > 0 ? fmt.num((a / b) * 100, 0) + "%" : "—");
  const min = f.tempo_mediano_ms == null ? "—" : (f.tempo_mediano_ms / 60000).toFixed(1).replace(".", ",") + " min";
  const s = f.saude || {};
  return (
    <View style={{ gap: 16 }}>
      <T v="p">Janela de {f.janela_dias} dias. Conclusão do questionário e ativação são medidas separadas: completar o perfil não é ativar.</T>
      <Cartao><H2>Funil</H2>
        <Kpis>
          <Kpi pequeno rotulo="Contas novas" valor={fmt.int(f.contas_novas)} />
          <Kpi pequeno rotulo="Início do questionário" valor={taxa(f.abriram_bloco_1, f.contas_novas)} ajuda="abriram o bloco 1" />
          <Kpi pequeno rotulo="Tempo mediano até o perfil" valor={min} ajuda="meta: menos de 3 min" />
          <Kpi pequeno rotulo="Perfis concluídos" valor={fmt.int(f.perfis_concluidos)} />
          <Kpi pequeno rotulo="Plano aplicado" valor={taxa(f.planos_aplicados, f.perfis_concluidos)} ajuda="dos perfis concluídos" />
          <Kpi pequeno rotulo="Ativação em 7 dias" valor={taxa(f.ativadas_7d, f.contas_novas)} ajuda="perfil + ativo, aporte ou meta" />
        </Kpis>
      </Cartao>
      <Cartao><H2>Conclusão por bloco</H2>
        <Lista>{(f.blocos || []).map((b: any) => (
          <Item key={b.bloco} titulo={`Bloco ${b.bloco}`} detalhe={`${fmt.int(b.concluiram)} de ${fmt.int(b.viram)} concluíram`} direita={<T style={{ fontWeight: "700" }}>{taxa(b.concluiram, b.viram)}</T>} />
        ))}</Lista>
      </Cartao>
      <Cartao><H2>Contas antigas e convite</H2>
        <T v="p">{fmt.int(f.adiaram)} conta(s) adiaram o convite, somando {fmt.int(f.adiamentos)} adiamento(s). Planos recusados: {fmt.int(f.planos_recusados)}.</T>
      </Cartao>
      <Cartao><H2>Saúde dos perfis</H2>
        <Kpis>
          <Kpi pequeno rotulo="Perfis vigentes" valor={fmt.int(s.perfis || 0)} />
          <Kpi pequeno rotulo="Vencidos" valor={taxa(s.vencidos, s.perfis)} />
          <Kpi pequeno rotulo="Baixa consistência" valor={taxa(s.baixa_consistencia, s.perfis)} ajuda="meta: até 15%" />
          <Kpi pequeno rotulo="Conservador" valor={fmt.int(s.conservador || 0)} />
          <Kpi pequeno rotulo="Moderado" valor={fmt.int(s.moderado || 0)} />
          <Kpi pequeno rotulo="Arrojado" valor={fmt.int(s.arrojado || 0)} />
        </Kpis>
      </Cartao>
      <Cartao><H2>Retenção por coorte semanal</H2>
        <T v="p" style={{ marginBottom: 8 }}>D1 é o dia seguinte; D7 e D30 contam a volta nos 7 dias a partir da data.</T>
        {(f.retencao || []).length ? (
          <Tabela minimo={520} cabecas={[{ t: "Semana", largura: 110 }, { t: "Grupo" }, { t: "Contas", n: true, largura: 80 }, { t: "D1", n: true, largura: 70 }, { t: "D7", n: true, largura: 70 }, { t: "D30", n: true, largura: 70 }]}
            linhas={f.retencao.map((r: any) => [FC.datas.br(r.semana), r.ativada ? "ativados" : "não ativados", fmt.int(r.contas), taxa(r.d1, r.contas), taxa(r.d7, r.contas), taxa(r.d30, r.contas)])} />
        ) : <T v="p">Ainda sem coortes nas últimas 8 semanas.</T>}
      </Cartao>
    </View>
  );
}

// ---------------------------------------------------------------- 5. logs e insights
function AbaLogs({ a, d, dias }: { a: any; d: any; dias: number }) {
  const t = useTema();
  const [, re] = useState(0);
  const [busca, setBusca] = useState(filtro.busca);
  useEffect(() => { const x = setTimeout(() => { filtro.busca = busca; re((n) => n + 1); }, 300); return () => clearTimeout(x); }, [busca]);
  const ins = FC.admin.insights(a);
  const b = filtro.busca.toLowerCase();
  const evs = d.eventos.filter((e: any) => (!filtro.tipo || e.tipo === filtro.tipo) && (!filtro.rota || e.rota === filtro.rota)
    && (!b || [e.alvo, e.rota, e.tipo, e.sessao, JSON.stringify(e.detalhe)].join(" ").toLowerCase().includes(b))).reverse();
  const rotas = [...new Set<string>(d.eventos.map((e: any) => e.rota).filter(Boolean))].sort();
  const COR_GRAU = [t.cores.verde, t.cores.acento, t.cores.amarelo, t.cores.vermelho];
  const csv = () => {
    const cab = ["quando", "visitante", "sessao", "tipo", "rota", "alvo", "duracao_ms", "aparelho", "detalhe"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [cab.join(",")].concat(d.eventos.map((e: any) => cab.map((k) => esc(k === "detalhe" ? JSON.stringify(e.detalhe) : e[k])).join(",")));
    FC.baixar(`uso-${dias}d-${FC.datas.hoje()}.csv`, linhas.join("\n"), "text/csv");
  };
  return (
    <View>
      <Secao titulo="Insights de usabilidade" sub={`gerados a partir dos últimos ${dias} dias`} topo={false}>
        <Grade colunas={2}>
          {ins.map((x: any, i: number) => (
            <Cartao key={i} style={{ borderLeftWidth: 4, borderLeftColor: COR_GRAU[x.grau] }}>
              <T style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: COR_GRAU[x.grau], marginBottom: 4 }}>{x.tipo}</T>
              <T style={{ fontWeight: "700", marginBottom: 4 }}>{x.titulo}</T>
              <T v="p">{x.texto}</T>
            </Cartao>
          ))}
        </Grade>
      </Secao>
      {a.erros.length ? (
        <Secao titulo="Erros recorrentes no app" sub="mensagens agrupadas, sem dados pessoais">
          <Cartao semPad>
            <Tabela minimo={720} cabecas={[{ t: "Mensagem", largura: 260 }, { t: "Vezes", n: true, largura: 70 }, { t: "Sessões", n: true, largura: 80 }, { t: "Telas", largura: 160 }, { t: "Última", largura: 120 }]}
              linhas={a.erros.slice(0, 15).map((e: any) => [{ v: e.mensagem, leg: e.local || undefined }, String(e.vezes), String(e.sessoes), e.rotas.map(nomeRota).join(", "), quando(e.ultima)])} />
          </Cartao>
        </Secao>
      ) : null}
      {d.erros.length ? (
        <Secao titulo="Erros do servidor" sub="fontes de preço e registro diário, sem dizer de quem">
          <Cartao semPad>
            <Tabela cabecas={[{ t: "Quando", largura: 120 }, { t: "Etapa", largura: 120 }, { t: "Erro", largura: 300 }]}
              linhas={d.erros.slice(0, 30).map((e: any) => [quando(Date.parse(e.quando)), e.etapa, e.erro])} />
          </Cartao>
        </Secao>
      ) : null}
      <Secao titulo="Logs de uso" sub={`${fmt.int(evs.length)} de ${fmt.int(d.eventos.length)} eventos`}>
        <Cartao>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <View style={{ flex: 2, minWidth: 200 }}><Entrada value={busca} onChangeText={setBusca} placeholder="Buscar em elemento, tela, sessão…" accessibilityLabel="Buscar nos logs" /></View>
            <View style={{ flex: 1, minWidth: 150 }}><Seletor valor={filtro.tipo} aoMudar={(v) => { filtro.tipo = v; re((n) => n + 1); }} rotuloA11y="Tipo"
              opcoes={[{ v: "", rotulo: "Todos os tipos" }, ...["tela", "clique", "folha_abre", "folha_envia", "folha_fecha", "erro"].map((x) => ({ v: x, rotulo: x }))]} /></View>
            <View style={{ flex: 1, minWidth: 150 }}><Seletor valor={filtro.rota} aoMudar={(v) => { filtro.rota = v; re((n) => n + 1); }} rotuloA11y="Tela"
              opcoes={[{ v: "", rotulo: "Todas as telas" }, ...rotas.map((r) => ({ v: r, rotulo: nomeRota(r) }))]} /></View>
            <Botao variante="sec" pequeno icone="baixar" onPress={csv}>CSV</Botao>
          </View>
          <Tabela minimo={760} cabecas={[{ t: "Quando", largura: 110 }, { t: "Tipo", largura: 120 }, { t: "Tela", largura: 120 }, { t: "Elemento / mensagem", largura: 240 }, { t: "Duração", n: true, largura: 100 }, { t: "Sessão", largura: 90 }]}
            linhas={evs.slice(0, 400).map((e: any) => ({
              estilo: e.tipo === "erro" ? "tem-cota" : undefined,
              celulas: [quando(Date.parse(e.quando)),
                <Pilula key="p" cor={e.tipo === "erro" ? "vermelho" : e.tipo === "clique" ? "azul" : "cinza"}>{e.tipo}</Pilula>,
                nomeRota(e.rota), e.alvo || "", e.duracao_ms != null ? dur(e.duracao_ms) : "",
                <Botao key="b" variante="texto" pequeno onPress={() => { filtro.sessao = e.sessao; router.replace("/admin/jornadas" as any); }}>{e.sessao.slice(0, 6)}</Botao>],
            }))} />
          {evs.length > 400 ? <T v="p" style={{ marginTop: 8 }}>Mostrando os 400 mais recentes. Use os filtros ou baixe o CSV.</T> : null}
        </Cartao>
      </Secao>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 16 }}>
        <Icone nome="escudo" tam={14} cor={t.cores.ink2} />
        <T v="p" style={{ flex: 1 }}>Coleta anônima: código aleatório do aparelho no lugar da conta, telas sem parâmetros, elementos e mensagens sem números, valores, e-mails ou tickers. Telas e cliques só com consentimento; erros por legítimo interesse. Tudo é apagado após 180 dias.</T>
      </View>
    </View>
  );
}
