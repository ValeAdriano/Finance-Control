/* Peças das telas ao vivo (Cripto e Notícias): o selo "Ao vivo" que pulsa,
 * a variação colorida, a logo da moeda e a imagem da manchete.
 *
 * Imagens de fora só carregam de hosts conhecidos, os mesmos liberados no
 * img-src da CSP (vercel.json). O teste testes/ao-vivo.test.js confere que as
 * duas listas batem; um host novo de portal precisa entrar nos dois lugares. */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Image } from "expo-image";
import { useTema } from "../../tema";
import { T } from "../../ui/kit";
import { reduzMovimento } from "../../ui/movimento";
import FC from "../../nucleo";

export const HOSTS_IMAGEM = [
  "coin-images.coingecko.com", "assets.coingecko.com",
  "www.infomoney.com.br", "infomoney.com.br", "www.moneytimes.com.br", "moneytimes.com.br",
  "einvestidor.estadao.com.br", "www.estadao.com.br", "classic.exame.com", "exame.com",
  "images.cointelegraph.com", "s3.cointelegraph.com", "br.cointelegraph.com",
  "livecoins.com.br", "portaldobitcoin.uol.com.br", "conteudo.imguol.com.br",
];
/** a URL, se for https de um host liberado; senão null (e a tela mostra a inicial) */
export function imagemSegura(url?: string | null): string | null {
  if (!url) return null;
  const m = /^https:\/\/([^/:?#]+)/i.exec(url);
  return m && HOSTS_IMAGEM.includes(m[1].toLowerCase()) ? url : null;
}

/** relógio que repinta a tela (para o "há 3 min" andar sozinho) */
export function useRelogio(ms = 30 * 1000) {
  const [, set] = useState(0);
  useEffect(() => { const r = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(r); }, [ms]);
}

/** ● Ao vivo · atualizado há 1 min */
export function SeloAoVivo({ em, velho, carregando }: { em?: string | number | null; velho?: boolean; carregando?: boolean }) {
  const t = useTema();
  useRelogio();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzMovimento() || velho) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(a, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, velho]);
  const cor = velho ? t.cores.amarelo : t.cores.vermelho;
  const quando = em ? FC.datas.ha(typeof em === "number" ? new Date(em).toISOString() : em) : "";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 980,
      backgroundColor: velho ? t.cores.amareloSuave : t.cores.vermelhoSuave }} accessibilityLabel={`${velho ? "Sem conexão com a fonte" : "Ao vivo"}${quando ? ", atualizado " + quando : ""}`}>
      <View style={{ width: 8, height: 8 }}>
        <Animated.View style={{ position: "absolute", left: -4, top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: cor,
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
      </View>
      <T style={{ fontSize: 12.5, lineHeight: 16, fontWeight: "600", color: cor }}>{velho ? "Atraso" : "Ao vivo"}</T>
      {quando ? <T style={{ fontSize: 12.5, lineHeight: 16, color: t.cores.ink2 }}>{carregando ? "atualizando…" : quando === "agora" ? "agora" : quando}</T> : null}
    </View>
  );
}

/** +2,31% verde / −1,04% vermelho */
export function Var({ v, tam = 13.5, peso = "500", seta }: { v: number | null | undefined; tam?: number; peso?: any; seta?: boolean }) {
  const t = useTema();
  if (!FC.ok(v)) return <T style={{ fontSize: tam, color: t.cores.ink3 }}>—</T>;
  const n = v as number;
  const cor = n > 0 ? t.cores.verde : n < 0 ? t.cores.vermelho : t.cores.ink2;
  return <T num style={{ fontSize: tam, lineHeight: Math.round(tam * 1.35), fontWeight: peso, color: cor }}>{seta ? (n >= 0 ? "▲ " : "▼ ") + FC.fmt.pct(Math.abs(n), 2) : FC.fmt.delta(n, 2, "%")}</T>;
}

/** logo redonda da moeda (ou a inicial, se não houver) */
export function LogoMoeda({ url, simbolo, tam = 28 }: { url?: string | null; simbolo: string; tam?: number }) {
  const t = useTema();
  const ok = imagemSegura(url);
  if (ok) return <Image source={{ uri: ok }} style={{ width: tam, height: tam, borderRadius: tam / 2 }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: t.cores.acentoSuave, alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontSize: tam * 0.42, lineHeight: tam * 0.5, fontWeight: "700", color: t.cores.acento }}>{(simbolo || "?").slice(0, 1)}</T>
    </View>
  );
}
