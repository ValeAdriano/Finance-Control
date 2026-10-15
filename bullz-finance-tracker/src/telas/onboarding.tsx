/* Apresentação por passos — port de telas/onboarding.js. Aparece no primeiro
 * acesso de cada conta e pode ser revista em Ajustes. O "já vi" fica nos
 * metadados do usuário no Supabase. O último passo é interativo: nome, tema,
 * módulos e por onde começar. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { router } from "expo-router";
import { useTema, usePrefTema } from "../tema";
import { rerender } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Botao, Pilula, T, degrade } from "../ui/kit";
import { Campo, Entrada, Segmentado } from "../ui/campos";
import { Icone, type NomeIcone } from "../ui/icone";
import { telaCheia, ui, type ApiFolha } from "../ui/folha";
import FC from "../nucleo";

const nd = Platform.OS !== "web";
const mola = Easing.bezier(0.32, 0.72, 0, 1);

/** valor de 0→1 que anima quando `ativo` liga (cada cena só anima no passo atual) */
function useEntrada(ativo: boolean, atraso = 0, dur = 500) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo) { a.setValue(0); return; }
    Animated.timing(a, { toValue: 1, duration: dur, delay: atraso, easing: mola, useNativeDriver: nd }).start();
  }, [ativo, a, atraso, dur]);
  return a;
}
const sobe = (a: Animated.Value, d = 14) => ({ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [d, 0] }) }] });

function CartaoCena({ children }: { children: React.ReactNode }) {
  const t = useTema();
  return <View style={{ width: "100%", maxWidth: 360, backgroundColor: t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, boxShadow: t.cores.sombra, padding: 16 } as any}>{children}</View>;
}
function Rot({ children, icone }: { children: React.ReactNode; icone?: NomeIcone }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icone ? <Icone nome={icone} tam={16} cor={t.cores.ink2} /> : null}
      <T style={{ fontSize: 12.5, color: t.cores.ink2, fontWeight: "500" }}>{children}</T>
    </View>
  );
}

