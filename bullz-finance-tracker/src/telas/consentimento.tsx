/* Consentimento do OAuth: um assistente de IA (Claude, ChatGPT…) pediu acesso
 * à conta pelo MCP e o Supabase Auth mandou a pessoa para cá, em
 * /oauth/consent?authorization_id=…, já logada (o portão do app cuida do
 * login e do 2FA antes de esta tela aparecer).
 *
 * Aqui ela vê QUEM pede e para ONDE volta, escolhe o alcance (só consultar
 * ou consultar e editar) e decide. O alcance vai para a tabela mcp_acessos
 * antes da aprovação: é o banco que o aplica, não o assistente. */
import React, { useEffect, useState } from "react";
import { Image, Linking, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { Botao, Cartao, Mensagem, Roda, T } from "../ui/kit";
import { Segmentado } from "../ui/campos";
import { Icone } from "../ui/icone";
import FC from "../nucleo";

type Alcance = "consulta" | "edicao";

function sai(url: string) {
  // de volta para o assistente: é um endereço de fora do app
  if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(url);
  else Linking.openURL(url);
}
const dominio = (url: string) => { try { return new URL(url).host; } catch { return url; } };

const PODE: Record<Alcance, string[]> = {
  consulta: ["Ver patrimônio, posições, lançamentos, renda fixa, dividendos, agro e salário"],
  edicao: ["Ver patrimônio, posições, lançamentos, renda fixa, dividendos, agro e salário",
    "Registrar e corrigir lançamentos, ativos, títulos, ganhos e o agro", "Apagar registros, um de cada vez", "Mudar as metas de alocação"],
};
const NAO_PODE = ["Trocar sua senha, seu e-mail ou o 2FA", "Apagar a conta", "Ver seu perfil de investidor"];

export default function Consentimento() {
  const t = useTema();
  const { authorization_id } = useLocalSearchParams<{ authorization_id?: string }>();
  const id = String(authorization_id || "");
  const [pedido, setPedido] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alcance, setAlcance] = useState<Alcance>("consulta");
  const [ocupado, setOcupado] = useState<"aprova" | "nega" | null>(null);

  useEffect(() => {
    if (!id) { setErro("Este endereço abre a partir de um assistente de IA pedindo acesso. Sem um pedido, não há o que autorizar."); return; }
    let vivo = true;
    FC.mcp.pedido(id).then((d: any) => {
      if (!vivo) return;
      // já autorizado antes: o Auth devolve só o caminho de volta
      if (d && !d.authorization_id && d.redirect_url) { sai(d.redirect_url); return; }
      setPedido(d);
    }).catch((e: any) => { if (vivo) setErro("O pedido de acesso não é mais válido (eles expiram em poucos minutos). Volte ao assistente e conecte de novo. " + FC.ui.traduzErro(e.message || String(e))); });
    return () => { vivo = false; };
  }, [id]);

  const decide = async (aprova: boolean) => {
    setOcupado(aprova ? "aprova" : "nega");
    try {
      const url = aprova ? await FC.mcp.aprova(id, pedido.client, alcance === "edicao") : await FC.mcp.nega(id);
      if (aprova) FC.db.log("seguranca", { acao: "conexão com IA autorizada", cliente: pedido.client.name, alcance });
      sai(url);
    } catch (e: any) {
      setOcupado(null);
      setErro(FC.ui.traduzErro(e.message || String(e)));
    }
  };

  const cliente = pedido && pedido.client;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.cores.bg }} contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: t.espaco.e4 }}>
      <View style={{ width: "100%", maxWidth: 460, gap: t.espaco.e3 }}>
        <View style={{ alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden" }}>
            <Image source={require("../../assets/img/icone-512.png")} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="Bullz" />
          </View>
          <T style={{ fontSize: 22, fontWeight: "600", letterSpacing: -0.4, textAlign: "center" }} accessibilityRole="header">Conectar um assistente de IA</T>
        </View>

        {erro ? (
          <>
            <Mensagem tipo="erro">{erro}</Mensagem>
            <Botao variante="sec" cheio onPress={() => router.replace("/inicio" as any)}>Ir para o Bullz</Botao>
          </>
        ) : !pedido ? (
          <View style={{ alignItems: "center", padding: t.espaco.e5 }}><Roda /></View>
        ) : (
          <>
            <Cartao>
              <T style={{ fontSize: 17, fontWeight: "600" }}>{cliente.name || "Um aplicativo sem nome"}</T>
              <T v="p" style={{ marginTop: 4, color: t.cores.ink2 }}>
                quer acessar seus dados do Bullz como <T style={{ fontWeight: "600" }}>{pedido.user?.email || "sua conta"}</T>.
              </T>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: t.espaco.e3 }}>
                <Icone nome="info" tam={16} cor={t.cores.ink3} />
                <T style={{ fontSize: 13, color: t.cores.ink2, flexShrink: 1 }}>Depois de decidir, você volta para <T style={{ fontWeight: "600", fontSize: 13 }}>{dominio(pedido.redirect_uri)}</T></T>
              </View>
            </Cartao>

            <Mensagem tipo="alerta">
              O nome acima é o que o aplicativo informou sobre si mesmo. Só autorize se foi você quem começou esta conexão agora, no seu assistente, e o endereço de volta é o dele.
            </Mensagem>

            <Cartao>
              <T style={{ fontSize: 14, fontWeight: "600", marginBottom: 10 }}>O que ele poderá fazer</T>
              <Segmentado valor={alcance} aoMudar={setAlcance} cheio rotuloA11y="Alcance do acesso"
                opcoes={[{ v: "consulta", rotulo: "Só consultar" }, { v: "edicao", rotulo: "Consultar e editar" }]} />
              <View style={{ gap: 8, marginTop: t.espaco.e3 }}>
                {PODE[alcance].map((x) => (
                  <View key={x} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ marginTop: 2 }}><Icone nome="check" tam={16} cor={t.cores.verde} /></View>
                    <T style={{ fontSize: 14, flexShrink: 1 }}>{x}</T>
                  </View>
                ))}
                {NAO_PODE.map((x) => (
                  <View key={x} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ marginTop: 2 }}><Icone nome="fechar" tam={16} cor={t.cores.ink3} /></View>
                    <T style={{ fontSize: 14, flexShrink: 1, color: t.cores.ink2 }}>{x}</T>
                  </View>
                ))}
              </View>
              <T style={{ fontSize: 12.5, color: t.cores.ink3, marginTop: t.espaco.e3, lineHeight: 18 }}>
                O que o assistente lê sai do Bullz e passa a seguir as regras de privacidade dele. Você muda o alcance ou desconecta quando quiser em Ajustes → Segurança → Conexões com IA.
              </T>
            </Cartao>

            <View style={{ gap: 10 }}>
              <Botao cheio onPress={() => decide(true)} carregando={ocupado === "aprova"} desabilitado={!!ocupado}>
                {alcance === "edicao" ? "Autorizar consulta e edição" : "Autorizar só consulta"}
              </Botao>
              <Botao variante="sec" cheio onPress={() => decide(false)} carregando={ocupado === "nega"} desabilitado={!!ocupado}>Não autorizar</Botao>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
