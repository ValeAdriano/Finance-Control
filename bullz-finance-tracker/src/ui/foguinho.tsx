/* Foguinho roxo da sequência de aportes — FC.foguinho do site.
 * Aceso, a chama dança e brilha; apagado, fica cinza e parado. Com pct, ganha
 * o anel do mês em volta (quanto da meta já foi). */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

const EXT = "M16 2.5C17.5 7 23.5 10 24.5 17 25.3 23 21.3 28.5 16 28.5 10.7 28.5 6.7 24 7.3 18.5 7.7 14.8 9.8 12.6 11.2 10.2 11.7 12.6 12.6 14 13.9 14.6 13.6 10 14.6 6 16 2.5Z";
const INT = "M16 13.5C17 16.5 20.3 18.2 20.3 22.2 20.3 25 18.4 26.8 16 26.8 13.6 26.8 11.7 25 11.7 22.6 11.7 20.4 13 19.3 14 17.6 14.4 18.9 15 19.6 15.7 19.9 15.5 17.6 15.4 15.6 16 13.5Z";
let seq = 0;

export function Foguinho({ tam = 24, aceso = true, pct = null, acende = false }: { tam?: number; aceso?: boolean; pct?: number | null; acende?: boolean }) {
  const id = useRef("fg" + ++seq).current;
  const danca = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(acende ? 0 : 1)).current;
  const nd = Platform.OS !== "web";

  useEffect(() => {
    if (!aceso) { danca.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(danca, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: nd }),
      Animated.timing(danca, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: nd }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [aceso, danca, nd]);

  useEffect(() => {
    if (!acende) return;
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 900, easing: Easing.bezier(0.2, 1.5, 0.4, 1), useNativeDriver: nd }).start();
  }, [acende, pop, nd]);

  const comAnel = pct != null;
  const lado = comAnel ? tam * 0.58 : tam;
  const c = 2 * Math.PI * 18, p = Math.max(0, Math.min(100, pct ?? 0));
  const escala = danca.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const giro = danca.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] });

  return (
    <View style={{ width: tam, height: tam, alignItems: "center", justifyContent: "center" }}>
      {comAnel ? (
        <Svg width={tam} height={tam} viewBox="0 0 40 40" style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
          <Defs>
            <LinearGradient id={id + "a"} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#c084fc" /><Stop offset="1" stopColor="#7c3aed" />
            </LinearGradient>
          </Defs>
          <Circle cx={20} cy={20} r={18} fill="none" strokeWidth={3.2} stroke="rgba(168, 85, 247, 0.16)" />
          <Circle cx={20} cy={20} r={18} fill="none" strokeWidth={3.2} strokeLinecap="round" stroke={`url(#${id}a)`}
            strokeDasharray={c.toFixed(2)} strokeDashoffset={(c * (1 - p / 100)).toFixed(2)} />
        </Svg>
      ) : null}
      <Animated.View style={{ width: lado, height: lado, opacity: aceso ? 1 : 0.32,
        transform: [{ scale: Animated.multiply(pop, aceso ? escala : 1) as any }, { rotate: aceso ? giro : "0deg" }],
        ...(aceso ? { boxShadow: undefined } : {}) } as any}>
        <Svg width={lado} height={lado} viewBox="0 0 32 32">
          <Defs>
            <LinearGradient id={id + "e"} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor={aceso ? "#c084fc" : "#9a9aa0"} />
              <Stop offset="0.55" stopColor={aceso ? "#a855f7" : "#86868b"} />
              <Stop offset="1" stopColor={aceso ? "#6d28d9" : "#6e6e73"} />
            </LinearGradient>
            <LinearGradient id={id + "i"} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor={aceso ? "#f5f3ff" : "#f2f2f7"} />
              <Stop offset="1" stopColor={aceso ? "#d8b4fe" : "#d1d1d6"} />
            </LinearGradient>
          </Defs>
          <G><Path fill={`url(#${id}e)`} d={EXT} /></G>
          <G><Path fill={`url(#${id}i)`} d={INT} /></G>
        </Svg>
      </Animated.View>
    </View>
  );
}