// ---------------------------------------------------------------- cenas
function CenaBoasVindas({ ativo }: { ativo: boolean }) {
  const t = useTema();
  const a = useEntrada(ativo, 0, 700);
  const icones: NomeIcone[] = ["inicio", "ativos", "agro", "aportes", "moeda", "projecoes"];
  return (
    <View style={{ height: 220, width: 260, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
        <Image source={require("../../assets/img/icone-512.png")} style={{ width: 96, height: 96, borderRadius: 26 }} />
      </Animated.View>
      {icones.map((n, i) => <Orbita key={n} i={i} ativo={ativo} nome={n} cor={t.cores.acento} fundo={t.cores.bg2} sombra={t.cores.sombra} />)}
    </View>
  );
}
function Orbita({ i, ativo, nome, cor, fundo, sombra }: { i: number; ativo: boolean; nome: NomeIcone; cor: string; fundo: string; sombra: string }) {
  const a = useEntrada(ativo, 250 + i * 70, 600);
  const ang = (i * 60 * Math.PI) / 180;
  const r = a.interpolate({ inputRange: [0, 1], outputRange: [40, 92] });
  return (
    <Animated.View style={{ position: "absolute", width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: fundo, boxShadow: sombra, opacity: a,
      transform: [{ translateX: Animated.multiply(r, Math.cos(ang)) as any }, { translateY: Animated.multiply(r, Math.sin(ang)) as any }] } as any}>
      <Icone nome={nome} tam={18} cor={cor} />
    </Animated.View>
  );
}
function CenaPatrimonio({ ativo }: { ativo: boolean }) {
  const t = useTema();
  const [v, setV] = useState(0);
  const area = useEntrada(ativo, 900, 800);
  useEffect(() => {
    if (!ativo) { setV(0); return; }
    const t0 = Date.now(); let raf = 0;
    const passo = () => { const f = Math.min(1, (Date.now() - t0) / 1100); setV(148320 * (1 - Math.pow(1 - f, 3))); if (f < 1) raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [ativo]);
  const d = "M0 78 L25 72 L50 74 L75 62 L100 64 L125 52 L150 55 L175 40 L200 42 L225 28 L250 24 L280 12";
  return (
    <CartaoCena>
      <Rot>Patrimônio</Rot>
      <T style={{ fontSize: 32, fontWeight: "600", letterSpacing: -1, marginTop: 2, fontVariant: ["tabular-nums"] }}>{FC.fmt.brlTexto(v).replace(/,\d\d$/, "")}</T>
      <T style={{ color: t.cores.verde, fontSize: 13, fontWeight: "500" }}>▲ 12,4% em 12 meses</T>
      <Svg viewBox="0 0 280 90" width="100%" height={90} style={{ marginTop: 8 }}>
        <Defs><LinearGradient id="obg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={t.cores.acento} stopOpacity={0.28} /><Stop offset="1" stopColor={t.cores.acento} stopOpacity={0} /></LinearGradient></Defs>
        {ativo ? <Path d={d + " L280 90 L0 90Z"} fill="url(#obg)" /> : null}
        <Path d={d} fill="none" stroke={t.cores.acento} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Animated.View style={{ opacity: area }} />
    </CartaoCena>
  );
}
function CenaInvestimentos({ ativo }: { ativo: boolean }) {
  const t = useTema();
  const linhas: Array<[string, string, string, string, string]> = [["ITSA4", "Ações", "verde", "Nos critérios", "+1,2%"], ["HGLG11", "FII", "amarelo", "Perto", "−0,4%"], ["BTC", "Cripto", "azul", "Na carteira", "+3,8%"], ["Tesouro IPCA+", "Renda fixa", "cinza", "Contratado", "IPCA+6%"]];
  return (
    <CartaoCena>
      {linhas.map(([tk, c, cor, v, d], i) => <LinhaCena key={tk} i={i} ativo={ativo} tk={tk} c={c} cor={cor} v={v} d={d} borda={i > 0 ? t.cores.linha : undefined} />)}
    </CartaoCena>
  );
}
function LinhaCena({ i, ativo, tk, c, cor, v, d, borda }: any) {
  const t = useTema();
  const a = useEntrada(ativo, 150 + i * 90);
  return (
    <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: borda ? 1 : 0, borderTopColor: borda }, sobe(a)]}>
      <View style={{ flex: 1 }}><T style={{ fontSize: 14.5, fontWeight: "600" }}>{tk}</T><T style={{ fontSize: 12, color: t.cores.ink3 }}>{c}</T></View>
      <Pilula cor={cor}>{v}</Pilula>
      <T style={{ width: 64, textAlign: "right", fontSize: 13, fontWeight: "500", color: d.startsWith("−") ? t.cores.vermelho : t.cores.verde }}>{d}</T>
    </Animated.View>
  );
}
function CenaAportes({ ativo }: { ativo: boolean }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", gap: 8, width: "100%", maxWidth: 360 }}>
      <View style={{ flex: 1 }}><CartaoCena>
        <Rot icone="aportes">Repetir aporte</Rot>
        <View style={{ backgroundColor: t.cores.campo, borderRadius: 10, padding: 10, marginTop: 10 }}><T style={{ fontSize: 13 }}>ITSA4 · <T style={{ fontWeight: "600", fontSize: 13 }}>20</T> × R$ 10,80</T></View>
        <View style={{ backgroundColor: t.cores.acento, borderRadius: 980, padding: 8, marginTop: 10, alignItems: "center" }}><Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "500" }}>Aportar R$ 216,00</Text></View>
      </CartaoCena></View>
      <View style={{ flex: 1 }}><CartaoCena>
        <Rot icone="boi">Rebanho</Rot>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {Array.from({ length: 6 }, (_, i) => <Boi key={i} i={i} ativo={ativo} />)}
        </View>
        <T style={{ fontSize: 11.5, color: t.cores.ink3, marginTop: 10, lineHeight: 15 }}>6 cabeças · compra, venda, custos e pesagens</T>
      </CartaoCena></View>
    </View>
  );
}
function Boi({ i, ativo }: { i: number; ativo: boolean }) {
  const t = useTema();
  const a = useEntrada(ativo, 200 + i * 80, 450);
  return <Animated.View style={[{ width: "30%", height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.terraSuave }, { opacity: a, transform: [{ scale: a }] }]}><Icone nome="boi" tam={20} cor={t.cores.terra} /></Animated.View>;
}
function CenaRenda({ ativo }: { ativo: boolean }) {
  const t = useTema();
  const partes: Array<[string, number, string]> = [[t.cores.s1, 50, "Ações"], [t.cores.s2, 30, "FIIs"], [t.cores.s3, 20, "Reserva"]];
  const colunas = [30, 42, 28, 55, 47, 62, 58, 70, 66, 81, 77, 92];
  return (
    <CartaoCena>
      <Rot>Plano do mês · 30% do salário</Rot>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", gap: 2, marginTop: 10 }}>
        {partes.map(([c, p], i) => <Barra key={i} i={i} ativo={ativo} cor={c} pct={p} />)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 8 }}>
        {partes.map(([c, p, n]) => <T key={n} style={{ fontSize: 11.5, color: t.cores.ink2 }}><Text style={{ color: c }}>● </Text>{n} {p}%</T>)}
      </View>
      <View style={{ marginTop: 16 }}><Rot>Dividendos por mês</Rot></View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height: 64, marginTop: 8 }}>
        {colunas.map((h, i) => <Coluna key={i} i={i} ativo={ativo} h={h} />)}
      </View>
    </CartaoCena>
  );
}
function Barra({ i, ativo, cor, pct }: any) {
  const a = useEntrada(ativo, 200 + i * 150, 600);
  return <Animated.View style={{ width: `${pct}%` as any, backgroundColor: cor, transform: [{ scaleX: a }], transformOrigin: "left" } as any} />;
}
function Coluna({ i, ativo, h }: any) {
  const t = useTema();
  const a = useEntrada(ativo, 500 + i * 40, 500);
  return <Animated.View style={{ flex: 1, height: `${h}%` as any, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: t.cores.verde, opacity: 0.85, transform: [{ scaleY: a }], transformOrigin: "bottom" } as any} />;
}
function CenaProjecoes({ ativo }: { ativo: boolean }) {
  const t = useTema();
  return (
    <CartaoCena>
      <Rot>Em 20 anos, em reais de hoje</Rot>
      <Svg viewBox="0 0 280 110" width="100%" height={110} style={{ marginTop: 8 }}>
        {ativo ? <Path d="M0 100 C90 90 180 55 280 8 L280 48 C180 78 90 96 0 100Z" fill={t.cores.acento} fillOpacity={0.12} /> : null}
        <Path d="M0 100 C90 93 180 70 280 28" fill="none" stroke={t.cores.acento} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 4, marginTop: 8 }}>
        <T style={{ fontSize: 11.5, color: t.cores.ink2 }}>pessimista · base · otimista</T>
        <T style={{ fontSize: 11.5, color: t.cores.ink2 }}>com reinvestimento dos proventos</T>
      </View>
    </CartaoCena>
  );
}
// privacidade: quem enxerga o quê
const ITENS_PRIVACIDADE: Array<[NomeIcone, string]> = [
  ["cadeado", "Cada conta só enxerga os próprios dados — o banco recusa o resto"],
  ["celular", "Neste aparelho, a sessão e o cache ficam cifrados"],
  ["olho", "Modo privado borra os valores; toque num deles para ver por 5 s"],
  ["exportar", "Backup e exclusão da conta quando quiser, em Ajustes"],
];
// acesso: quem consegue entrar
const ITENS_ACESSO: Array<[NomeIcone, string]> = [
  ["check", "Verificação em duas etapas, com autenticador reserva"],
  ["escudo", "Senha forte, checada contra vazamentos, e limite de tentativas"],
  ["cadeado", "Bloqueio por Face ID, digital ou PIN ao abrir o app"],
  ["info", "Esqueceu a senha? Um código chega no seu e-mail"],
];
function CenaEscudo({ ativo, itens, icone }: { ativo: boolean; itens: Array<[NomeIcone, string]>; icone: NomeIcone }) {
  const t = useTema();
  const a = useEntrada(ativo, 0, 600);
  return (
    <View style={{ alignItems: "center", gap: 14, width: "100%", maxWidth: 380 }}>
      <Animated.View style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.verdeSuave, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
        <Icone nome={icone} tam={34} cor={t.cores.verde} />
      </Animated.View>
      <View style={{ gap: 8, alignSelf: "stretch" }}>{itens.map(([ic, tx], i) => <ItemSeg key={i} i={i} ativo={ativo} ic={ic} tx={tx} />)}</View>
    </View>
  );
}
const CenaSeguranca = ({ ativo }: { ativo: boolean }) => <CenaEscudo ativo={ativo} itens={ITENS_PRIVACIDADE} icone="escudo" />;
const CenaAcesso = ({ ativo }: { ativo: boolean }) => <CenaEscudo ativo={ativo} itens={ITENS_ACESSO} icone="cadeado" />;

