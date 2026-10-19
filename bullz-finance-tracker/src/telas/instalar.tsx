/* Instalar como app (PWA) — port de FC.abreGuiaInstalacao e
 * FC.mostraBannerInstalacaoSePreciso do app.js do site. Só faz sentido no
 * navegador: no app nativo FC.dispositivo.ehInstalado já é true. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "../tema";
import { useMedidas } from "../ui/medidas";
import { Botao, T } from "../ui/kit";
import { Icone, type NomeIcone } from "../ui/icone";
import { ui } from "../ui/folha";
import FC from "../nucleo";

// o ícone que vai para a tela inicial (scripts/gera-icones-app.js), não a logo solta
const ICONE_APP = require("../../assets/img/app/icone-app-1024.png");

function Topo({ sub }: { sub: string }) {
  const t = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 8, paddingHorizontal: 4, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: t.cores.linha }}>
      <Image source={ICONE_APP} accessibilityLabel="Bullz" style={{ width: 56, height: 56, borderRadius: 14, boxShadow: t.cores.sombra } as any} />
      <View>
        <T style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36 }}>Bullz</T>
        <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 2 }}>{sub}</T>
      </View>
    </View>
  );
}
function Pill({ icone, children }: { icone: NomeIcone; children: React.ReactNode }) {
  const t = useTema();
  return (
    <Text style={{ backgroundColor: t.cores.campo, color: t.cores.acento, fontWeight: "500", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Icone nome={icone} tam={14} cor={t.cores.acento} /> {children}
    </Text>
  );
}
function Passos({ itens }: { itens: React.ReactNode[] }) {
  const t = useTema();
  return (
    <View style={{ marginVertical: 16, gap: 14 }} accessibilityRole="list">
      {itens.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.cores.acentoSuave, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
            <Text style={{ color: t.cores.acento, fontSize: 13, fontWeight: "700" }}>{i + 1}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: t.cores.ink }}>{x}</Text>
        </View>
      ))}
    </View>
  );
}
function Vantagens({ itens }: { itens: string[] }) {
  const t = useTema();
  return (
    <View style={{ backgroundColor: t.cores.campo, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 14, gap: 6 }}>
      {itens.map((x) => (
        <View key={x} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icone nome="check" tam={16} cor={t.cores.verde} /><T style={{ fontSize: 13, color: t.cores.ink2 }}>{x}</T>
        </View>
      ))}
    </View>
  );
}
const B = ({ children }: { children: React.ReactNode }) => <Text style={{ fontWeight: "700" }}>{children}</Text>;

export function abreGuiaInstalacao() {
  const disp = FC.dispositivo;
  const prompt = !!disp.obterEventoInstall();
  const instala = async (fechar: () => void) => {
    const ev = disp.obterEventoInstall();
    if (!ev) return;
    fechar();
    try {
      await ev.prompt();
      const res = await ev.userChoice;
      if (res && res.outcome === "accepted") ui.aviso("Instalando aplicativo…");
    } catch (e) { console.error(e); }
  };
  ui.folha({
    titulo: "Adicionar à Tela de Início",
    corpo: (api) => disp.ehIOS ? (
      <View>
        <Topo sub="Adicionar à Tela de Início no iOS" />
        <Passos itens={[
          <>Toque no botão de <B>Compartilhar</B> <Pill icone="compartilhar">Compartilhar</Pill> na barra do Safari (na parte inferior do iPhone ou no topo do iPad).</>,
          <>Role a lista de ações para baixo e selecione <Pill icone="adicionarTela">Adicionar à Tela de Início</Pill>.</>,
          <>No canto superior direito, toque em <B>Adicionar</B>. O ícone oficial aparecerá na sua tela inicial!</>,
        ]} />
        <Vantagens itens={["Abertura em tela inteira sem barras de navegação", "Desempenho mais ágil e sensação nativa", "Acesso imediato com 1 toque"]} />
      </View>
    ) : prompt ? (
      <View>
        <Topo sub="Instalar aplicativo oficial" />
        <T v="p" style={{ marginTop: 12, fontSize: 14.5, lineHeight: 22 }}>Instale o Bullz no seu dispositivo para ter tela inteira, resposta instantânea e ícone dedicado.</T>
        <View style={{ marginTop: 16 }}><Botao cheio icone="celular" onPress={() => instala(api.fechar)}>Instalar no aparelho</Botao></View>
        <Vantagens itens={["Tela cheia sem barras de navegador", "Ícone próprio na tela de início", "Carregamento instantâneo"]} />
      </View>
    ) : disp.ehAndroid ? (
      <View>
        <Topo sub="Adicionar à Tela de Início no Android" />
        <Passos itens={[
          <>Toque no menu do seu navegador (os <B>três pontinhos ⋮</B> no topo ou na barra inferior).</>,
          <>Selecione <Pill icone="celular">Instalar aplicativo</Pill> ou <B>Adicionar à tela inicial</B>.</>,
          <>Confirme a instalação para criar o aplicativo na sua tela de início.</>,
        ]} />
        <Vantagens itens={["Tela cheia nativa sem barra de URL", "Acesso rápido e visual exclusivo"]} />
      </View>
    ) : (
      <View>
        <Topo sub="Instalar no computador ou tablet" />
        <Passos itens={[
          <>Na barra de endereços do Chrome, Edge ou Safari, clique no ícone de <B>Instalar aplicativo</B> (ou no menu do navegador).</>,
          <>Confirme <B>Instalar</B> para abrir o Bullz em sua própria janela dedicada.</>,
        ]} />
        <Vantagens itens={["Janela própria independente de abas", "Atalho direto no Dock ou menu Iniciar"]} />
      </View>
    ),
    rodape: (api) => <Botao variante={prompt ? "sec" : "primario"} onPress={api.fechar}>Entendi</Botao>,
  });
}

// ---------------------------------------------------------------- banner (celular, no navegador)
let mostraBanner: (() => void) | null = null;
export function mostraBannerInstalacaoSePreciso() {
  if (!FC.dispositivo.podeAdicionarATela()) return;
  const dispensado = FC.local.ler("pwa-banner-dispensado", 0);
  if (Date.now() - dispensado < 7 * 24 * 60 * 60 * 1000) return;
  setTimeout(() => { if (!FC.dispositivo.ehInstalado && mostraBanner) mostraBanner(); }, 3000);
}

/** o banner fica na casca; aparece 3 s depois de entrar, se fizer sentido */
export function BannerInstalar() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { celular } = useMedidas();
  const [aberto, setAberto] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mostraBanner = () => setAberto(true);
    mostraBannerInstalacaoSePreciso();
    return () => { mostraBanner = null; };
  }, []);
  useEffect(() => {
    if (aberto) Animated.timing(a, { toValue: 1, duration: 450, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: false }).start();
  }, [aberto, a]);
  if (!aberto || !FC.dispositivo.podeAdicionarATela()) return null;
  const fecha = () => {
    FC.local.gravar("pwa-banner-dispensado", Date.now());
    Animated.timing(a, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => setAberto(false));
  };
  return (
    <Animated.View dataSet={{ imprimir: "nao" }} accessibilityRole={"dialog" as any} accessibilityLabel="Adicionar à Tela de Início"
      style={{ position: "absolute", left: 14, right: 14, bottom: celular ? 66 + insets.bottom + 10 : 20, maxWidth: 440, alignSelf: "center", marginHorizontal: "auto", zIndex: 70,
        flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: t.cores.linha,
        backgroundColor: t.cores.vidroForte, boxShadow: t.cores.sombraAlta, backdropFilter: "blur(24px) saturate(180%)",
        opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] } as any}>
      <Image source={ICONE_APP} style={{ width: 42, height: 42, borderRadius: 11 }} accessibilityLabel="App" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontSize: 14, fontWeight: "600", lineHeight: 17.5 }}>Adicionar à Tela de Início</T>
        <T style={{ fontSize: 12, color: t.cores.ink2, lineHeight: 16, marginTop: 2 }}>{FC.dispositivo.ehIOS ? "Abra em tela cheia como app no seu iPhone" : "Instale no celular para acesso rápido"}</T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Botao pequeno onPress={() => { setAberto(false); abreGuiaInstalacao(); }}>Adicionar</Botao>
        <Pressable onPress={fecha} accessibilityRole="button" accessibilityLabel="Fechar aviso"
          style={({ hovered }: any) => ({ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: hovered ? t.cores.campo : "transparent" })}>
          <Icone nome="fechar" tam={16} cor={t.cores.ink3} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

FC.abreGuiaInstalacao = abreGuiaInstalacao;
FC.mostraBannerInstalacaoSePreciso = mostraBannerInstalacaoSePreciso;
