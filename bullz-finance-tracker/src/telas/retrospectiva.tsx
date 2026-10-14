/* Retrospectiva do mês e do ano (/retrospectiva/mes|ano[/ajustes]) — port de
 * telas/retrospectiva.js. Espera preços, índices e proventos, monta o
 * MonthRecap com FC.recap e abre o player em tela cheia: o mesmo
 * recap/render.js do site, num canvas dentro do palco (WebView/iframe). */
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pagina } from "../casca/casca";
import { Botao, Roda, T, Vazio } from "../ui/kit";
import { ui, telaCheia, type ApiFolha } from "../ui/folha";
import { Palco } from "../recap/Palco";
import type { CfgPalco } from "../recap/palco";
import FC from "../nucleo";

const pronto = (e: any) => !!(e.mercado.universo && e.mercado.indices && e.spotEm && !e.carregandoMercado && e.dados && e.dados.rentab && e.proventos);

function Player({ cfg, api, aoFechar }: { cfg: CfgPalco; api: ApiFolha; aoFechar: () => void }) {
  return <Palco cfg={cfg} fundo="#2a1bff" aoMensagem={(m) => { if (m.ev === "fechar") { api.fechar(); aoFechar(); } }} />;
}

export default function Retrospectiva() {
  const p = useLocalSearchParams<{ p?: string[] | string }>();
  const partes = Array.isArray(p.p) ? p.p : p.p ? [p.p] : [];
  const tipo = partes[0] === "ano" ? "ano" : "mes", volta = partes[1] === "ajustes" ? "/ajustes" : "/inicio";
  const insets = useSafeAreaInsets();
  const [fase, setFase] = useState<"carregando" | "vazio" | "aberto">("carregando");

  useEffect(() => {
    let vivo = true, aberto: ApiFolha | null = null;
    (async () => {
      const e = FC.estado, limite = Date.now() + 45000;
      if (!e.proventos) FC.carregaProventos().catch(() => {});
      // (as cotações de agora entram no valor final: sem elas o patrimônio sairia só com a renda fixa)
      while (vivo && Date.now() < limite && !pronto(e)) await new Promise((r) => setTimeout(r, 300));
      if (!vivo) return;
      const uid = FC.auth.usuario.id, hoje = FC.datas.hoje();
      const data = tipo === "ano" ? await FC.recap.getYearRecap(uid, hoje) : await FC.recap.getMonthRecap(uid, hoje);
      if (!vivo) return;
      if (!data.tem_dados) return setFase("vazio");
      const reduzido = Platform.OS === "web"
        ? typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
        : await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      const cfg: CfgPalco = { modo: "retro", data, privado: !!FC.local.ler("privado", false), mudo: !!FC.local.ler("recap-mudo", false), reduzido: !!reduzido,
        seguro: { topo: insets.top, base: insets.bottom } };
      if (!vivo) return;
      const fecha = () => { aberto = null; if (vivo) router.replace(volta as any); };
      aberto = telaCheia((api) => <Player cfg={cfg} api={api} aoFechar={fecha} />, { fundo: "#2a1bff" });
      setFase("aberto");
    })().catch((err) => { if (vivo) { ui.erro(err); router.replace(volta as any); } });
    // saiu da rota (voltar do sistema, link): fecha o player
    return () => { vivo = false; if (aberto) aberto.fechar(); };
  }, [tipo, volta]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pagina>
      {fase === "vazio" ? (
        <Vazio icone="play" titulo="Ainda não há o que contar" texto="Cadastre seus investimentos e aportes — a retrospectiva é montada com eles."
          acao={<Botao onPress={() => router.replace(volta as any)}>Voltar</Botao>} />
      ) : (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 64 }}>
          <Roda />
          <T style={{ opacity: 0.8 }}>{fase === "aberto" ? "Retrospectiva aberta" : "Montando a sua retrospectiva…"}</T>
        </View>
      )}
    </Pagina>
  );
}