// o que dá para ajustar ao seu jeito
const NOVIDADES: Array<[NomeIcone, string]> = [
  ["bussola", "Perfil do investidor"], ["recibo", "Imposto de renda"], ["play", "Retrospectiva do ano"],
  ["ordenar", "Layout do Início"], ["ajustes", "Módulos ligados"], ["olho", "Modo privado"],
];
function CenaSeuJeito({ ativo }: { ativo: boolean }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 360 }}>
      {NOVIDADES.map(([ic, tx], i) => <Ladrilho key={tx} i={i} ativo={ativo} ic={ic} tx={tx} cor={t.cores.acento} />)}
    </View>
  );
}
function Ladrilho({ i, ativo, ic, tx, cor }: { i: number; ativo: boolean; ic: NomeIcone; tx: string; cor: string }) {
  const t = useTema();
  const a = useEntrada(ativo, 150 + i * 80);
  return (
    <Animated.View style={[{ width: 108, alignItems: "center", gap: 8, backgroundColor: t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 8 }, sobe(a)]}>
      <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}><Icone nome={ic} tam={18} cor={cor} /></View>
      <T centro style={{ fontSize: 12.5, lineHeight: 16, fontWeight: "500" }}>{tx}</T>
    </Animated.View>
  );
}
function ItemSeg({ i, ativo, ic, tx }: any) {
  const t = useTema();
  const a = useEntrada(ativo, 300 + i * 100);
  return (
    <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.cores.bg2, borderWidth: 1, borderColor: t.cores.linha, borderRadius: t.raios.sm, paddingVertical: 10, paddingHorizontal: 14 }, sobe(a)]}>
      <Icone nome={ic} tam={16} cor={t.cores.acento} /><T style={{ fontSize: 13.5, lineHeight: 19, flexShrink: 1 }}>{tx}</T>
    </Animated.View>
  );
}
const CENAS: Record<string, (p: { ativo: boolean }) => React.ReactElement> = {
  boasVindas: CenaBoasVindas, patrimonio: CenaPatrimonio, investimentos: CenaInvestimentos, aportes: CenaAportes,
  renda: CenaRenda, projecoes: CenaProjecoes, seuJeito: CenaSeuJeito, seguranca: CenaSeguranca, acesso: CenaAcesso,
};

