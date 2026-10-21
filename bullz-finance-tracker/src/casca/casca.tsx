/* Casca — o topo, as abas e a página. Port do casca()/abreMenuTopo()/abreMais()
 * do app.js e dos avisos de telas/comum.js.
 *
 * > 1100 px: menu do topo com as abas ligadas, na ordem do layout.
 * ≤ 1100 px: barra de baixo com as 4 primeiras abas do layout + "Mais". */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, Pressable, RefreshControl, ScrollView, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { useTema } from "../tema";
import { useApp, rotasLigadas, noCelular, ROTAS, alternaPrivado, atualizaCotacoes, rotaValida, ocupado } from "../estado/app";
import { useMedidas } from "../ui/medidas";
import { Icone, type NomeIcone } from "../ui/icone";
import { Botao, Item, Lista, T, Vazio, BotaoIcone, Gira } from "../ui/kit";
import { ui } from "../ui/folha";
import FC from "../nucleo";
import { vibra } from "../plataforma/vibra";
import { ItemAlerta, obterAlertas } from "../telas/comum/alertas";
import { AvisoUso, rotaMudou } from "../estado/uso";
import { BannerInstalar } from "../telas/instalar";

/** id da rota atual, pela URL (/ativos → "ativos") */
export function useRotaAtual(): { id: string; params: string[] } {
  const p = usePathname() || "/";
  const partes = p.replace(/^\/+/, "").split("/").filter(Boolean);
  return { id: rotaValida(partes[0] || "inicio"), params: partes.slice(1).map(decodeURIComponent) };
}

