/* Alertas e avisos da carteira (comum.js: itemAlerta, obterAlertas) e a faixa
 * que diz se as cotações ainda estão chegando ou falharam (estadoMercado). */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { useApp } from "../../estado/app";
import { Icone } from "../../ui/icone";
import { Item, Mensagem, T, Roda } from "../../ui/kit";
import FC from "../../nucleo";

export function obterAlertas(): any[] {
  const e = FC.estado;
  if (!FC.alertas || !e || !e.dados) return [];
  try { return FC.alertas.calcula(e.dados, e.base, e.prefs) || []; } catch (err) { console.error(err); return []; }
}
FC.obterAlertas = obterAlertas;

export function ItemAlerta({ a, aoAbrir }: { a: any; aoAbrir?: () => void }) {
  const t = useTema();
  const cor = a.nivel === "alto" ? t.cores.vermelho : a.nivel === "medio" ? t.cores.amarelo : t.cores.acento;
  const icone = a.nivel === "info" ? "info" : "alerta";
  return (
    <Item alinhar="flex-start" chevron={!!a.link}
      onPress={a.link ? () => { aoAbrir?.(); router.push(String(a.link).replace(/^#\/?/, "/") as any); } : undefined}
      esquerda={<View style={{ marginTop: 2 }}><Icone nome={icone as any} tam={20} cor={cor} /></View>}
      titulo={<T style={{ fontWeight: "600", fontSize: 14.5 }}>{a.titulo}</T>}
      detalhe={<T style={{ fontSize: 13, lineHeight: 19, color: t.cores.ink2, marginTop: 2 }}>{a.texto}</T>} />
  );
}

/** faixa: cotações chegando / falharam */
export function EstadoMercado() {
  const t = useTema();
  useApp((s) => s.versao);
  const e = FC.estado;
  if (e.carregandoMercado && !e.mercado.universo) {
    return (
      <Mensagem tipo="info" style={{ marginBottom: t.espaco.e4, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Roda tam={16} />
          <T style={{ fontSize: 14, flex: 1 }}>Atualizando cotações e calculando patrimônio… os valores serão revelados em instantes.</T>
        </View>
      </Mensagem>
    );
  }
  if (e.erroMercado) {
    return (
      <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e4 }}>
        {`Não consegui atualizar as cotações (${e.erroMercado}). ${e.mercado.universo ? "Mostrando os últimos dados guardados." : "Os valores de mercado vão aparecer quando a conexão voltar."}`}
      </Mensagem>
    );
  }
  return null;
}