const COMECOS: Array<[string, NomeIcone, string, string]> = [
  ["ativos", "ativos", "Cadastrar meus investimentos", "ações, FIIs, cripto e renda fixa"],
  ["salario", "carteira", "Registrar meu salário", "e montar o plano do mês"],
  ["aportes", "aportes", "Lançar um aporte", "o que você comprou hoje"],
  ["inicio", "inicio", "Só explorar", "vou olhando com calma"],
];
function passos(nome: string) {
  return [
    { cena: "boasVindas", titulo: nome ? `Olá, ${nome}!` : "Boas-vindas ao Bullz", texto: "Tudo o que você investe num lugar só: bolsa, cripto, renda fixa e até o gado. Em um minuto, veja o que dá para fazer." },
    { cena: "patrimonio", titulo: "Seu patrimônio, sempre atualizado", texto: "O Início soma tudo com preços de mercado a cada minuto e guarda uma foto por dia. O gráfico mostra quanto você cresceu no mês, no ano ou desde o começo." },
    { cena: "investimentos", titulo: "Cada ativo avaliado", texto: "Em Investimentos, cadastre o que tem ou acompanha. O painel busca cotações e mostra se cada um está dentro, perto ou fora dos seus critérios, olhando o histórico do ativo, suas regras, os pares e a renda fixa. É uma régua sua, não uma recomendação." },
    { cena: "aportes", titulo: "Aportes em dois toques", texto: "Registre cada compra e repita os aportes de sempre informando só quantidade e valor. No Agro, controle compra, venda, custos e o rebanho atual." },
    { cena: "renda", titulo: "Salário, plano e dividendos", texto: "Cadastre seus ganhos, defina quanto investir e para onde. O guia do mês mostra o que falta aportar, e Dividendos mostra quanto cada ativo paga e quando cai." },
    { cena: "projecoes", titulo: "Onde isso vai dar", texto: "Projeções usa seu plano, reinveste os proventos e mostra três cenários em reais de hoje. Em Simular, teste mudanças antes de fazer." },
    { cena: "seuJeito", titulo: "Do seu jeito", texto: "Responda o perfil do investidor para receber um plano, acompanhe o resumo para o imposto de renda e reveja o ano na retrospectiva. Em Ajustes, escolha os módulos e a ordem dos blocos do Início." },
    { cena: "seguranca", titulo: "Seus dados são só seus", texto: "Ninguém além de você lê sua carteira. E quando estiver em público, o modo privado esconde os valores com um toque." },
    { cena: "acesso", titulo: "Sua conta protegida", texto: "Ligue a verificação em duas etapas e o bloqueio por biometria em Ajustes → Segurança. São dois minutos que fecham a porta para quem descobrir sua senha." },
    { final: true, titulo: "Vamos começar?", texto: "Ajuste o básico. Dá para mudar tudo depois em Ajustes." },
  ] as Array<{ cena?: string; final?: boolean; titulo: string; texto: string }>;
}

