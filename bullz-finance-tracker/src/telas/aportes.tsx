/* Aportes: cada compra, venda, provento e movimento de renda fixa — port de
 * telas/aportes.js. A posição e o preço médio saem daqui, não são digitados. */
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import {
  Anel, B, Botao, BotaoIcone, Cabecalho, Cartao, Detalhes, GrupoTitulo, Indicadores, Item, Kpi, Kpis, Mensagem, Pilula, Rs, Secao, T, Vazio,
} from "../ui/kit";
import { Campo, CampoData, Entrada, Form, LinhaCampos, Segmentado, Seletor } from "../ui/campos";
import { Icone } from "../ui/icone";
import { ui, type ApiFolha } from "../ui/folha";
import { abreAtivo } from "./comum/ativo";
import { acharAtivo, adivinhaClasse, aportadoRf, depoisDeMudar } from "./comum/dados";
import { UsoDoCaixa, useUsoDoCaixa } from "./comum/caixa-proventos";
import FC from "../nucleo";
import { Desliza } from "../ui/desliza";

const ok = (v: any) => FC.ok(v);
const casasQtd = (a: any) => (a && a.classe === "cripto" ? 8 : 0);
const arredonda = (v: number, casas: number) => Math.floor(v * 10 ** casas + 1e-9) / 10 ** casas;
const numTxt = (v: any) => (ok(v) ? String(Number(Number(v).toPrecision(10))).replace(".", ",") : "");
const pilarDe: Record<string, string> = { acao_br: "acoes", acao_us: "acoes", fii: "real_estate", etf_br: "alternativos", etf_us: "alternativos", cripto: "alternativos" };
const mem = { tipo: "compra", filtroHist: "todos", paginaHist: 0 };
/** lançamentos desenhados por página no histórico (desenhar centenas de linhas de uma vez pesa) */
const POR_PAGINA = 30;

// ---------------------------------------------------------------- recorrentes
// Tudo em que você já aportou vira um atalho, com o último aporte de cada
// ativo (de R$ 1 para cima) como sugestão; ativos da carteira e títulos ainda
// sem aporte também aparecem, no fim.
function recorrentes() {
  const b = FC.estado.base;
  const grupos = new Map<string, any>();
  const ord = [...b.aportes].sort((x: any, y: any) => y.data.localeCompare(x.data) || String(y.criado_em).localeCompare(String(x.criado_em)));
  for (const a of ord) {
    if (a.tipo === "provento" || (a.tipo === "caixa" && (a.historico || a.origem || a.valor < 0))) continue;
    if (a.tipo === "ativo" && a.quantidade < 0) continue;
    // abaixo de R$ 1 (sobra de reinvestimento, fração, ajuste de centavos) não é um aporte
    // que se repete: não vira o "último" nem conta como recorrente
    if (!(Math.abs(Number(a.valor ?? (a.quantidade || 0) * (a.preco || 0))) >= 1)) continue;
    const k = a.tipo === "ativo" ? "a:" + a.ticker : "c:" + a.titulo;
    const g = grupos.get(k) || { k, tipo: a.tipo, nome: a.tipo === "ativo" ? a.ticker : a.titulo, n: 0, ultimo: a };
    g.n++;
    grupos.set(k, g);
  }
  for (const a of b.ativos) if (a.lista === "carteira" && !grupos.has("a:" + a.ticker)) grupos.set("a:" + a.ticker, { k: "a:" + a.ticker, tipo: "ativo", nome: a.ticker, n: 0, ultimo: null });
  for (const r of b.rendaFixa) if (!grupos.has("c:" + r.nome)) grupos.set("c:" + r.nome, { k: "c:" + r.nome, tipo: "caixa", nome: r.nome, n: 0, ultimo: null });
  return [...grupos.values()].sort((x, y) => (y.ultimo ? 1 : 0) - (x.ultimo ? 1 : 0) || (y.ultimo && x.ultimo ? y.ultimo.data.localeCompare(x.ultimo.data) : x.nome.localeCompare(y.nome)));
}

