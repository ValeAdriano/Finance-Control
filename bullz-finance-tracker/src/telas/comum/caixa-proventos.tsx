/* Caixa de proventos: para onde vão os dividendos até serem reinvestidos
 * (FC.caixaProventos). Aqui ficam a configuração, o cartão com o saldo e o
 * bloco "usar o caixa" dos formulários de compra e de renda fixa. */
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTema } from "../../tema";
import { B, Botao, Cartao, Chip, Detalhes, Item, Kpi, Kpis, Lista, Pilula, Rs, T, Trilha } from "../../ui/kit";
import { Campo, CampoData, Entrada, Form, Interruptor, LinhaCampos, Segmentado, Seletor } from "../../ui/campos";
import { ui } from "../../ui/folha";
import { depoisDeMudar } from "./dados";
import FC from "../../nucleo";

const numTxt = (v: any) => (v == null || v === "" || !Number.isFinite(Number(v)) ? "" : String(Number(v)).replace(".", ","));
const INDEXADORES = [{ v: "cdi", rotulo: "% do CDI" }, { v: "selic", rotulo: "% da Selic" }, { v: "nenhum", rotulo: "Não rende" }];

/** a análise de agora (montada em FC.carteira.monta) */
export function caixaAtual(): any {
  const d = FC.estado.dados;
  return d && d.caixa_proventos && d.caixa_proventos.ativo ? d.caixa_proventos : null;
}

// gravaPrefs sobrescreve o jsonb inteiro: mescla com o que já está lá
export async function gravaCaixaProventos(parcial: any, msg = "Destino dos proventos salvo") {
  const b = FC.estado.base;
  const atuais = (b.prefsBrutas && b.prefsBrutas.proventos) || {};
  const proventos = { ...atuais, ...parcial };
  try {
    await FC.db.gravaPrefs({ proventos });
    await depoisDeMudar(msg);
    return true;
  } catch (err) { ui.erro(err); return false; }
}

export const abreReinvestir = () => router.push({ pathname: "/aportes", params: { reinvestir: "1" } } as any);

// ---------------------------------------------------------------- cartão
export function CartaoCaixaProventos({ aoConfigurar }: { aoConfigurar: () => void }) {
  const t = useTema();
  const cx = caixaAtual();
  if (!cx) {
    return (
      <Cartao>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: t.espaco.e3 }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <T style={{ fontWeight: "600", fontSize: 16 }}>Proventos vão direto para você</T>
            <T v="p" style={{ marginTop: 4 }}>Se o seu banco ou corretora guarda os dividendos num porquinho, cofrinho ou no saldo até você reinvestir, ligue o caixa de proventos: o saldo entra no patrimônio e o reinvestimento não conta como dinheiro novo.</T>
          </View>
          <Botao variante="sec" onPress={aoConfigurar}>Configurar</Botao>
        </View>
      </Cartao>
    );
  }
  const pct = cx.meta > 0 ? (cx.saldo / cx.meta) * 100 : 0;
  const movs = [
    ...cx.entradas.map((e: any) => ({ data: e.data, rotulo: e.ticker, tipo: "entrada", valor: e.valor })),
    ...cx.saidas.filter((s: any) => s.usado > 0).map((s: any) => ({ data: s.data, rotulo: s.ticker || s.titulo, tipo: "saida", valor: -s.usado })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  const rende = cx.indexador ? FC.rentab.rotuloTaxa(cx.indexador, cx.taxa) : "sem rendimento";
  return (
    <Cartao>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: t.espaco.e3 }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <T style={{ fontWeight: "600", fontSize: 16 }}>{cx.nome}</T>
            {cx.pronto ? <Pilula cor="verde">hora de reinvestir</Pilula> : null}
          </View>
          <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 2 }}>proventos guardados até o reinvestimento · {rende}</T>
        </View>
        <View style={{ flexDirection: "row", gap: t.espaco.e2, flexWrap: "wrap" }}>
          <Botao variante="sec" pequeno onPress={aoConfigurar}>Ajustar</Botao>
          <Botao pequeno onPress={abreReinvestir} desabilitado={!(cx.saldo > 0.005)}>Reinvestir</Botao>
        </View>
      </View>
      <Kpis style={{ marginTop: t.espaco.e4, rowGap: 8, columnGap: 32 }}>
        <Kpi rotulo="Saldo" valor={FC.fmt.brlTexto(cx.saldo)} dinheiro />
        {cx.meta > 0 ? <Kpi pequeno rotulo="Meta para reinvestir" valor={FC.fmt.brlTexto(cx.meta)} dinheiro /> : null}
        {cx.meta > 0 && !cx.pronto ? <Kpi pequeno rotulo="Falta" valor={FC.fmt.brlTexto(cx.falta)} dinheiro /> : null}
        {Math.abs(cx.rendimento) >= 0.01 ? <Kpi pequeno rotulo="Rendeu" valor={FC.fmt.brlTexto(cx.rendimento)} dinheiro peq="desde o primeiro provento guardado" /> : null}
      </Kpis>
      {cx.meta > 0 ? <View style={{ marginTop: t.espaco.e3 }}><Trilha pct={pct} cor={cx.pronto ? t.cores.verde : t.cores.acento} /></View> : null}
      {movs.length ? (
        <Detalhes rotulo="Últimos movimentos" style={{ marginTop: t.espaco.e3 }}>
          <Lista>
            {movs.map((m, i) => (
              <Item key={i} titulo={m.rotulo || "—"} detalhe={`${FC.datas.br(m.data)} · ${m.tipo === "entrada" ? "provento guardado" : "reinvestido"}`}
                valores={<Rs cls={m.valor > 0 ? "pos" : null} style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(m.valor)}</Rs>} />
            ))}
          </Lista>
        </Detalhes>
      ) : null}
    </Cartao>
  );
}