export function vaiPara(caminho: string) {
  const c = caminho.replace(/^#?\/?/, "/");
  router.push(c as any);
}

// ---------------------------------------------------------------- folhas do topo
export function abreAlertas() {
  ui.folha({
    titulo: "Avisos e Atenção",
    corpo: (api) => <CorpoAlertas fechar={api.fechar} />,
  });
}
function CorpoAlertas({ fechar }: { fechar: () => void }) {
  const t = useTema();
  useApp((s) => s.versao);
  const lista = obterAlertas();
  if (!lista.length) {
    return (
      <View style={{ paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" }}>
        <View style={{ marginBottom: 12 }}><Icone nome="check" tam={32} cor={t.cores.verde} /></View>
        <T style={{ fontSize: 18, fontWeight: "600", marginBottom: 6 }}>Tudo em dia</T>
        <T v="p" centro>Nenhum aviso ou pendência na sua carteira no momento.</T>
      </View>
    );
  }
  return (
    <View>
      <T style={{ fontSize: 13.5, color: t.cores.ink2, marginBottom: t.espaco.e4 }}>O que merece um olhar na sua carteira:</T>
      <Lista>{lista.map((a: any, i: number) => <ItemAlerta key={i} a={a} aoAbrir={fechar} />)}</Lista>
    </View>
  );
}

function abreMenuTopo(rotaId: string) {
  ui.folha({ titulo: "Mais opções", corpo: (api) => <MenuTopo fechar={api.fechar} rotaId={rotaId} /> });
}
function MenuTopo({ fechar, rotaId }: { fechar: () => void; rotaId: string }) {
  const t = useTema();
  const carregando = useApp((s) => s.carregandoMercado);
  const admin = useApp((s) => s.admin);
  const e = FC.estado;
  const it = (icone: NomeIcone, titulo: string, detalhe: string | null, acao: () => void, opcoes: { perigo?: boolean; chevron?: boolean; girando?: boolean } = {}) => (
    <Item onPress={acao} chevron={opcoes.chevron}
      esquerda={<View style={{ transform: [{ rotate: "0deg" }] }}><Icone nome={icone} tam={20} cor={opcoes.perigo ? t.cores.vermelho : t.cores.acento} /></View>}
      titulo={<T style={{ fontWeight: "600", fontSize: 15, color: opcoes.perigo ? t.cores.vermelho : t.cores.ink }}>{titulo}</T>}
      detalhe={detalhe ?? undefined} />
  );
  const vai = (c: string) => () => { fechar(); vaiPara(c); };
  return (
    <Lista>
      {it("atualizar", "Atualizar cotações",
        carregando ? "Atualizando cotações agora…" : e.spotEm ? `Última atualização ${FC.datas.ha(e.spotEm)}` : "Buscar preços mais recentes",
        async () => {
          fechar();
          const erro = await atualizaCotacoes();
          if (erro) ui.aviso(erro, "erro"); else ui.aviso("Cotações atualizadas");
        })}
      {it("ajuda", "Como usar esta tela", "Explicação e dicas desta seção", () => { fechar(); FC.guiaDaTela && FC.guiaDaTela(rotaId); })}
      {FC.dispositivo.podeAdicionarATela() ? it("celular", "Adicionar à Tela de Início", FC.dispositivo.ehIOS ? "Instalar no iPhone / iPad" : "Instalar no celular como app",
        () => { fechar(); FC.abreGuiaInstalacao && FC.abreGuiaInstalacao(); }, { chevron: true }) : null}
      {it("bussola", "Perfil do investidor", "Seu perfil, o plano e o relatório", vai("/perfil"), { chevron: true })}
      {it("ajustes", "Ajustes", "Metas, regras, segurança e módulos", vai("/ajustes"), { chevron: true })}
      {admin ? it("escudo", "Administração", null, vai("/admin"), { chevron: true }) : null}
      {it("sair", "Sair da conta", null, async () => { fechar(); await FC.sair(); }, { perigo: true })}
    </Lista>
  );
}

function abreMais() {
  ui.folha({ titulo: "Mais", corpo: (api) => <MenuMais fechar={api.fechar} /> });
}
function MenuMais({ fechar }: { fechar: () => void }) {
  const t = useTema();
  const admin = useApp((s) => s.admin);
  useApp((s) => s.versao);
  const cel = noCelular();
  const extras = rotasLigadas().filter((x) => !cel.includes(x.id) && x.id !== "retrospectiva" && x.id !== "perfil" && x.id !== "admin");
  return (
    <Lista>
      {extras.map((x) => (
        <Item key={x.id} chevron onPress={() => { fechar(); vaiPara("/" + x.id); }}
          esquerda={<Icone nome={x.icone as NomeIcone} tam={22} cor={t.cores.acento} />} titulo={x.nome} />
      ))}
      {admin ? <Item chevron onPress={() => { fechar(); vaiPara("/admin"); }} esquerda={<Icone nome="escudo" tam={22} cor={t.cores.acento} />} titulo="Administração" /> : null}
      <Item onPress={async () => { fechar(); await FC.sair(); }} esquerda={<Icone nome="sair" tam={22} cor={t.cores.vermelho} />}
        titulo={<T style={{ fontWeight: "600", color: t.cores.vermelho }}>Sair</T>} />
    </Lista>
  );
}

// ---------------------------------------------------------------- topo
function Topo() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { celular, estreito, medio } = useMedidas();
  const { id } = useRotaAtual();
  const privado = useApp((s) => s.privado);
  const carregando = useApp((s) => s.carregandoMercado);
  useApp((s) => s.versao);
  const alertas = obterAlertas();
  const urgente = alertas.some((x: any) => x.nivel === "alto");
  const tamLogo = estreito ? 32 : 36;
  const txtAlertas = alertas.length
    ? `${alertas.length} ${alertas.length === 1 ? "aviso que requer atenção" : "avisos que requerem atenção"}`
    : "Avisos e atenção (nenhuma pendência)";
  return (
    <View dataSet={{ imprimir: "nao" }} style={{ backgroundColor: t.cores.vidro, borderBottomWidth: 1, borderBottomColor: t.cores.linha, paddingTop: insets.top, zIndex: 40,
      ...(Platform.OS === "web" ? { position: "sticky", top: 0, backdropFilter: "saturate(180%) blur(20px)" } : {}) } as any}>
      <View style={{ maxWidth: 1180, width: "100%", alignSelf: "center", height: 52, flexDirection: "row", alignItems: "center",
        gap: t.espaco.e3, paddingHorizontal: estreito ? 14 : celular ? 16 : 24 }}>
        <Pressable onPress={() => vaiPara("/inicio")} accessibilityRole="link" accessibilityLabel="Bullz, ir para o Início"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: estreito ? 9 : 10, marginRight: celular ? "auto" : undefined, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
          <Image source={require("../../assets/img/icone-192.png")} style={{ width: tamLogo, height: tamLogo, borderRadius: 9 }} resizeMode="contain" />
          <Text style={{ fontWeight: "700", fontSize: estreito ? 16 : medio ? 15 : 17, letterSpacing: -0.4, color: t.cores.ink }}>Bullz</Text>
        </Pressable>
        {!celular ? (
          <View style={{ flexDirection: "row", gap: 2, marginHorizontal: "auto", flexShrink: 1 }} accessibilityRole="tablist">
            {rotasLigadas().filter((x) => !x.oculta).map((x) => {
              const atual = x.id === id;
              return (
                <Pressable key={x.id} onPress={() => vaiPara("/" + x.id)} accessibilityRole="tab" accessibilityState={{ selected: atual }}
                  style={({ hovered }: any) => ({ paddingVertical: medio ? 7 : 6, paddingHorizontal: medio ? 9 : 12, borderRadius: 980,
                    backgroundColor: atual || hovered ? t.cores.campo : "transparent" })}>
                  <Text style={{ fontSize: 13.5, color: atual ? t.cores.ink : t.cores.ink2, fontWeight: atual ? "500" : "400" }} numberOfLines={1}>{x.nome}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
          <BotaoIcone nome="sino" rotulo={txtAlertas} onPress={abreAlertas}>
            {alertas.length ? (
              <View style={{ position: "absolute", top: 1, right: 1, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 980,
                backgroundColor: urgente ? t.cores.vermelho : t.cores.amarelo, alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 0 2px ${t.cores.bg2}` } as any}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 17 }}>{alertas.length > 9 ? "9+" : String(alertas.length)}</Text>
              </View>
            ) : null}
          </BotaoIcone>
          <BotaoIcone nome={privado ? "olhoFechado" : "olho"} rotulo={privado ? "Mostrar valores" : "Esconder valores (modo privado)"} onPress={alternaPrivado} />
          <BotaoIcone nome="mais" tam={20} rotulo="Mais opções" girando={carregando} onPress={() => abreMenuTopo(id)} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- barra de abas (celular)
function BarraAbas() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { id } = useRotaAtual();
  useApp((s) => s.versao);
  const cel = noCelular();
  const aba = (chave: string, icone: NomeIcone, nome: string, atual: boolean, onPress: () => void) => (
    <Pressable key={chave} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: atual }} accessibilityLabel={nome}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4, minHeight: 48, borderRadius: 12, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Icone nome={icone} tam={22} cor={atual ? t.cores.acento : t.cores.ink3} />
      <Text style={{ fontSize: 11, lineHeight: 13, fontWeight: atual ? "600" : "500", color: atual ? t.cores.acento : t.cores.ink3 }} numberOfLines={1}>{nome}</Text>
    </Pressable>
  );
  return (
    <View dataSet={{ imprimir: "nao" }} style={{ position: Platform.OS === "web" ? ("fixed" as any) : "absolute", left: 0, right: 0, bottom: 0, zIndex: 40,
      // vidro fosco só existe na web (backdropFilter); no celular o conteúdo que rola
      // aparecia através da barra, então lá ela é sólida
      backgroundColor: Platform.OS === "web" ? t.cores.vidroForte : t.cores.bg2, borderTopWidth: 1, borderTopColor: t.cores.linha,
      paddingTop: 6, paddingHorizontal: 10, paddingBottom: 8 + insets.bottom,
      ...(Platform.OS === "web" ? { backdropFilter: "saturate(180%) blur(20px)" } : {}) } as any}>
      <View style={{ flexDirection: "row", justifyContent: "space-around", maxWidth: 580, width: "100%", alignSelf: "center" }} accessibilityRole="tablist">
        {cel.map((rid) => {
          const x = ROTAS.find((y) => y.id === rid)!;
          return aba(x.id, x.icone as NomeIcone, x.nome, x.id === id, () => vaiPara("/" + x.id));
        })}
        {aba("mais", "mais", "Mais", !cel.includes(id), abreMais)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- erro da tela
/** como o rerender do site: um erro ao montar a tela vira mensagem, não derruba o app */
class BarreiraTela extends React.Component<{ rota: string; children: React.ReactNode }, { erro: any }> {
  state = { erro: null as any };
  static getDerivedStateFromError(erro: any) { return { erro }; }
  componentDidCatch(e: any) { console.error(e); }
  componentDidUpdate(ant: { rota: string }) { if (ant.rota !== this.props.rota && this.state.erro) this.setState({ erro: null }); }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <Pagina>
        <View style={{ marginTop: 8 }}>
          <MensagemErro texto={`Algo deu errado ao montar esta tela: ${this.state.erro.message || this.state.erro}`} />
        </View>
      </Pagina>
    );
  }
}
function MensagemErro({ texto }: { texto: string }) {
  const t = useTema();
  return (
    <View style={{ borderRadius: t.raios.sm, padding: 12, paddingHorizontal: 16, flexDirection: "row", gap: 10, backgroundColor: t.cores.vermelhoSuave }}>
      <Icone nome="alerta" tam={18} cor={t.cores.vermelho} />
      <Text style={{ color: t.cores.vermelho, fontSize: 14, flex: 1 }}>{texto}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- casca
export function Casca({ children }: { children: React.ReactNode }) {
  const t = useTema();
  const { celular } = useMedidas();
  useApp((s) => s.admin); // /admin só vira rota válida depois que o banco confirma
  const { id } = useRotaAtual();
  const caminho = usePathname() || "/";
  useEffect(() => { rotaMudou(caminho); }, [caminho]);
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      // endereço desconhecido cai no +not-found, mas a rota "válida" seria o Início
      const conhecida = caminho === "/" || ROTAS.some((r) => r.id === caminho.split("/")[1]);
      document.title = (conhecida ? ((ROTAS.find((r) => r.id === id) || {}) as any).nome : "Página não encontrada") + " · Bullz";
    }
  }, [id, caminho]);
  return (
    <View style={{ flex: 1, backgroundColor: t.cores.bg }}>
      <Topo />
      <View style={{ flex: 1 }}><BarreiraTela rota={id}>{children}</BarreiraTela></View>
      {celular ? <BarraAbas /> : null}
      <AvisoUso />
      {Platform.OS === "web" ? <BannerInstalar /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- página
/** main + .pagina: rolagem, largura máxima e a entrada que sobe. */
export function Pagina({ children, estreita, rolar = true }: { children: React.ReactNode; estreita?: boolean; rolar?: boolean }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { celular, estreito } = useMedidas();
  const a = useRef(new Animated.Value(0)).current;
  const nd = Platform.OS !== "web";
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 550, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: nd }).start();
  }, [a, nd]);
  const pad = estreito
    ? { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 80 + insets.bottom + 16 }
    : celular ? { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 116 + insets.bottom }
    : { paddingTop: 48, paddingHorizontal: 24, paddingBottom: 96 };
  const conteudo = (
    <Animated.View style={{ width: "100%", maxWidth: estreita ? 720 : 1180, alignSelf: "center", opacity: a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      {children}
    </Animated.View>
  );
  if (!rolar) return <View style={[{ flex: 1 }, pad]}>{conteudo}</View>;
  if (Platform.OS === "web") return <PaginaWeb pad={pad}>{conteudo}</PaginaWeb>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} tintColor={t.cores.ink3} onRefresh={atualizaComAviso} />}>
      {conteudo}
    </ScrollView>
  );
}

async function atualizaComAviso() {
  const e = await atualizaCotacoes();
  ui.aviso(e || "Cotações atualizadas", e ? "erro" : "ok");
}

// ---------------------------------------------------------------- puxar para atualizar (web)
// O RefreshControl não existe no navegador: no celular, puxar a página para
// baixo quando ela está no topo atualiza as cotações. Uma bolinha desce do topo
// girando com o dedo; passou do ponto, vibra; soltou, gira até terminar. A
// página não se move (o iPhone já faz o elástico dele na rolagem).
const LIMITE = 72, MAXIMO = 110;
function PaginaWeb({ pad, children }: { pad: object; children: React.ReactNode }) {
  const t = useTema();
  const toque = !!(FC.dispositivo && FC.dispositivo.ehMobile);
  const topo = useRef(0), ini = useRef<number | null>(null), passou = useRef(false), tocando = useRef(false);
  const puxo = useRef(new Animated.Value(0)).current;
  const [girando, setGirando] = useState(false);
  const volta = (v = 0) => Animated.spring(puxo, { toValue: v, damping: 24, stiffness: 240, useNativeDriver: false }).start();
  const solta = async () => {
    if (ini.current == null) return;
    ini.current = null;
    if (!passou.current) { volta(); return; }
    passou.current = false;
    setGirando(true); volta(52);
    try { await atualizaComAviso(); } finally { setGirando(false); volta(); }
  };
  const gestos = toque ? {
    onTouchStart: (e: any) => {
      tocando.current = !girando && !ocupado.editandoLayout;
      ini.current = tocando.current && topo.current <= 0 ? e.nativeEvent.touches[0].pageY : null;
      passou.current = false;
    },
    onTouchMove: (e: any) => {
      const y = e.nativeEvent.touches[0].pageY;
      // rolou até o topo no meio do gesto: o puxão começa daqui
      if (ini.current == null) { if (tocando.current && topo.current <= 0) ini.current = y; return; }
      const d = y - ini.current;
      if (topo.current > 0 || d < 0) { ini.current = null; volta(); return; }
      // resistência: o dedo anda mais que a bolinha
      const v = Math.min(MAXIMO, d * 0.5);
      puxo.setValue(v);
      const p = v >= LIMITE;
      if (p !== passou.current) { passou.current = p; if (p) vibra.leve(); }
    },
    onTouchEnd: () => { tocando.current = false; solta(); },
    onTouchCancel: () => { tocando.current = false; ini.current = null; passou.current = false; volta(); },
  } : {};
  return (
    <View style={{ flex: 1 }} {...gestos}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16} onScroll={(e) => { topo.current = e.nativeEvent.contentOffset.y; }}>
        {children}
      </ScrollView>
      {toque ? (
        <Animated.View pointerEvents="none" accessibilityElementsHidden
          style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center",
            opacity: puxo.interpolate({ inputRange: [0, 24, 40], outputRange: [0, 0, 1], extrapolate: "clamp" }),
            transform: [{ translateY: puxo.interpolate({ inputRange: [0, MAXIMO], outputRange: [-40, MAXIMO - 40] }) }] }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.cores.bg2, alignItems: "center", justifyContent: "center",
            boxShadow: t.cores.sombraAlta } as any}>
            <Animated.View style={{ transform: [{ rotate: puxo.interpolate({ inputRange: [0, LIMITE], outputRange: ["-180deg", "0deg"], extrapolate: "clamp" }) }] }}>
              <Gira ativo={girando}><Icone nome="atualizar" tam={18} cor={t.cores.acento} /></Gira>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** estado da tela enquanto a base não chegou */
export function SemBase() {
  return <Vazio icone="carteira" titulo="Abrindo seus dados…" />;
}

export { Botao };
