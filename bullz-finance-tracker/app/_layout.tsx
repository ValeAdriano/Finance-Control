/* Raiz do app: carrega o núcleo, as adaptações de plataforma e decide entre
 * login, código de 2FA e a casca com as telas (mesmo fluxo do app.js). */
import "../src/nucleo";
import "../src/plataforma/adaptacoes";
import { instalaFixture } from "../src/plataforma/fixture";
import "../src/telas/comum/dados";
import "../src/telas/registro";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TemaProvider, useTema } from "../src/tema";
import { useApp, inicia } from "../src/estado/app";
import { HostFolhas, HostTelas } from "../src/ui/folha";
import { Casca } from "../src/casca/casca";
import { Roda } from "../src/ui/kit";
import Login from "../src/telas/login";
import { Bloqueio } from "../src/plataforma/bloqueio";

// SÓ TESTE: com ?fixture=1 (web) ou EXPO_PUBLIC_FIXTURE=1, troca a rede por dados de demonstração
instalaFixture();

function Portao() {
  const t = useTema();
  const fase = useApp((s) => s.fase);
  useEffect(() => { inicia(); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.cores.bg }}>
      <StatusBar style={t.esquema === "escuro" ? "light" : "dark"} />
      {fase === "iniciando" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Roda /></View>
      ) : fase === "app" ? (
        <Casca><Slot /></Casca>
      ) : (
        <Login />
      )}
      <HostTelas />
      <HostFolhas />
      <Bloqueio />
    </View>
  );
}

export default function Raiz() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TemaProvider>
          <Portao />
        </TemaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
