/* Perfil e ativação no Início (comum.js): cartão do perfil (termine, revise,
 * aplique), checklist "Primeiros passos" e "plano contra realidade". */
import React from "react";
import { Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { Botao, Cartao, T, Estica } from "../../ui/kit";
import { Icone } from "../../ui/icone";
import { useMedidas } from "../../ui/medidas";
import FC from "../../nucleo";

/** botão/link de perfil: "ver" (relatório), "meta" (pergunta do valor), "abrir" (questionário) */
export function abrePerfil(acao: string) {
  const e = FC.estado.perfil;
  if (acao === "ver") router.push("/perfil" as any);
  else if (acao === "meta") FC.perfilFluxo && FC.perfilFluxo.abre({ origem: "revisao", irPara: "valor_alvo" });
  else FC.perfilFluxo && FC.perfilFluxo.abre({ origem: !e.atual ? (e.rascunho && e.rascunho.respostas ? "cadastro" : "migracao") : "revisao" });
}

export function CartaoPerfil() {
  const t = useTema();
  const { estreito } = useMedidas();
  const e = FC.estado.perfil;
  if (!e || e.indisponivel || !FC.perfil) return null;
  const rev = e.atual ? FC.perfil.revisao(e.atual) : null;
  let titulo: string, texto: string, botao: string, destaque = false;
  if (!e.atual && e.rascunho) {
    titulo = "Termine seu perfil"; texto = "Suas respostas estão salvas. Faltam poucas perguntas para o plano."; botao = "Continuar"; destaque = true;
  } else if (!e.atual) {
    titulo = "Faça seu perfil de investidor"; texto = "3 minutos, gera seu plano: perfil, quanto guardar e como dividir."; botao = "Começar"; destaque = true;
  } else if (rev.estado === "obrigatoria") {
    titulo = "Seu perfil venceu"; texto = "Passou de 24 meses. Refaça para o plano continuar valendo."; botao = "Revisar"; destaque = true;
  } else if (rev.estado === "sugerida") {
    titulo = "Vale revisar seu perfil"; texto = rev.motivo === "renda" ? "Sua renda informada mudou." : "Faz mais de 12 meses desde a última avaliação."; botao = "Revisar";
  } else if (e.plano && e.plano.decisao === "pendente") {
    titulo = "Seu plano está pronto"; texto = "Veja a alocação do perfil e aplique às suas metas, ou mantenha as atuais."; botao = "Ver plano";
  } else return null;
  const acao = e.atual && rev.estado === "ok" ? "ver" : "abrir";
  return (
    <Cartao destaque={destaque} style={{ flexDirection: "row", flexWrap: estreito ? "wrap" : "nowrap", alignItems: "center", gap: t.espaco.e3, marginBottom: t.espaco.e3,
      ...(destaque ? { backgroundColor: t.cores.bg2 } : {}) }}>
      {destaque ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "70%", backgroundColor: t.cores.acentoSuave, borderTopLeftRadius: t.raios.r, borderTopRightRadius: t.raios.r }} /> : null}
      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.cores.acentoSuave }}>
        <Icone nome="bussola" tam={22} cor={t.cores.acento} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontSize: 16, fontWeight: "600" }}>{titulo}</T>
        <T style={{ fontSize: 13, color: t.cores.ink2 }}>{texto}</T>
      </View>
      <Botao pequeno cheio={estreito} onPress={() => abrePerfil(acao)}>{botao}</Botao>
    </Cartao>
  );
}

export function ChecklistAtivacao() {
  const t = useTema();
  const e = FC.estado.perfil, b = FC.estado.base;
  if (!e || e.indisponivel || !b) return null;
  const metaOk = !!(e.atual && e.atual.respostas.valor_alvo && e.atual.respostas.valor_alvo !== "nd");
  const itens = [
    { id: "conta", rotulo: "Conta criada", porque: "você já criou a conta", feito: true },
    { id: "perfil", rotulo: "Perfil do investidor", porque: "você já respondeu o perfil", feito: !!e.atual, acao: "abrir" },
    { id: "ativo", rotulo: "Cadastrar o primeiro ativo ou importar um extrato", feito: b.ativos.length > 0 || b.rendaFixa.length > 0, link: "/ativos" },
    { id: "meta", rotulo: "Definir valor e prazo da meta principal", feito: metaOk, acao: "meta" },
    { id: "aporte", rotulo: "Registrar o primeiro aporte", feito: b.aportes.length > 0, link: "/aportes" },
    { id: "mfa", rotulo: "Ligar o 2FA", feito: !!e.mfa, link: "/ajustes" },
  ] as Array<{ id: string; rotulo: string; porque?: string; feito: boolean; acao?: string; link?: string }>;
  const feitos = itens.filter((x) => x.feito).length;
  if (feitos === itens.length) return null;
  return (
    <Cartao style={{ marginVertical: t.espaco.e3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T v="h3">Primeiros passos</T>
        <T style={{ fontSize: 13, color: t.cores.ink2 }}>{feitos} de {itens.length}</T>
      </View>
      <View style={{ height: 10, borderRadius: 6, backgroundColor: t.cores.campo, overflow: "hidden", marginTop: t.espaco.e2 }}>
        <Estica pct={(feitos / itens.length) * 100} style={{ height: "100%", borderRadius: 6, backgroundColor: "#0a84ff",
          ...(Platform.OS === "web" ? { backgroundImage: "linear-gradient(90deg, #0a84ff, #5e5ce6)" } : {}) } as any} />
      </View>
      <View style={{ marginTop: t.espaco.e3 }}>
        {itens.map((x, i) => {
          const miolo = (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 2,
              borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
                borderWidth: 1.5, borderColor: x.feito ? t.cores.verde : t.cores.linha2, backgroundColor: x.feito ? t.cores.verde : "transparent" }}>
                {x.feito ? <Icone nome="check" tam={13} cor="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: "500", fontSize: 14.5, color: x.feito ? t.cores.ink2 : t.cores.ink }}>{x.rotulo}</T>
                {x.feito && x.porque ? <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{x.porque}</T> : null}
              </View>
            </View>
          );
          if (x.feito) return <View key={x.id}>{miolo}</View>;
          return (
            <Pressable key={x.id} accessibilityRole="button"
              onPress={() => (x.link ? router.push(x.link as any) : abrePerfil(x.acao || "abrir"))}>{miolo}</Pressable>
          );
        })}
      </View>
    </Cartao>
  );
}

/** aporte do mês, reserva e distância da meta (só com o plano aplicado) */
export function CartaoPlanoRealidade() {
  const e = FC.estado.perfil;
  if (!e || e.indisponivel || !e.atual || !e.plano || e.plano.decisao !== "aplicado" || !FC.perfilRecomendacao || !FC.perfilRelatorio) return null;
  const r = FC.perfilRecomendacao(e.atual, e.plano, e.modo);
  if (!r) return null;
  const p = FC.recomendacao.planoContraRealidade({ plano: r.rec.plano, alocacaoAlvo: FC.estado.prefs.alocacao_alvo, dados: FC.estado.dados, base: FC.estado.base });
  const C = FC.perfilRelatorio.CartaoPlanoRealidade;
  return p && C ? <C p={p} /> : null;
}