// ---------------------------------------------------------------- apresentação
function Apresentacao({ api }: { api: ApiFolha }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { estreito } = useMedidas();
  const [prefTema, definePrefTema] = usePrefTema();
  const u = FC.auth.usuario || {};
  const nomeAtual = (u.user_metadata || {}).nome || "";
  const lista = useRef(passos(nomeAtual)).current;
  const [i, setI] = useState(0);
  const [nome, setNome] = useState(nomeAtual);
  const [mods, setMods] = useState<Record<string, boolean>>(() => Object.fromEntries(FC.MODULOS.filter((m: any) => ["agro", "cripto", "exterior"].includes(m.chave)).map((m: any) => [m.chave, !!FC.modulo(m.chave)])));
  const [comeco, setComeco] = useState("ativos");
  const entra = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  const p = lista[i];

  const mostra = (n: number) => {
    const novo = Math.max(0, Math.min(lista.length - 1, n));
    dir.current = novo >= i ? 1 : -1;
    setI(novo);
  };
  useEffect(() => {
    entra.setValue(0);
    Animated.timing(entra, { toValue: 1, duration: 500, easing: mola, useNativeDriver: nd }).start();
  }, [i, entra]);

  const fecha = async (concluiu: boolean) => {
    aberto = false;
    api.fechar();
    if (concluiu) {
      const modulos = { ...FC.estado.prefs.modulos, ...mods };
      if (JSON.stringify(modulos) !== JSON.stringify(FC.estado.prefs.modulos)) {
        try { await FC.db.gravaPrefs({ modulos }); FC.estado.prefs.modulos = modulos; FC.estado.base.prefsBrutas.modulos = modulos; } catch (e) { console.error(e); }
      }
    }
    const dados: any = { onboarding_visto: new Date().toISOString() };
    if (concluiu && nome.trim() !== nomeAtual) dados.nome = nome.trim();
    try { const r = await FC.sb.auth.updateUser({ data: dados }); if (r.data && r.data.user) FC.auth.usuario = r.data.user; } catch (e) { console.error(e); }
    rerender();
    if (concluiu) {
      router.push(("/" + comeco) as any);
      if (comeco !== "inicio") ui.aviso(COMECOS.find((c) => c[0] === comeco)![2]);
    }
  };
  const avancar = () => (p.final ? fecha(true) : mostra(i + 1));

  // teclado (web): setas, Enter, Esc
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as any).tagName === "INPUT" && e.key !== "Enter" && e.key !== "Escape") return;
      if (e.key === "ArrowRight" || (e.key === "Enter" && !p.final)) { e.preventDefault(); avancar(); }
      else if (e.key === "Enter" && p.final) { e.preventDefault(); fecha(true); }
      else if (e.key === "ArrowLeft") mostra(i - 1);
      else if (e.key === "Escape") fecha(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });
  // arrastar para os lados
  const arrasta = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_e, g) => { if (Math.abs(g.dx) > 50) { if (g.dx < 0) avancarRef.current(); else voltarRef.current(); } },
  })).current;
  const avancarRef = useRef(avancar); avancarRef.current = avancar;
  const voltarRef = useRef(() => mostra(i - 1)); voltarRef.current = () => mostra(i - 1);

  const Cena = p.cena ? CENAS[p.cena] : null;
  const opcao = ([id, ic, ti, d]: [string, NomeIcone, string, string]) => {
    const m = comeco === id;
    return (
      <Pressable key={id} onPress={() => setComeco(id)} accessibilityRole="radio" accessibilityState={{ checked: m }}
        style={{ flexBasis: estreito ? "100%" : "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: t.raios.sm, borderWidth: 1.5,
          borderColor: m ? t.cores.acento : t.cores.linha, backgroundColor: m ? t.cores.acentoSuave : t.cores.bg2 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}><Icone nome={ic} tam={20} cor={t.cores.acento} /></View>
        <View style={{ flex: 1 }}><T style={{ fontSize: 13.5, fontWeight: "600" }}>{ti}</T><T style={{ fontSize: 11.5, color: t.cores.ink3 }}>{d}</T></View>
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: m ? t.cores.acento : t.cores.linha2, backgroundColor: m ? t.cores.acento : "transparent", alignItems: "center", justifyContent: "center" }}>
          {m ? <Icone nome="check" tam={14} cor="#fff" /> : null}
        </View>
      </Pressable>
    );
  };
  const final = (
    <View style={{ gap: 16, marginTop: 16 }}>
      <Campo rotulo="Como quer ser chamado?"><Entrada valor={nome} aoMudar={setNome} maxLength={40} placeholder="seu nome" autoComplete="given-name" autoCapitalize="words" accessibilityLabel="Nome" /></Campo>
      <Campo rotulo="Tema"><Segmentado cheio valor={prefTema} aoMudar={definePrefTema} opcoes={[{ v: "auto", rotulo: "Automático" }, { v: "claro", rotulo: "Claro" }, { v: "escuro", rotulo: "Escuro" }]} /></Campo>
      <Campo rotulo="Você também investe em…" dica="Outras ferramentas se ligam em Ajustes → Módulos.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FC.MODULOS.filter((m: any) => ["agro", "cripto", "exterior"].includes(m.chave)).map((m: any) => {
            const on = !!mods[m.chave];
            return (
              <Pressable key={m.chave} onPress={() => setMods({ ...mods, [m.chave]: !on })} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: 980, borderWidth: 1.5,
                  borderColor: on ? t.cores.acento : t.cores.linha, backgroundColor: on ? t.cores.acentoSuave : t.cores.bg2 }}>
                <Icone nome={m.icone} tam={16} cor={on ? t.cores.acento : t.cores.ink3} />
                <Text style={{ fontSize: 14, color: on ? t.cores.acento : t.cores.ink, fontWeight: on ? "500" : "400" }}>{m.nome}</Text>
              </Pressable>
            );
          })}
        </View>
      </Campo>
      <Campo rotulo="Por onde começar?"><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{COMECOS.map(opcao)}</View></Campo>
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: estreito ? 0 : 24, backgroundColor: "rgba(0,0,0,.28)",
      ...(Platform.OS === "web" ? { backdropFilter: "blur(18px) saturate(160%)" } : {}) } as any}>
      <View style={{ width: "100%", maxWidth: estreito ? undefined : 520, height: estreito ? "100%" : undefined, maxHeight: estreito ? undefined : "92%",
        backgroundColor: t.cores.vidroForte, borderRadius: estreito ? 0 : 28, borderWidth: estreito ? 0 : 1, borderColor: t.cores.linha, boxShadow: t.cores.sombraAlta,
        paddingTop: estreito ? insets.top + 8 : 16, paddingHorizontal: estreito ? 16 : 24, paddingBottom: estreito ? insets.bottom + 16 : 24, overflow: "hidden",
        ...(Platform.OS === "web" ? { backdropFilter: "blur(30px) saturate(180%)" } : {}) } as any} accessibilityViewIsModal accessibilityLabel="Apresentação do Bullz">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 40 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: t.cores.campo, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${((i + 1) / lista.length) * 100}%` as any, borderRadius: 4, backgroundColor: "#0a84ff",
              ...degrade("linear-gradient(90deg, #0a84ff, #5e5ce6)"),
              ...(Platform.OS === "web" ? { transition: "width .45s cubic-bezier(.32,.72,0,1)" } : {}) } as any} />
          </View>
          <View style={{ opacity: p.final ? 0 : 1 }} pointerEvents={p.final ? "none" : "auto"}><Botao variante="texto" pequeno onPress={() => fecha(false)}>Pular</Botao></View>
        </View>
        <ScrollView style={{ flexGrow: estreito ? 1 : 0 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 16 }} {...arrasta.panHandlers} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: entra, transform: [{ translateX: entra.interpolate({ inputRange: [0, 1], outputRange: [48 * dir.current, 0] }) }] }}>
            {Cena ? <View style={{ minHeight: 230, alignItems: "center", justifyContent: "center" }}><Cena ativo /></View> : null}
            <T centro={!p.final} style={{ fontSize: estreito ? 24 : 26, fontWeight: "600", letterSpacing: -0.5, marginTop: p.final ? 8 : 24 }}>{p.titulo}</T>
            <T centro={!p.final} style={{ color: t.cores.ink2, fontSize: 16, lineHeight: 24, marginTop: 10, alignSelf: "center", maxWidth: 420 }}>{p.texto}</T>
            {p.final ? final : null}
          </Animated.View>
        </ScrollView>
        {/* no celular, 10 passos + dois botões mal cabem em 343 px: pontinhos e vãos menores */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: estreito ? 8 : 16, paddingTop: 16 }}>
          <View style={{ opacity: i ? 1 : 0 }} pointerEvents={i ? "auto" : "none"}><Botao variante="sec" style={{ minWidth: estreito ? 88 : 108 }} onPress={() => mostra(i - 1)}>Voltar</Botao></View>
          <View style={{ flexDirection: "row", gap: estreito ? 4 : 6, flexShrink: 1 }}>
            {lista.map((_, k) => (
              <Pressable key={k} onPress={() => mostra(k)} accessibilityLabel={`Passo ${k + 1}`} hitSlop={6}
                style={{ width: k === i ? (estreito ? 16 : 22) : estreito ? 6 : 7, height: estreito ? 6 : 7, borderRadius: 4, backgroundColor: k === i ? t.cores.acento : t.cores.linha2 }} />
            ))}
          </View>
          <Botao style={{ minWidth: estreito ? 88 : 108 }} onPress={avancar}>{p.final ? "Começar" : i === 0 ? "Vamos lá" : "Próximo"}</Botao>
        </View>
      </View>
    </View>
  );
}

let aberto = false;
function abre() {
  if (aberto) return;
  aberto = true;
  telaCheia((api) => <Apresentacao api={api} />, { fundo: "transparent" });
}
FC.onboarding = {
  precisa() { const u = FC.auth.usuario; return !!u && !((u.user_metadata || {}).onboarding_visto); },
  abre,
};
export {};