// ---------------------------------------------------------------- configuração
export function ConfigCaixaProventos({ aoFechar }: { aoFechar: () => void }) {
  const t = useTema();
  const cfg = FC.mescla(FC.PADRAO_PROVENTOS, FC.estado.prefs.proventos || {});
  const [destino, setDestino] = useState<"direto" | "caixa">(cfg.destino === "caixa" ? "caixa" : "direto");
  const [tipo, setTipo] = useState<string>(cfg.tipo || "porquinho");
  const [nome, setNome] = useState<string>(cfg.nome || "");
  const [indexador, setIndexador] = useState<string>(cfg.indexador || "cdi");
  const [taxa, setTaxa] = useState(numTxt(cfg.taxa));
  const [meta, setMeta] = useState(numTxt(cfg.meta));
  const [inicio, setInicio] = useState<string>(cfg.inicio || "");
  const [excecoes, setExcecoes] = useState<Record<string, boolean>>({ ...(cfg.excecoes || {}) });
  const [saldoReal, setSaldoReal] = useState(numTxt(cfg.saldo_informado));
  const [saldoEm, setSaldoEm] = useState<string>(cfg.saldo_informado_em || FC.datas.hoje());
  const tipos = FC.caixaProventos.TIPOS;
  // os que pagam proventos: ações, FIIs e ETFs da carteira
  const pagadores: string[] = (FC.estado.dados.ativos || []).filter((a: any) => a.posicao && a.classe !== "cripto").map((a: any) => a.ticker).sort();

  const escolheTipo = (k: string) => {
    setTipo(k);
    // o rendimento típico do lugar, enquanto o nome não foi escrito à mão
    setIndexador(tipos[k].indexador);
    setTaxa(numTxt(tipos[k].taxa));
  };

  const salva = async () => {
    const tx = FC.lerNum(taxa), mt = FC.lerNum(meta), sr = FC.lerNum(saldoReal);
    if (destino === "caixa" && indexador !== "nenhum" && !(tx > 0)) { ui.aviso("Informe quanto o caixa rende (ex.: 100 para 100% do CDI).", "erro"); return; }
    if (mt != null && mt < 0) { ui.aviso("A meta não pode ser negativa.", "erro"); return; }
    if (sr != null && sr < 0) { ui.aviso("O saldo não pode ser negativo.", "erro"); return; }
    const exc = Object.fromEntries(Object.entries(excecoes).filter(([, v]) => v));
    const ok = await gravaCaixaProventos({
      destino, tipo, nome: nome.trim().slice(0, 60), indexador, taxa: indexador === "nenhum" ? 0 : tx, meta: mt || 0, inicio: inicio || null,
      excecoes: exc, saldo_informado: sr, saldo_informado_em: sr != null ? saldoEm || FC.datas.hoje() : null,
    });
    if (ok) aoFechar();
  };

  return (
    <Cartao>
      <Form>
        <Segmentado rotuloA11y="Destino dos proventos" valor={destino} aoMudar={setDestino}
          opcoes={[{ v: "direto", rotulo: "Direto para mim" }, { v: "caixa", rotulo: "Guardar até reinvestir" }]} />
        {destino === "direto" ? (
          <T v="p">Cada provento pago volta para o seu bolso, como hoje. Quando você compra com ele, a compra conta como aporte normal.</T>
        ) : (
          <>
            <T v="p">Os proventos pagos ficam num caixa (porquinho, cofrinho, saldo da corretora…) até você reinvestir. O saldo entra no patrimônio e, na compra, a parte que veio do caixa não conta como dinheiro novo.</T>
            <LinhaCampos n={3}>
              <Campo rotulo="Onde ficam">
                <Seletor valor={tipo} aoMudar={escolheTipo} rotuloA11y="Onde ficam os proventos"
                  opcoes={Object.entries(tipos).map(([k, v]: any) => ({ v: k, rotulo: v.nome }))} />
              </Campo>
              <Campo rotulo="Nome" dica="como aparece no app">
                <Entrada valor={nome} aoMudar={setNome} maxLength={60} placeholder={tipos[tipo] ? tipos[tipo].nome : "Caixa de proventos"} autoCapitalize="words" accessibilityLabel="Nome do caixa" />
              </Campo>
              <Campo rotulo="Meta para reinvestir (R$)" dica="avisa quando o saldo chegar; 0 = sem aviso">
                <Entrada valor={meta} aoMudar={setMeta} decimal placeholder="500" accessibilityLabel="Meta para reinvestir" />
              </Campo>
            </LinhaCampos>
            <LinhaCampos n={3}>
              <Campo rotulo="Rende">
                <Seletor valor={indexador} aoMudar={setIndexador} opcoes={INDEXADORES} rotuloA11y="Rendimento do caixa" />
              </Campo>
              {indexador !== "nenhum" ? (
                <Campo rotulo="Taxa" dica={indexador === "cdi" ? "100 = 100% do CDI" : "100 = 100% da Selic"}>
                  <Entrada valor={taxa} aoMudar={setTaxa} decimal placeholder="100" accessibilityLabel="Taxa do caixa" />
                </Campo>
              ) : null}
              <Campo rotulo="A partir de" dica="vazio: todos os proventos já pagos">
                <CampoData valor={inicio} aoMudar={setInicio} rotuloA11y="A partir de" />
              </Campo>
            </LinhaCampos>
            {pagadores.length ? (
              <Detalhes rotulo="Algum ativo paga direto para você?" inicial={Object.values(excecoes).some(Boolean)} style={{ marginTop: 0 }}>
                <T v="p" style={{ marginBottom: t.espaco.e2 }}>Marque os que <B>não</B> vão para o caixa.</T>
                <View style={{ gap: t.espaco.e2 }}>
                  {pagadores.map((tk) => (
                    <Interruptor key={tk} valor={!!excecoes[tk]} aoMudar={(v) => setExcecoes({ ...excecoes, [tk]: v })} rotulo={tk} />
                  ))}
                </View>
              </Detalhes>
            ) : null}
            <Detalhes rotulo="Conferir com o saldo real" inicial={cfg.saldo_informado != null} style={{ marginTop: 0 }}>
              <T v="p" style={{ marginBottom: t.espaco.e2 }}>Se o saldo no banco ou na corretora for diferente do calculado, informe o real: ele vale a partir da data e o que entrar depois soma a ele. Deixe vazio para usar o calculado.</T>
              <LinhaCampos>
                <Campo rotulo="Saldo real (R$)"><Entrada valor={saldoReal} aoMudar={setSaldoReal} decimal placeholder="vazio = calculado" accessibilityLabel="Saldo real" /></Campo>
                <Campo rotulo="Em"><CampoData valor={saldoEm} aoMudar={setSaldoEm} max={FC.datas.hoje()} rotuloA11y="Data do saldo real" /></Campo>
              </LinhaCampos>
            </Detalhes>
          </>
        )}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: t.espaco.e2 }}>
          <Botao variante="sec" onPress={aoFechar}>Cancelar</Botao>
          <Botao onPress={salva}>Salvar</Botao>
        </View>
      </Form>
    </Cartao>
  );
}

