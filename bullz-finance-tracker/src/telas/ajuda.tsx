/* Guia da tela — port de telas/ajuda.js: o "Como usar esta tela" do menu abre
 * uma folha explicando cada parte da tela atual. O texto vem de guias.gen.ts,
 * extraído do próprio ajuda.js. */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { useTema } from "../tema";
import { B, Botao, T } from "../ui/kit";
import { Icone, type NomeIcone } from "../ui/icone";
import { ui } from "../ui/folha";
import { GUIAS } from "./guias.gen";
import FC from "../nucleo";

function Parte({ ic, titulo, texto, i, primeira }: { ic: string; titulo: string; texto: string; i: number; primeira: boolean }) {
  const t = useTema();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 450, delay: 50 + i * 50, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: Platform.OS !== "web" }).start();
  }, [a, i]);
  return (
    <Animated.View style={{ flexDirection: "row", gap: 14, paddingVertical: 12, borderTopWidth: primeira ? 0 : 1, borderTopColor: t.cores.linha,
      opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}>
        <Icone nome={ic as NomeIcone} tam={20} cor={t.cores.acento} />
      </View>
      <View style={{ flex: 1 }}>
        <B style={{ fontSize: 15 }}>{titulo}</B>
        <T style={{ color: t.cores.ink2, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{texto}</T>
      </View>
    </Animated.View>
  );
}

function Guia({ rota, fechar }: { rota: string; fechar: () => void }) {
  const t = useTema();
  const g = GUIAS[rota] || GUIAS.inicio;
  const rot = (txt: string) => <T style={{ fontSize: 12.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: t.cores.ink3, marginTop: t.espaco.e4, marginBottom: t.espaco.e2 }}>{txt}</T>;
  return (
    <View>
      <T style={{ fontSize: 16, lineHeight: 24 }}>{g.resumo}</T>
      {rot("Nesta tela")}
      {g.partes.map(([ic, ti, d], i) => <Parte key={i} ic={ic} titulo={ti} texto={d} i={i} primeira={i === 0} />)}
      {g.dicas && g.dicas.length ? (
        <>
          {rot("Dicas")}
          <View style={{ gap: 6 }}>{g.dicas.map((d, i) => <T key={i} style={{ color: t.cores.ink2, fontSize: 14, lineHeight: 20 }}>•  {d}</T>)}</View>
        </>
      ) : null}
      <Botao variante="texto" pequeno icone="info" style={{ marginTop: t.espaco.e3, paddingLeft: 0 }}
        onPress={() => { fechar(); setTimeout(() => FC.onboarding && FC.onboarding.abre(), 250); }}>Ver a apresentação completa</Botao>
    </View>
  );
}

FC.guiaDaTela = function (rota: string) {
  const nome = ((FC.ROTAS.find((r: any) => r.id === rota) || FC.ROTAS[0]) as any).nome;
  ui.folha({ titulo: `Guia · ${nome}`, corpo: (api) => <Guia rota={rota} fechar={api.fechar} /> });
};
export {};