function CartaoRecorrente({ g }: { g: any }) {
  const t = useTema();
  const a = g.tipo === "ativo" ? acharAtivo(g.nome) : null;
  const u = g.ultimo;
  const icone = g.tipo === "caixa" ? "moeda" : a && a.classe === "cripto" ? "renda" : "ativos";
  const cor = g.tipo === "caixa" ? t.cores.verde : a && a.classe === "cripto" ? t.cores.s3 : t.cores.acento;
  const sub = u
    ? (g.tipo === "ativo" ? `último: ${FC.fmt.qtd(u.quantidade)} por ${FC.fmt.brlTexto(u.valor)}` : `último: ${FC.fmt.brlTexto(u.valor)}`) + ` · ${FC.datas.br(u.data).slice(0, 5)}`
    : "sem aportes ainda";
  return (
    <Cartao onPress={() => repetir(g)} style={{ paddingVertical: 16, paddingHorizontal: 18, gap: 6, flexGrow: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icone nome={icone as any} tam={22} cor={cor} />
        <T style={{ fontSize: 16, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>{g.nome}</T>
        {g.n > 1 ? <View style={{ marginLeft: "auto" }}><Pilula cor="cinza" semPonto>{g.n}×</Pilula></View> : null}
      </View>
      <Rs style={{ fontSize: 12.5, color: t.cores.ink2 }}>{sub}</Rs>
      <T style={{ color: t.cores.acento, fontSize: 14, fontWeight: "500" }}>{u ? "Repetir" : "Aportar"} ›</T>
    </Cartao>
  );
}

// grava o aporte (e fecha a folha, se veio de uma)
async function grava(linha: any, msg: string, api?: ApiFolha) {
  try {
    await FC.db.inserir("aportes", linha);
    // comprou algo que estava só na watchlist: passa para a carteira
    const at = linha.tipo === "ativo" && linha.quantidade > 0 && FC.estado.base.ativos.find((x: any) => x.ticker === linha.ticker);
    if (at && at.lista === "watchlist") await FC.db.atualizar("ativos", at.id, { lista: "carteira" });
    api?.fechar();
    await depoisDeMudar(msg, true);
    FC.db.log("aporte", { destino: linha.ticker || linha.titulo, valor: linha.valor });
    return true;
  } catch (e) { ui.erro(e); return false; }
}

// Interface simplificada: valor e quantidade, e pronto.
// sugestao: valor em R$ para já vir preenchido (ex.: o que falta no plano do mês)
function FormRepetir({ g, sugestao, api }: { g: any; sugestao: number | null; api: ApiFolha }) {
  const t = useTema();
  const u = sugestao ? { ...(g.ultimo || {}), valor: sugestao, quantidade: null } : g.ultimo;
  const [valor, setValor] = useState(u ? numTxt(u.valor) : "");
  const [qtd, setQtd] = useState("");
  const [qtdManual, setQtdManual] = useState(false);
  const [data, setData] = useState(FC.datas.hoje());
  const a = g.tipo === "ativo" ? acharAtivo(g.nome) : null;
  const preco = a && ok(a.preco) ? a.preco : null;
  const unid = FC.unidade(a || { ticker: g.nome }, 2);
  const v = FC.lerNum(valor);
  const qAuto = !qtdManual && v > 0 && preco ? numTxt(arredonda(v / preco, casasQtd(a))) : null;
  const qMostrada = qAuto ?? qtd;
  const q2 = FC.lerNum(qMostrada);
  const efetivo = v > 0 && q2 > 0 ? v / q2 : null;

  Repetir.salvar.set(api.id, async () => {
    if (g.tipo === "caixa") {
      if (!(v > 0)) { ui.aviso("Informe o valor.", "erro"); return; }
      await grava({ tipo: "caixa", titulo: g.nome, valor: v, data: data || FC.datas.hoje(), observacao: "" }, `${FC.fmt.brlTexto(v)} adicionado a ${g.nome}`, api);
      return;
    }
    if (!(v > 0 && q2 > 0)) { ui.aviso("Informe o valor e a quantidade.", "erro"); return; }
    await grava({ tipo: "ativo", ticker: g.nome, quantidade: q2, preco: v / q2, valor: v, data: data || FC.datas.hoje(), observacao: "" },
      `${FC.fmt.qtd(q2)} ${unid} por ${FC.fmt.brlTexto(v)} adicionado`, api);
  });

  if (g.tipo === "caixa") {
    const tv = ((FC.estado.dados && FC.estado.dados.rendaFixa) || []).find((r: any) => r.nome === g.nome);
    const saldo = tv ? tv.valor_aplicado : aportadoRf(g.nome);
    return (
      <Form>
        <Campo rotulo="Valor (R$)"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor" /></Campo>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <T v="p">Saldo atual: <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(saldo)}</Rs>. O valor soma a ele.</T>
      </Form>
    );
  }
  return (
    <Form>
      <LinhaCampos>
        <Campo rotulo="Valor (R$)"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor" /></Campo>
        <Campo rotulo={`Quantidade (${unid})`} dica="vem calculada pelo preço de agora — ajuste para o que a corretora executou">
          <Entrada valor={qMostrada} aoMudar={(x) => { setQtdManual(true); setQtd(x); }} decimal placeholder={a && a.classe === "cripto" ? "0,00045" : "0"} accessibilityLabel="Quantidade" />
        </Campo>
      </LinhaCampos>
      <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
      <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 18 }}>
        <Kpis style={{ rowGap: 8, columnGap: 28 }}>
          <Kpi pequeno rotulo={`Preço pago por ${unid}`} valor={efetivo ? FC.fmt.preco(efetivo) : "—"} />
          <Kpi pequeno rotulo="Preço de agora" valor={preco ? FC.fmt.preco(preco) : "—"} peq={efetivo && preco ? `${FC.fmt.delta((efetivo / preco - 1) * 100, 2)}% de diferença` : undefined} />
          {a && a.posicao && q2 > 0 ? <Kpi pequeno rotulo="Posição depois" valor={`${FC.fmt.qtd(a.posicao.quantidade + q2)} ${unid}`} /> : null}
        </Kpis>
      </View>
    </Form>
  );
}
const Repetir = { salvar: new Map<number, () => Promise<void>>() };

function repetir(g: any, sugestao: number | null = null) {
  ui.folha({
    titulo: `Aportar em ${g.nome}`,
    corpo: (api) => <FormRepetir g={g} sugestao={sugestao} api={api} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={api.fechar}>Cancelar</Botao>
        <Botao onPress={() => Repetir.salvar.get(api.id)?.()}>Adicionar</Botao>
      </>
    ),
  });
}

// atalho usado por outras telas (guia do mês do Salário)
FC.aportarRapido = function ({ tipo, nome, valor }: { tipo: string; nome: string; valor: number }) {
  const g = recorrentes().find((x) => x.k === (tipo === "ativo" ? "a:" : "c:") + nome) || { k: (tipo === "ativo" ? "a:" : "c:") + nome, tipo, nome, n: 0, ultimo: null };
  repetir(g, valor > 0 ? Number(valor.toFixed(2)) : null);
};

// ---------------------------------------------------------------- sugestões (datalist)
function Sugestoes({ valor, opcoes, aoEscolher }: { valor: string; opcoes: string[]; aoEscolher: (v: string) => void }) {
  const t = useTema();
  const v = valor.trim().toUpperCase();
  const lista = v.length >= 1 ? opcoes.filter((x) => x.toUpperCase().startsWith(v) && x.toUpperCase() !== v).slice(0, 6) : [];
  if (!lista.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {lista.map((s) => (
        <Pressable key={s} onPress={() => aoEscolher(s)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}>
          <Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function sugestoesAtivos() {
  const u = FC.estado.mercado.universo || { acoes: {}, fiis: {} };
  const meus = FC.estado.base.ativos.map((a: any) => a.ticker);
  return [...new Set<string>([...meus, "BTC", "ETH", "SOL", "BNB", "USDT", ...Object.keys(u.acoes), ...Object.keys(u.fiis)])];
}

function Previa({ a }: { a: any }) {
  const t = useTema();
  if (!a || a.erro) return null;
  return (
    <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 16, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <Anel score={a.score} cor={a.cor} />
        <Kpis style={{ rowGap: 8, columnGap: 32 }}>
          <Kpi pequeno rotulo="Preço de agora" valor={FC.fmt.preco(a.preco)} />
          {a.posicao ? <Kpi pequeno rotulo="Você tem" valor={`${FC.fmt.qtd(a.posicao.quantidade)} ${FC.unidade(a, a.posicao.quantidade)}`} /> : null}
          <Kpi pequeno rotulo="Avaliação" valor={<Pilula cor={a.cor}>{a.veredito_curto}</Pilula>} />
        </Kpis>
        <View style={{ flex: 1, minWidth: 160 }}><Indicadores ativo={a} /></View>
        <Botao variante="texto" pequeno onPress={() => abreAtivo(a.ticker)}>Ver análise</Botao>
      </View>
    </View>
  );
}

// ao reinvestir sem ativo escolhido: os ativos do plano do Salário
function DestinosDoPlano({ aoEscolher }: { aoEscolher: (v: string) => void }) {
  const t = useTema();
  const plano = FC.estado.prefs.plano || {};
  const alvos: string[] = [...new Set<string>((plano.destinos || []).filter((d: any) => d.tipo === "ativo" && d.alvo).map((d: any) => d.alvo))];
  if (!alvos.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <T style={{ fontSize: 13, color: t.cores.ink2 }}>do seu plano:</T>
      {alvos.slice(0, 6).map((s) => (
        <Pressable key={s} onPress={() => aoEscolher(s)} accessibilityRole="button" style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 980, backgroundColor: t.cores.campo }}>
          <Text style={{ fontSize: 13, color: t.cores.ink }}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- compra / venda
function FormCompraVenda({ tipo, pre, reinvestir }: { tipo: "compra" | "venda"; pre: string; reinvestir?: boolean }) {
  const t = useTema();
  // reinvestir: a compra já vem usando o caixa de proventos, com o saldo dele no valor
  const uso = useUsoDoCaixa(!!reinvestir && tipo === "compra");
  const [ticker, setTicker] = useState(pre || "");
  const [qtd, setQtd] = useState("");
  const [valor, setValor] = useState(reinvestir && uso.temSaldo ? numTxt(Math.floor(uso.cx.saldo * 100) / 100) : "");
  const [classe, setClasse] = useState<string | null>(null);
  const [pilar, setPilar] = useState<string | null>(null);
  const [data, setData] = useState(FC.datas.hoje());
  const [obs, setObs] = useState("");
  const sug = useMemo(sugestoesAtivos, []);
  const tk = ticker.trim().toUpperCase();
  const a = acharAtivo(tk);
  const novo = !!tk && !a && tipo === "compra";
  const classeEf = classe ?? (novo ? adivinhaClasse(tk) : "acao_br");
  const pilarEf = pilar ?? pilarDe[classeEf];
  const cripto = (a && a.classe === "cripto") || (novo && classeEf === "cripto");
  const qq = FC.lerNum(qtd), vv = FC.lerNum(valor);

  const registra = async () => {
    const tt = tk.replace(/[^A-Z0-9-]/g, "");
    if (tt.length < 2) { ui.aviso("Informe o código do ativo.", "erro"); return; }
    if (!(qq > 0 && vv > 0)) { ui.aviso("Quantidade e valor precisam ser maiores que zero.", "erro"); return; }
    const existe = acharAtivo(tt);
    if (tipo === "venda" && !existe) { ui.aviso(`${tt} não está na sua carteira.`, "erro"); return; }
    if (tipo === "venda" && existe.posicao && qq > existe.posicao.quantidade + 1e-9) {
      if (!(await ui.confirma(`Você tem ${FC.fmt.qtd(existe.posicao.quantidade)} ${FC.unidade(existe, 2)} registrados e está vendendo ${FC.fmt.qtd(qq)}. Registrar mesmo assim?`, { botao: "Registrar" }))) return;
    }
    const venda = tipo === "venda";
    const crip = classeEf === "cripto";
    try {
      if (!existe) await FC.db.inserir("ativos", { ticker: crip ? tt : tt.replace(/-/g, ""), classe: classeEf, pilar: pilarEf, lista: "carteira", quantidade: 0 });
    } catch (err) { ui.erro(err); return; }
    const doCaixa = venda ? 0 : Number(uso.usado(vv).toFixed(2));
    const okGrava = await grava({ tipo: "ativo", ticker: existe ? existe.ticker : crip ? tt : tt.replace(/-/g, ""), quantidade: venda ? -qq : qq, preco: vv / qq,
      valor: venda ? -vv : vv, data: data || FC.datas.hoje(), observacao: obs || "", venda, ...(doCaixa > 0 ? { do_provento: doCaixa } : {}) },
      venda ? "Venda registrada" : doCaixa > 0 ? "Reinvestimento registrado" : "Aporte registrado");
    if (okGrava) { setQtd(""); setValor(""); setObs(""); uso.limpa(); }
  };

  return (
    <Form>
      <LinhaCampos n={3}>
        <Campo rotulo="Ativo">
          <Entrada valor={ticker} aoMudar={setTicker} maiusculas placeholder="BTC, PETR4, HGLG11…" accessibilityLabel="Ativo" />
          <Sugestoes valor={ticker} opcoes={sug} aoEscolher={setTicker} />
          {reinvestir && !tk ? <DestinosDoPlano aoEscolher={setTicker} /> : null}
        </Campo>
        <Campo rotulo={cripto ? `Quantidade (${tk.split("-")[0].replace(/\d+$/, "") || "moedas"})` : "Quantidade"}>
          <Entrada valor={qtd} aoMudar={setQtd} decimal placeholder={cripto ? "0,00045" : "0"} accessibilityLabel="Quantidade" />
        </Campo>
        <Campo rotulo="Valor total (R$)" dica={`o que ${tipo === "venda" ? "você recebeu" : "você pagou"}, como no extrato`}>
          <Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor total" />
        </Campo>
      </LinhaCampos>
      {novo ? (
        <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 18 }}>
          <T v="p" style={{ marginBottom: t.espaco.e3 }}><B>{tk}</B> ainda não está na sua carteira — vai ser adicionado junto com este aporte.</T>
          <LinhaCampos>
            <Campo rotulo="Tipo"><Seletor valor={classeEf} rotuloA11y="Tipo" opcoes={FC.classesLigadas().map(([k, v]: any) => ({ v: k, rotulo: v }))}
              aoMudar={(v) => { setClasse(v); setPilar(pilarDe[v]); }} /></Campo>
            <Campo rotulo="Pilar"><Seletor valor={pilarEf} aoMudar={setPilar} rotuloA11y="Pilar"
              opcoes={FC.PILARES.filter((p: any) => p.chave !== "agro").map((p: any) => ({ v: p.chave, rotulo: p.nome }))} /></Campo>
          </LinhaCampos>
        </View>
      ) : null}
      <LinhaCampos>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={120} placeholder="corretora, motivo…" autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
      </LinhaCampos>
      {tipo === "compra" ? <UsoDoCaixa uso={uso} total={vv} /> : null}
      <Previa a={a} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: t.espaco.e3 }}>
        <T style={{ color: t.cores.ink2 }}>{qq > 0 && vv > 0 ? <>Preço por unidade <B>{FC.fmt.preco(vv / qq)}</B>{a && ok(a.preco) ? ` · agora ${FC.fmt.preco(a.preco)}` : ""}</> : ""}</T>
        <Botao onPress={registra}>{`Registrar ${tipo}`}</Botao>
      </View>
    </Form>
  );
}

// ---------------------------------------------------------------- renda fixa
const DICA_TAXA: Record<string, string> = { cdi: "100 = 100% do CDI", selic: "100 = Tesouro Selic", ipca: "6,5 = IPCA + 6,5% ao ano", prefixado: "13,2 = 13,2% ao ano" };
const INDEXADORES = [{ v: "cdi", rotulo: "% do CDI" }, { v: "selic", rotulo: "% da Selic" }, { v: "ipca", rotulo: "IPCA + taxa" }, { v: "prefixado", rotulo: "Prefixado" }];

function FormCaixa() {
  const t = useTema();
  const uso = useUsoDoCaixa(false);
  const titulos = FC.estado.base.rendaFixa.map((r: any) => r.nome);
  const [nome, setNome] = useState(titulos.length === 1 ? titulos[0] : "");
  const [op, setOp] = useState<"aporte" | "resgate">("aporte");
  const [valor, setValor] = useState("");
  const [tipoRf, setTipoRf] = useState("cdi");
  const [taxa, setTaxa] = useState("");
  const [venc, setVenc] = useState("");
  const [data, setData] = useState(FC.datas.hoje());
  const [obs, setObs] = useState("");
  const [indAporte, setIndAporte] = useState("");
  const [taxaAporte, setTaxaAporte] = useState("");
  const tt = FC.estado.base.rendaFixa.find((r: any) => r.nome.toLowerCase() === nome.trim().toLowerCase());
  const tv = tt && ((FC.estado.dados && FC.estado.dados.rendaFixa) || []).find((r: any) => r.id === tt.id);

  const registra = async () => {
    const vv = FC.lerNum(valor);
    const n = nome.trim();
    if (!n) { ui.aviso("Informe o título.", "erro"); return; }
    if (!(vv > 0)) { ui.aviso("Informe um valor maior que zero.", "erro"); return; }
    if (!tt && op === "resgate") { ui.aviso("Não dá para resgatar de um título que não existe.", "erro"); return; }
    try {
      // título novo nasce com saldo zero: o aporte é o saldo (nada conta duas vezes)
      if (!tt) await FC.db.inserir("renda_fixa", { nome: n, tipo: tipoRf, taxa: FC.lerNum(taxa), vencimento: venc || null, valor_aplicado: 0, pilar: "caixa" });
    } catch (err) { ui.erro(err); return; }
    // taxa própria do aporte (só quando informada; vazio = a do título)
    const propria = tt && op === "aporte" && (indAporte || FC.lerNum(taxaAporte) != null)
      ? { indexador: indAporte || tt.tipo, taxa: FC.lerNum(taxaAporte) ?? tt.taxa } : {};
    const doCaixa = op === "resgate" ? 0 : Number(uso.usado(vv).toFixed(2));
    const okG = await grava({ tipo: "caixa", titulo: tt ? tt.nome : n, valor: op === "resgate" ? -vv : vv, data: data || FC.datas.hoje(), observacao: obs || "", ...propria,
      ...(doCaixa > 0 ? { do_provento: doCaixa } : {}) },
      op === "resgate" ? "Resgate registrado" : doCaixa > 0 ? "Reinvestimento registrado" : "Aporte registrado");
    if (okG) { setValor(""); setObs(""); uso.limpa(); }
  };

  return (
    <Form>
      <LinhaCampos n={3}>
        <Campo rotulo="Título">
          <Entrada valor={nome} aoMudar={setNome} maxLength={80} placeholder="CDB Banco X, Tesouro Selic…" autoCapitalize="words" accessibilityLabel="Título" />
          <Sugestoes valor={nome} opcoes={titulos} aoEscolher={setNome} />
        </Campo>
        <Campo rotulo="Movimento">
          <Segmentado valor={op} aoMudar={setOp} rotuloA11y="Movimento" opcoes={[{ v: "aporte", rotulo: "Aporte" }, { v: "resgate", rotulo: "Resgate" }]} />
        </Campo>
        <Campo rotulo="Valor (R$)"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor" /></Campo>
      </LinhaCampos>
      {nome.trim() && !tt ? (
        <View style={{ backgroundColor: t.cores.bg3, borderRadius: t.raios.r, paddingVertical: 14, paddingHorizontal: 18 }}>
          <T v="p" style={{ marginBottom: t.espaco.e3 }}><B>{nome.trim()}</B> é um título novo — ele é criado com saldo zero e este aporte vira o saldo.</T>
          <LinhaCampos n={3}>
            <Campo rotulo="Indexador"><Seletor valor={tipoRf} aoMudar={setTipoRf} opcoes={INDEXADORES} rotuloA11y="Indexador" /></Campo>
            <Campo rotulo="Taxa" dica={DICA_TAXA[tipoRf].replace("100 = 100% do CDI", "100 = 100% do CDI")}><Entrada valor={taxa} aoMudar={setTaxa} decimal placeholder="100" accessibilityLabel="Taxa" /></Campo>
            <Campo rotulo="Vencimento"><CampoData valor={venc} aoMudar={setVenc} rotuloA11y="Vencimento" /></Campo>
          </LinhaCampos>
        </View>
      ) : null}
      <LinhaCampos>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
        <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={120} autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
      </LinhaCampos>
      {tt && op !== "resgate" ? (
        <Detalhes rotulo="Este aporte tem uma taxa diferente da do título" style={{ marginTop: 0 }}>
          <LinhaCampos>
            <Campo rotulo="Indexador deste aporte"><Seletor valor={indAporte} aoMudar={setIndAporte} rotuloA11y="Indexador deste aporte"
              opcoes={[{ v: "", rotulo: "o do título" }, ...INDEXADORES]} /></Campo>
            <Campo rotulo="Taxa deste aporte" dica="ex.: o mesmo CDB comprado a 105% do CDI em outro mês">
              <Entrada valor={taxaAporte} aoMudar={setTaxaAporte} decimal placeholder="ex.: 105" accessibilityLabel="Taxa deste aporte" /></Campo>
          </LinhaCampos>
        </Detalhes>
      ) : null}
      {op === "aporte" ? <UsoDoCaixa uso={uso} total={FC.lerNum(valor) || 0} /> : null}
      {tt ? <T v="p">Saldo de hoje em <B>{tt.nome}</B>: <Rs style={{ fontSize: 13 }}>{FC.fmt.brlTexto(tv ? tv.valor_aplicado : 0)}</Rs>{tv && tv.rent ? ` (${tv.base})` : ""}. Este lançamento soma a ele.</T> : null}
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}><Botao onPress={registra}>Registrar</Botao></View>
    </Form>
  );
}

// ---------------------------------------------------------------- provento
function FormProvento() {
  const [ticker, setTicker] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(FC.datas.hoje());
  const [obs, setObs] = useState("");
  const meus = (FC.estado.dados.ativos || []).map((a: any) => a.ticker);
  const registra = async () => {
    const vv = FC.lerNum(valor);
    if (!(vv > 0)) { ui.aviso("Informe um valor maior que zero.", "erro"); return; }
    const okG = await grava({ tipo: "provento", ticker: ticker.toUpperCase().replace(/[^A-Z0-9]/g, ""), valor: vv, data: data || FC.datas.hoje(), observacao: obs || "" }, "Provento registrado");
    if (okG) { setValor(""); setObs(""); }
  };
  return (
    <Form>
      <LinhaCampos n={3}>
        <Campo rotulo="Ativo">
          <Entrada valor={ticker} aoMudar={setTicker} maiusculas placeholder="ITSA4" accessibilityLabel="Ativo" />
          <Sugestoes valor={ticker} opcoes={meus} aoEscolher={setTicker} />
        </Campo>
        <Campo rotulo="Valor recebido (R$)"><Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Valor recebido" /></Campo>
        <Campo rotulo="Data"><CampoData valor={data} aoMudar={setData} rotuloA11y="Data" /></Campo>
      </LinhaCampos>
      <Campo rotulo="Observação"><Entrada valor={obs} aoMudar={setObs} maxLength={120} placeholder="dividendo, JCP, rendimento…" autoCapitalize="sentences" accessibilityLabel="Observação" /></Campo>
      <T v="p">Provento não mexe na posição nem no custo: fica registrado para você ver quanto a carteira já pagou.</T>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}><Botao onPress={registra}>Registrar</Botao></View>
    </Form>
  );
}

// ---------------------------------------------------------------- histórico
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
async function exclui(a: any) {
  if (!(await ui.confirma("Excluir este lançamento? A posição e o preço médio são recalculados.", { botao: "Excluir", perigo: true }))) return;
  try { await FC.db.apagar("aportes", a.id); await depoisDeMudar("Lançamento excluído"); } catch (e) { ui.erro(e); }
}

function Historico() {
  const t = useTema();
  const [filtro, setFiltro] = useState(mem.filtroHist);
  const [pagina, setPagina] = useState(mem.paginaHist);
  let lista = [...FC.estado.base.aportes].sort((a: any, b: any) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)));
  if (filtro !== "todos") lista = lista.filter((a: any) => a.tipo === filtro);
  const total = FC.soma(lista.filter((a: any) => a.tipo !== "provento"), (a: any) => a.valor);
  // os dados já estão na memória (o cálculo da carteira usa todos); só a página atual é desenhada
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const itens = lista.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const vai = (p: number) => { mem.paginaHist = p; setPagina(p); };
  const linhas: React.ReactNode[] = [];
  let mesAnt: string | null = null;
  for (const a of itens) {
    const mes = a.data.slice(0, 7);
    if (mes !== mesAnt) linhas.push(<GrupoTitulo key={"m" + mes}>{MESES_LONGOS[Number(mes.slice(5)) - 1]} de {mes.slice(0, 4)}</GrupoTitulo>);
    mesAnt = mes;
    const cor = a.tipo === "provento" ? "verde" : a.tipo === "caixa" ? "azul" : a.venda || a.quantidade < 0 ? "amarelo" : "azul";
    const doCaixa = FC.caixaProventos.usado(FC.estado.base, a);
    const rot = doCaixa > 0 ? "Reinvestimento" : a.tipo === "provento" ? "Provento" : a.tipo === "caixa" ? (a.valor < 0 ? "Resgate" : "Renda fixa") : a.venda || a.quantidade < 0 ? "Venda" : "Compra";
    const partes = doCaixa > 0 ? `${FC.fmt.brlTexto(doCaixa)} dos proventos + ${FC.fmt.brlTexto(Math.max(0, a.valor - doCaixa))} novo` : "";
    linhas.push(
      <Desliza key={a.id} acoes={[{ rotulo: "Excluir", perigo: true, aoTocar: () => exclui(a) }]}><Item
        esquerda={<View style={{ width: 44, alignItems: "center" }}>
          <T style={{ fontSize: 17, lineHeight: 18, fontWeight: "600" }}>{a.data.slice(8, 10)}</T>
          <T style={{ fontSize: 12.5, color: t.cores.ink3 }}>{FC.datas.mesAno(a.data).split("/")[0]}</T>
        </View>}
        titulo={<View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <T style={{ fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{a.tipo === "caixa" ? a.titulo : a.ticker}</T><Pilula cor={cor}>{rot}</Pilula></View>}
        detalhe={`${a.tipo === "ativo" ? `${FC.fmt.qtd(Math.abs(a.quantidade))} × ${FC.fmt.preco(a.preco)}` : ""}${a.observacao ? (a.tipo === "ativo" ? " · " : "") + a.observacao : ""}${a.historico ? " · só na curva" : ""}${partes ? " · " + partes : ""}`}
        valores={<Rs cls={a.tipo === "provento" ? "pos" : null} style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(a.valor)}</Rs>}
        direita={<BotaoIcone nome="lixo" tam={17} rotulo="Excluir lançamento" onPress={() => exclui(a)} />} /></Desliza>,
    );
  }
  return (
    <Secao titulo="Histórico"
      sub={<>{lista.length} lançamento{lista.length === 1 ? "" : "s"}{filtro !== "provento" && total ? <> · <Rs style={{ fontSize: 14, color: t.cores.ink2 }}>{FC.fmt.brlTexto(total)}</Rs> líquido</> : null}</>}
      direita={<View style={{ width: 140 }}><Seletor compacto valor={filtro} aoMudar={(v) => { mem.filtroHist = v; setFiltro(v); vai(0); }} rotuloA11y="Filtrar histórico"
        opcoes={[{ v: "todos", rotulo: "Tudo" }, { v: "ativo", rotulo: "Ativos" }, { v: "caixa", rotulo: "Renda fixa" }, { v: "provento", rotulo: "Proventos" }]} /></View>}>
      <View style={{ backgroundColor: t.cores.bg2, borderRadius: t.raios.r, borderWidth: 1, borderColor: t.cores.linha, overflow: "hidden", boxShadow: t.cores.sombra } as any}>
        {itens.length ? linhas.map((l, i) => <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: t.cores.linha } : null}>{l}</View>)
          : <Vazio icone="🧾" titulo="Nenhum lançamento" texto="Registre a primeira compra acima ou importe o extrato da corretora." />}
      </View>
      {paginas > 1 ? (
        <View accessibilityRole={"navigation" as any} accessibilityLabel="Páginas do histórico"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espaco.e2, marginTop: t.espaco.e3 }}>
          <Botao variante="sec" pequeno desabilitado={pag === 0} onPress={() => vai(pag - 1)} rotuloA11y="Lançamentos mais recentes">‹ Mais recentes</Botao>
          <T v="peq" num style={{ textAlign: "center", flexShrink: 1 }}>{pag * POR_PAGINA + 1}–{Math.min((pag + 1) * POR_PAGINA, lista.length)} de {lista.length}</T>
          <Botao variante="sec" pequeno desabilitado={pag >= paginas - 1} onPress={() => vai(pag + 1)} rotuloA11y="Lançamentos mais antigos">Mais antigos ›</Botao>
        </View>
      ) : null}
    </Secao>
  );
}