// ---------------------------------------------------------------- uso nos formulários
/** estado do "usar o caixa" de um formulário: ligado, valor pedido e o que de fato sai dele */
export function useUsoDoCaixa(inicial: boolean) {
  const cx = caixaAtual();
  const temSaldo = !!cx && cx.saldo > 0.005;
  const [ligado, setLigado] = useState(inicial && temSaldo);
  const [doCaixa, setDoCaixa] = useState("");
  // quanto sai do caixa para um total: o pedido (ou tudo o que cabe), até o saldo
  const usado = (total: number) => {
    if (!cx || !ligado || !(total > 0)) return 0;
    const pedido = FC.lerNum(doCaixa);
    return Math.max(0, Math.min(cx.saldo, total, pedido != null ? pedido : Infinity));
  };
  const limpa = () => setDoCaixa("");
  return { cx, temSaldo, ligado, setLigado, doCaixa, setDoCaixa, usado, limpa };
}

export function UsoDoCaixa({ uso, total }: { uso: ReturnType<typeof useUsoDoCaixa>; total: number }) {
  const t = useTema();
  const { cx, temSaldo, ligado, setLigado, doCaixa, setDoCaixa } = uso;
  if (!cx || !temSaldo) return null;
  const sai = uso.usado(total);
  const novo = Math.max(0, (total || 0) - sai);
  return (
    <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 18, gap: t.espaco.e3 }}>
      <Interruptor valor={ligado} aoMudar={setLigado}
        rotulo={<T>Usar o <B>{cx.nome}</B> (<Rs style={{ fontSize: 14 }}>{FC.fmt.brlTexto(cx.saldo)}</Rs>)</T>} />
      {ligado ? (
        <>
          <LinhaCampos>
            <Campo rotulo={`Do ${cx.nome} (R$)`} dica="vazio: tudo o que couber no valor total">
              <Entrada valor={doCaixa} aoMudar={setDoCaixa} decimal placeholder={FC.fmt.num(Math.min(cx.saldo, total || cx.saldo), 2)} accessibilityLabel="Valor que sai do caixa" />
            </Campo>
            <Campo rotulo="Do bolso (dinheiro novo)">
              <View style={{ minHeight: 44, justifyContent: "center" }}><Rs style={{ fontSize: 17, fontWeight: "600" }}>{FC.fmt.brlTexto(novo)}</Rs></View>
            </Campo>
          </LinhaCampos>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e2 }}>
            <Chip><T style={{ fontSize: 13, color: t.cores.ink2 }}>sai do caixa <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(sai)}</Rs></T></Chip>
            <Chip><T style={{ fontSize: 13, color: t.cores.ink2 }}>fica no caixa <Rs style={{ fontSize: 13, fontWeight: "600" }}>{FC.fmt.brlTexto(Math.max(0, cx.saldo - sai))}</Rs></T></Chip>
          </View>
          <T v="p">Quer reinvestir mais do que tem no caixa? Aumente o valor total: a diferença conta como aporte novo.</T>
        </>
      ) : null}
    </View>
  );
}
