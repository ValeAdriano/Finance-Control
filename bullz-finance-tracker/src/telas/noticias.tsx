/* Notícias: manchetes do mercado e de cripto, de vários portais, que chegam
 * sozinhas. A cada 2 minutos busca de novo; o que chegou fica num "N novas"
 * no topo (a lista não pula enquanto você lê) e entra marcado ao tocar.
 * O toque na manchete abre a matéria no site do portal: aqui fica só título,
 * hora, imagem e fonte. Nos dias úteis, um atalho para o ao vivo do InfoMoney. */
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useTema } from "../tema";
import { useMedidas } from "../ui/medidas";
import { aoPuxar, Pagina } from "../casca/casca";
import { Botao, Cabecalho, Mensagem, Roda, T, Vazio } from "../ui/kit";
import { Segmentado } from "../ui/campos";
import { Icone } from "../ui/icone";
import { SeloAoVivo, imagemSegura, useRelogio } from "./comum/ao-vivo";
import { atualizaNoticias, mostraPendentes, useAoVivo, useNoticias, type Noticia, type Tema } from "../estado/cripto";
import FC from "../nucleo";

const mem: { tema: Tema; fonte: string | null } = { tema: "mercado", fonte: null };
const PAGINA = 25;

/** o ao vivo do InfoMoney de hoje (só existe nos dias úteis) */
export function linkAoVivo(hoje: string): string | null {
  if (!FC.datas.ehUtil(hoje)) return null;
  const [a, m, d] = hoje.split("-");
  return `https://www.infomoney.com.br/mercados/ibovespa-hoje-bolsa-de-valores-ao-vivo-${d}${m}${a}/`;
}

const abre = (url: string) => { Linking.openURL(url).catch(() => {}); };

function Miniatura({ n, tam }: { n: Noticia; tam: number }) {
  const t = useTema();
  const url = imagemSegura(n.imagem);
  const [falhou, setFalhou] = useState(false);
  if (url && !falhou) {
    return <Image source={{ uri: url }} style={{ width: tam * 1.35, height: tam, borderRadius: 10, backgroundColor: t.cores.campo }}
      contentFit="cover" transition={150} onError={() => setFalhou(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: tam * 1.35, height: tam, borderRadius: 10, backgroundColor: t.cores.campo, alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontSize: 13, fontWeight: "700", color: t.cores.ink3 }} numberOfLines={1}>{n.fonte}</T>
    </View>
  );
}

/** a lista de manchetes (também usada na página de cada moeda) */
export function ListaNoticias({ itens, novos, compacta }: { itens: Noticia[]; novos: string[]; compacta?: boolean }) {
  const t = useTema();
  const { estreito } = useMedidas();
  useRelogio();
  if (!itens.length) return null;
  const marcados = new Set(novos);
  return (
    <View style={{ backgroundColor: t.cores.bg2, borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.linha, overflow: "hidden", boxShadow: t.cores.sombra } as any}>
      {itens.map((n, i) => (
        <Pressable key={n.link} onPress={() => abre(n.link)} accessibilityRole="link" accessibilityLabel={`${n.titulo}. ${n.fonte}, ${FC.datas.ha(n.quando)}`}
          style={({ pressed, hovered }: any) => ({ flexDirection: "row", gap: 14, alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: estreito ? 14 : 20,
            borderTopWidth: i ? 1 : 0, borderTopColor: t.cores.linha, backgroundColor: pressed ? t.cores.campo : hovered ? t.cores.bg3 : "transparent" })}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {marcados.has(n.link) ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.cores.acento }} /> : null}
              <T style={{ fontSize: 12.5, fontWeight: "600", color: t.cores.acento }} numberOfLines={1}>{n.fonte}</T>
              <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{n.quando ? FC.datas.ha(n.quando) : ""}</T>
            </View>
            <T style={{ fontSize: compacta ? 15 : 16, lineHeight: compacta ? 20 : 22, fontWeight: "600", letterSpacing: -0.2 }} numberOfLines={3}>{n.titulo}</T>
            {!compacta && !estreito && n.resumo ? <T v="p" numberOfLines={2}>{n.resumo}</T> : null}
          </View>
          <Miniatura n={n} tam={compacta || estreito ? 60 : 76} />
        </Pressable>
      ))}
    </View>
  );
}