// ---------------------------------------------------------------- importação
/** arquivo escolhido no formato que o importador do site espera (arrayBuffer) */
async function escolheArquivo(): Promise<{ name: string; arrayBuffer: () => Promise<ArrayBuffer> } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/plain", "application/zip", "application/x-zip-compressed", "*/*"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets || !r.assets.length) return null;
  const a: any = r.assets[0];
  if (Platform.OS === "web" && a.file) return a.file;
  return { name: a.name, arrayBuffer: async () => (await fetch(a.uri)).arrayBuffer() };
}

function FormImportar({ api }: { api: ApiFolha }) {
  const t = useTema();
  const titulos = FC.estado.dados.rendaFixa.map((r: any) => r.nome);
  const [arq, setArq] = useState<any>(null);
  const [senha, setSenha] = useState("");
  const [cofre, setCofre] = useState(titulos[0] || "Cofrinho PicPay");
  const [res, setRes] = useState<{ ok: boolean; texto: React.ReactNode } | null>(null);

  Importar.rodar.set(api.id, async () => {
    if (!arq) { ui.aviso("Escolha um arquivo.", "erro"); return; }
    try {
      const opcoes: any = { senha: senha || null, tituloCaixa: cofre };
      // 1ª passada descobre quais preços o extrato do C6 precisa; busca esses
      // históricos e lê de novo, agora com o preço do dia
      const pedidos = new Set<string>();
      opcoes.resolvePreco = (tk: string) => { pedidos.add(tk); return null; };
      let lido = await FC.importador.le(arq, opcoes);
      if (pedidos.size) {
        const h = await FC.mercado.historicos([...pedidos].map((tk) => ({ ticker: tk, classe: "acao_br" })), 3);
        Object.assign(FC.estado.mercado.historicos, h);
        opcoes.resolvePreco = (tk: string, dia: string) => { const s = h[tk]; return s && !s.erro ? FC.carteira.precoEm(s.precos, dia) : null; };
        lido = await FC.importador.le(arq, opcoes);
      }
      const linhas = lido.itens.map((i: any) => ({
        tipo: i.tipo, data: i.data, ticker: i.ticker || null,
        quantidade: i.tipo === "ativo" ? (i.venda ? -i.quantidade : i.quantidade) : null,
        preco: i.tipo === "ativo" ? i.preco : null,
        valor: i.tipo === "ativo" ? (i.venda ? -1 : 1) * i.quantidade * i.preco : i.valor,
        titulo: i.titulo || null, observacao: (i.observacao || "").slice(0, 160), origem: i.origem,
        historico: !!i.historico, venda: !!i.venda,
      }));
      const novos = await FC.db.inserirVarios("aportes", linhas, "user_id,origem");
      // ativos que apareceram no extrato e ainda não estão cadastrados
      const conhecidos = new Set(FC.estado.base.ativos.map((a: any) => a.ticker));
      const universo = FC.estado.mercado.universo || { fiis: {}, acoes: {} };
      const faltam = [...new Set<string>(linhas.filter((l: any) => l.tipo === "ativo").map((l: any) => l.ticker))].filter((tk) => !conhecidos.has(tk));
      const novosAtivos = faltam.map((tk) => {
        const classe = universo.fiis[tk] ? "fii" : universo.acoes[tk] ? "acao_br" : "etf_br";
        return { ticker: tk, classe, pilar: ({ fii: "real_estate", acao_br: "acoes", etf_br: "alternativos" } as any)[classe], lista: "carteira", quantidade: 0 };
      });
      if (novosAtivos.length) await FC.db.inserirVarios("ativos", novosAtivos, "user_id,ticker");
      setRes({ ok: true, texto: <><B>{novos.length}</B> lançamento(s) importado(s) do extrato {lido.formato}.
        {linhas.length - novos.length ? ` ${linhas.length - novos.length} já estavam registrados e foram ignorados.` : ""}
        {novosAtivos.length ? ` Cadastrei ${novosAtivos.length} ativo(s) novo(s): ${novosAtivos.map((a) => a.ticker).join(", ")} — confira classe e pilar em Investimentos.` : ""}</> });
      await depoisDeMudar(undefined, true);
    } catch (err: any) {
      setRes({ ok: false, texto: FC.ui.traduzErro(err.message || String(err)) });
    }
  });

  return (
    <Form>
      <T v="p">Reconhece o extrato de negociação da corretora (compras e vendas), o extrato de conta do C6 (compras, proventos e CDB) e o do PicPay (cofrinhos). Importar o mesmo arquivo duas vezes não duplica nada.</T>
      <Campo rotulo="Arquivo (CSV ou ZIP)">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Botao variante="sec" pequeno icone="importar" onPress={async () => { const f = await escolheArquivo(); if (f) { setArq(f); setRes(null); } }}>Escolher arquivo</Botao>
          <T style={{ fontSize: 14, color: arq ? t.cores.ink : t.cores.ink3, flexShrink: 1 }} numberOfLines={1}>{arq ? arq.name : "nenhum arquivo escolhido"}</T>
        </View>
      </Campo>
      <LinhaCampos>
        <Campo rotulo="Senha do ZIP (se tiver)"><Entrada valor={senha} aoMudar={setSenha} secureTextEntry autoComplete="off" accessibilityLabel="Senha do ZIP" /></Campo>
        <Campo rotulo="Cofrinho vai para"><Seletor valor={cofre} aoMudar={setCofre} rotuloA11y="Cofrinho vai para"
          opcoes={(titulos.length ? titulos : ["Cofrinho PicPay"]).map((x: string) => ({ v: x, rotulo: x }))} /></Campo>
      </LinhaCampos>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
        <View style={{ marginTop: 3 }}><Icone nome="cadeado" tam={13} cor={t.cores.ink2} /></View>
        <T v="p" style={{ flex: 1 }}>O arquivo é lido aqui no seu aparelho. Só os lançamentos reconhecidos vão para o banco.</T>
      </View>
      {res ? <Mensagem tipo={res.ok ? "ok" : "erro"} icone={res.ok ? "check" : "alerta"}><T style={{ fontSize: 14, color: res.ok ? t.cores.verde : t.cores.vermelho }}>{res.texto}</T></Mensagem> : null}
    </Form>
  );
}
const Importar = { rodar: new Map<number, () => Promise<void>>() };

function importar() {
  ui.folha({
    titulo: "Importar extrato",
    corpo: (api) => <FormImportar api={api} />,
    rodape: (api) => (
      <>
        <Botao variante="sec" onPress={api.fechar}>Fechar</Botao>
        <Botao onPress={() => Importar.rodar.get(api.id)?.()}>Importar</Botao>
      </>
    ),
  });
}

// ---------------------------------------------------------------- tela
export default function Aportes() {
  const t = useTema();
  const e = useEstado();
  const { ticker, reinvestir: reinv } = useLocalSearchParams<{ ticker?: string; reinvestir?: string }>();
  const pre = String(ticker || "").toUpperCase();
  const reinvestir = reinv === "1";
  const [tipo, setTipo] = useState<string>(pre || reinvestir ? "compra" : mem.tipo);
  useEffect(() => { if (pre || reinvestir) setTipo("compra"); }, [pre, reinvestir]);
  if (!e.base || !e.dados) return <Pagina>{null}</Pagina>;
  const rec = recorrentes();
  return (
    <Pagina>
      <Cabecalho titulo="Aportes" sub="Compras, vendas, proventos e renda fixa. A posição e o preço médio saem daqui."
        direita={<Botao variante="sec" icone="importar" onPress={importar}>Importar extrato</Botao>} />
      {rec.length ? (
        <View style={{ marginBottom: t.espaco.e4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: t.espaco.e3, marginBottom: t.espaco.e3 }}>
            <T v="h2">Repetir aporte</T><T v="sub">toque, informe valor e quantidade, pronto</T>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espaco.e3 }}>
            {rec.slice(0, 12).map((g) => <View key={g.k} style={{ flexBasis: 200, flexGrow: 1, minWidth: 0 }}><CartaoRecorrente g={g} /></View>)}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: t.espaco.e3, marginTop: t.espaco.e4, marginBottom: t.espaco.e3 }}>
        {reinvestir && tipo === "compra" ? <><T v="h2">Reinvestir proventos</T><T v="sub">escolha o ativo; se quiser, aumente o valor com dinheiro do bolso</T></>
          : <><T v="h2">Novo aporte</T><T v="sub">em algo que você já tem ou em algo novo</T></>}
      </View>
      <Cartao>
        <View style={{ marginBottom: t.espaco.e4 }}>
          <Segmentado rotuloA11y="Tipo de lançamento" valor={tipo} aoMudar={(v) => { mem.tipo = v; setTipo(v); }}
            opcoes={[{ v: "compra", rotulo: "Compra" }, { v: "venda", rotulo: "Venda" }, { v: "caixa", rotulo: "Renda fixa" }, { v: "provento", rotulo: "Provento" }]} />
        </View>
        {tipo === "compra" || tipo === "venda" ? <FormCompraVenda key={tipo + pre + (reinvestir ? ":r" : "")} tipo={tipo as any} pre={pre} reinvestir={reinvestir && tipo === "compra"} />
          : tipo === "caixa" ? <FormCaixa /> : <FormProvento />}
      </Cartao>
      <Historico />
    </Pagina>
  );
}
