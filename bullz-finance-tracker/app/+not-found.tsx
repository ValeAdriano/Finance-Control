/* Página não encontrada. Link do site antigo ("/#/ativos") ainda vira a rota
 * nova; qualquer outro endereço desconhecido mostra o aviso com a logo e o
 * caminho de volta para o Início. */
import React from "react";
import { Image, View } from "react-native";
import { Redirect, router, usePathname } from "expo-router";
import { rotaLegada } from "../src/plataforma/adaptacoes";
import { useTema } from "../src/tema";
import { Pagina } from "../src/casca/casca";
import { Botao, T } from "../src/ui/kit";

export default function NaoAchou() {
  const t = useTema();
  const caminho = usePathname();
  const legada = rotaLegada();
  if (legada) return <Redirect href={legada as any} />;
  return (
    <Pagina estreita rolar={false}>
      <View style={{ flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: t.espaco.e5 }}>
        <Image source={require("../assets/img/icone-512.png")} style={{ width: 96, height: 96, borderRadius: 24, marginBottom: t.espaco.e3 }}
          resizeMode="contain" accessibilityLabel="Bullz" />
        <T style={{ fontSize: 13, fontWeight: "600", letterSpacing: 1.2, color: t.cores.ink3 }}>ERRO 404</T>
        <T centro style={{ fontSize: 28, fontWeight: "600", letterSpacing: -0.6 }} accessibilityRole="header">Página não encontrada</T>
        <T centro style={{ color: t.cores.ink2, maxWidth: 340, fontSize: 15 }}>
          O endereço {caminho ? <T style={{ fontWeight: "600", color: t.cores.ink }}>{caminho}</T> : null} não existe ou mudou de lugar.
        </T>
        <View style={{ marginTop: t.espaco.e3 }}>
          <Botao icone="inicio" onPress={() => router.replace("/inicio")}>Ir para o Início</Botao>
        </View>
      </View>
    </Pagina>
  );
}