export default function Noticias() {
  const t = useTema();
  const { estreito } = useMedidas();
  const { tema: temaParam } = useLocalSearchParams<{ tema?: string }>();
  const [tema, setTema] = useState<Tema>(temaParam === "cripto" ? "cripto" : temaParam === "mercado" ? "mercado" : mem.tema);
  const [fonte, setFonte] = useState<string | null>(mem.fonte);
  const [limite, setLimite] = useState(PAGINA);
  const f = useNoticias((s) => s[tema]);
  useEffect(() => { Object.assign(mem, { tema, fonte }); }, [tema, fonte]);
  useEffect(() => { setLimite(PAGINA); }, [tema, fonte]);
  useAoVivo(() => atualizaNoticias(tema), 2 * 60 * 1000, tema);
  useEffect(() => {
    aoPuxar.extra = async () => { await atualizaNoticias(tema); mostraPendentes(tema); };
    return () => { aoPuxar.extra = null; };
  }, [tema]);

  const fontes = useMemo(() => Object.keys(f.fontes).sort(), [f.fontes]);
  const lista = fonte ? f.itens.filter((n) => n.fonte === fonte) : f.itens;
  const pendentes = fonte ? f.pendentes.filter((n) => n.fonte === fonte) : f.pendentes;
  const aoVivo = tema === "mercado" ? linkAoVivo(FC.datas.hoje()) : null;

  return (
    <Pagina>
      <Cabecalho titulo="Notícias" sub="Manchetes dos principais portais, chegando sozinhas."
        direita={f.em ? <SeloAoVivo em={f.em} velho={f.velho || !!f.erro} carregando={f.carregando} /> : null} />

      <View style={{ flexDirection: estreito ? "column" : "row", gap: t.espaco.e2, alignItems: estreito ? "stretch" : "center", marginBottom: t.espaco.e3 }}>
        <Segmentado<Tema> opcoes={[{ v: "mercado", rotulo: "Mercado" }, { v: "cripto", rotulo: "Cripto" }]} valor={tema}
          aoMudar={(v) => { setTema(v); setFonte(null); }} rotuloA11y="Assunto" cheio={estreito} />
        {fontes.length > 1 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginLeft: estreito ? 0 : "auto" }}>
            <ChipFonte rotulo="Todas" ativo={!fonte} onPress={() => setFonte(null)} />
            {fontes.map((x) => <ChipFonte key={x} rotulo={x} ativo={fonte === x} fora={!f.fontes[x]} onPress={() => setFonte(fonte === x ? null : x)} />)}
          </View>
        ) : null}
      </View>

      {aoVivo ? (
        <Pressable onPress={() => abre(aoVivo)} accessibilityRole="link"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: t.espaco.e3, borderRadius: t.raios.r,
            backgroundColor: t.cores.vermelhoSuave, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cores.vermelho }} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "600", fontSize: 15 }}>Ibovespa hoje, ao vivo</T>
            <T v="peq">O minuto a minuto da bolsa no InfoMoney</T>
          </View>
          <Icone nome="chevron" tam={18} cor={t.cores.ink2} />
        </Pressable>
      ) : null}

      {f.erro && f.itens.length ? (
        <Mensagem tipo="alerta" icone="alerta" style={{ marginBottom: t.espaco.e3 }}>{`Sem conexão com os portais agora (${f.erro}). Mostrando as últimas manchetes.`}</Mensagem>
      ) : null}

      {pendentes.length ? (
        <Pressable onPress={() => mostraPendentes(tema)} accessibilityRole="button"
          style={({ pressed }) => ({ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, marginBottom: t.espaco.e3,
            borderRadius: 980, backgroundColor: t.cores.acento, opacity: pressed ? 0.8 : 1, boxShadow: t.cores.sombra } as any)}>
          <T style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{`↑ ${pendentes.length} ${pendentes.length === 1 ? "nova manchete" : "novas manchetes"}`}</T>
        </Pressable>
      ) : null}

      {!f.itens.length ? (
        f.erro ? <Vazio icone="jornal" titulo="As notícias não carregaram" texto={f.erro} acao={<Botao variante="sec" onPress={() => atualizaNoticias(tema)}>Tentar de novo</Botao>} />
          : <View style={{ minHeight: 240, alignItems: "center", justifyContent: "center", gap: 16 }}><Roda /><T style={{ color: t.cores.ink2 }}>Buscando as manchetes…</T></View>
      ) : (
        <ListaNoticias itens={lista.slice(0, limite)} novos={f.novos} />
      )}
      {lista.length > limite ? (
        <View style={{ alignItems: "center", marginTop: t.espaco.e3 }}>
          <Botao variante="texto" onPress={() => setLimite(limite + PAGINA)}>Mostrar mais</Botao>
        </View>
      ) : null}

      <T v="dica" style={{ marginTop: t.espaco.e4 }}>
        Manchetes e links dos próprios portais, pelo RSS de cada um; o conteúdo é de cada veículo. Atualiza a cada 2 minutos enquanto esta tela está aberta.
      </T>
    </Pagina>
  );
}

function ChipFonte({ rotulo, ativo, fora, onPress }: { rotulo: string; ativo: boolean; fora?: boolean; onPress: () => void }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: ativo }}
      accessibilityLabel={fora ? `${rotulo}, fora do ar agora` : rotulo}
      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 980, backgroundColor: ativo ? t.cores.ink : t.cores.campo, opacity: fora ? 0.5 : 1 }}>
      <T style={{ fontSize: 13, color: ativo ? t.cores.bg2 : t.cores.ink2, fontWeight: ativo ? "600" : "400" }}>{rotulo}</T>
    </Pressable>
  );
}
