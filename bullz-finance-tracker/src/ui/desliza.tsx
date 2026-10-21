/* Deslizar uma linha para a esquerda revela ações (como no Mail). Só no
 * toque: no computador a linha fica parada e as ações seguem nos botões dela.
 * É um atalho, nunca o único caminho para a ação. */
import React, { useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTema } from "../tema";
import { vibra } from "../plataforma/vibra";
import FC from "../nucleo";

export interface AcaoDesliza { rotulo: string; perigo?: boolean; aoTocar: () => void }

const LARG = 84;

function Acoes({ acoes, arrasto, fecha }: { acoes: AcaoDesliza[]; arrasto: SharedValue<number>; fecha: () => void }) {
  const t = useTema();
  const total = LARG * acoes.length;
  // as ações entram junto com a linha, da direita
  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(arrasto.value, [-total, 0], [0, total], "clamp") }] }));
  return (
    <Reanimated.View style={[{ flexDirection: "row", width: total }, estilo]}>
      {acoes.map((a) => (
        <Pressable key={a.rotulo} accessibilityRole="button" onPress={() => { fecha(); a.aoTocar(); }}
          style={{ width: LARG, alignItems: "center", justifyContent: "center", backgroundColor: a.perigo ? t.cores.vermelho : t.cores.acento }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{a.rotulo}</Text>
        </Pressable>
      ))}
    </Reanimated.View>
  );
}

export function Desliza({ acoes, children }: { acoes: AcaoDesliza[]; children: React.ReactNode }) {
  const t = useTema();
  const ref = useRef<SwipeableMethods>(null);
  const toque = Platform.OS !== "web" || !!(FC.dispositivo && FC.dispositivo.ehMobile);
  if (!toque || !acoes.length) return <>{children}</>;
  return (
    <ReanimatedSwipeable ref={ref} friction={2} rightThreshold={LARG / 2} overshootRight={false} dragOffsetFromRightEdge={12}
      onSwipeableWillOpen={() => vibra.leve()}
      renderRightActions={(_p, arrasto) => <Acoes acoes={acoes} arrasto={arrasto} fecha={() => ref.current?.close()} />}>
      <View style={{ backgroundColor: t.cores.bg2 }}>{children}</View>
    </ReanimatedSwipeable>
  );
}
