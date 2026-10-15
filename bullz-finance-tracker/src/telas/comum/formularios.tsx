/* Formulários de ativo e de renda fixa (comum.js: formAtivo, formRendaFixa). */
import React, { useState } from "react";
import { View } from "react-native";
import { useTema } from "../../tema";
import { Botao, Mensagem, T } from "../../ui/kit";
import { Campo, CampoData, Entrada, Form, Interruptor, LinhaCampos, Seletor } from "../../ui/campos";
import { ui, type ApiFolha } from "../../ui/folha";
import { depoisDeMudar, gravaInfoTitulo } from "./dados";
import { TabelaLotesRF } from "./rentab";
import FC from "../../nucleo";

const pilarPadrao: Record<string, string> = { acao_br: "acoes", acao_us: "acoes", fii: "real_estate", etf_br: "alternativos", etf_us: "alternativos", cripto: "alternativos" };
const numTxt = (v: any) => (v ? String(v).replace(".", ",") : "");
const pilares = () => FC.PILARES.filter((p: any) => p.chave !== "agro").map((p: any) => ({ v: p.chave, rotulo: p.nome }));

// ---------------------------------------------------------------- ativo
function FormAtivo({ item, novo, api }: { item: any; novo: boolean; api: ApiFolha }) {
  const [ticker, setTicker] = useState(item.ticker || "");
  const [lista, setLista] = useState(item.lista || "carteira");
  const [classe, setClasse] = useState(item.classe || "acao_br");
  const [pilar, setPilar] = useState(item.pilar || "acoes");
  const [qtd, setQtd] = useState(numTxt(item.quantidade));
  const [pm, setPm] = useState(numTxt(item.preco_medio));
  const [desde, setDesde] = useState(item.data_base || (item.criado_em ? String(item.criado_em).slice(0, 10) : ""));
  const [erro, setErro] = useState<string | null>(null);
  const cripto = classe === "cripto";
  const watch = lista === "watchlist";

  const salvar = async () => {
    const linha = {
      ticker: (ticker || "").toUpperCase().replace(cripto ? /[^A-Z0-9-]/g : /[^A-Z0-9]/g, ""),
      classe, pilar, lista,
      quantidade: watch ? 0 : FC.lerNum(qtd) || 0,
      preco_medio: watch ? null : FC.lerNum(pm),
      data_base: watch ? null : desde || null,
    };
    if (linha.ticker.length < (cripto ? 2 : 3)) { setErro("Informe o código do ativo (ex.: ITSA4, MXRF11, BTC)."); return; }
    try {
      if (novo) await FC.db.inserir("ativos", linha); else await FC.db.atualizar("ativos", item.id, linha);
      api.fechar();
      await depoisDeMudar(novo ? `${linha.ticker} adicionado` : "Ativo atualizado", true);
    } catch (err: any) { setErro(FC.ui.traduzErro(err.message)); }
  };
  FormAtivo.salvar.set(api.id, salvar);

  return (
    <Form>
      <LinhaCampos>
        <Campo rotulo="Código" dica={cripto ? "BTC, ETH, SOL… Se não achar, use o código do Yahoo (ex.: PEPE24478-USD)." : undefined}>
          <Entrada valor={ticker} aoMudar={setTicker} placeholder={cripto ? "BTC" : "ITSA4"} maiusculas editable={novo} accessibilityLabel="Código" />
        </Campo>
        <Campo rotulo="Lista">
          <Seletor valor={lista} aoMudar={setLista} rotuloA11y="Lista"
            opcoes={[{ v: "carteira", rotulo: "Carteira (tenho)" }, { v: "watchlist", rotulo: "Watchlist (acompanho)" }]} />
        </Campo>
      </LinhaCampos>
      <LinhaCampos>
        <Campo rotulo="Classe">
          <Seletor valor={classe} rotuloA11y="Classe" opcoes={FC.classesLigadas(item.classe).map(([k, v]: any) => ({ v: k, rotulo: v }))}
            aoMudar={(v) => { setClasse(v); if (novo) setPilar(pilarPadrao[v] || "acoes"); }} />
        </Campo>
        <Campo rotulo="Pilar"><Seletor valor={pilar} aoMudar={setPilar} opcoes={pilares()} rotuloA11y="Pilar" /></Campo>
      </LinhaCampos>
      {watch ? null : (
        <>
          <LinhaCampos>
            <Campo rotulo="Quantidade inicial" dica="A posição que você já tinha. Compras novas entram em Aportes.">
              <Entrada valor={qtd} aoMudar={setQtd} decimal placeholder="0" accessibilityLabel="Quantidade inicial" />
            </Campo>
            <Campo rotulo="Preço médio (opcional)" dica={cripto ? "em reais, por unidade (1 BTC)" : undefined}>
              <Entrada valor={pm} aoMudar={setPm} decimal placeholder="0,00" accessibilityLabel="Preço médio" />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Tenho essa posição desde" dica="a data (aproximada) da compra ao preço médio — é a partir dela que o retorno é medido">
            <CampoData valor={desde} aoMudar={setDesde} max={FC.datas.hoje()} rotuloA11y="Tenho essa posição desde" />
          </Campo>
        </>
      )}
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
FormAtivo.salvar = new Map<number, () => Promise<void>>();

export function formAtivo(item?: any) {
  const novo = !item || !!item._novo;
  const it = item || { lista: "carteira", classe: "acao_br", pilar: "acoes", quantidade: 0 };
  ui.folha({
    titulo: novo ? "Novo ativo" : "Editar " + it.ticker,
    corpo: (api) => <FormAtivo item={it} novo={novo} api={api} />,
    rodape: (api) => (
      <>
        {novo ? null : (
          <Botao variante="perigo" icone="lixo" style={{ marginRight: "auto" }} onPress={async () => {
            if (!(await ui.confirma(`Remover ${it.ticker} da sua lista? Os aportes registrados continuam guardados.`, { botao: "Remover", perigo: true }))) return;
            try { await FC.db.apagar("ativos", it.id); api.fechar(); await depoisDeMudar("Ativo removido"); } catch (e) { ui.erro(e); }
          }}>Remover</Botao>
        )}
        <Botao variante="sec" onPress={api.fechar}>Cancelar</Botao>
        <Botao onPress={() => FormAtivo.salvar.get(api.id)?.()}>Salvar</Botao>
      </>
    ),
    aoFechar: () => undefined,
  });
}

// ---------------------------------------------------------------- renda fixa
const DICA_TAXA: Record<string, string> = { cdi: "110 = 110% do CDI", selic: "100 = Tesouro Selic", ipca: "6,5 = IPCA + 6,5% ao ano", prefixado: "13,2 = 13,2% ao ano" };

function FormRF({ item, novo, api }: { item: any; novo: boolean; api: ApiFolha }) {
  const t = useTema();
  // instituição, isenção e reserva ficam em premissas.titulos[id]
  const info = novo ? {} : FC.infoTitulo(FC.estado.prefs, item.id);
  const sugere = (nome: string) => !!(FC.alertas && FC.alertas.sugereIsento(nome));
  const [nome, setNome] = useState(item.nome || "");
  const [tipo, setTipo] = useState(item.tipo || "cdi");
  const [taxa, setTaxa] = useState(item.taxa != null ? String(item.taxa).replace(".", ",") : "");
  const [valor, setValor] = useState(numTxt(item.valor_aplicado));
  const [ini, setIni] = useState(item.data_inicio || (item.criado_em ? String(item.criado_em).slice(0, 10) : ""));
  const [atual, setAtual] = useState(item.valor_atual != null ? String(item.valor_atual).replace(".", ",") : "");
  const [atualEm, setAtualEm] = useState(item.valor_atual_em || FC.datas.hoje());
  const [venc, setVenc] = useState(item.vencimento || "");
  const [pilar, setPilar] = useState(item.pilar || "caixa");
  const [inst, setInst] = useState(info.instituicao || "");
  // enquanto a pessoa não mexer, a isenção acompanha o nome (LCI, LCA…)
  const [isento, setIsento] = useState(info.isento != null ? !!info.isento : sugere(item.nome || ""));
  const [isentoMexido, setIsentoMexido] = useState(info.isento != null);
  const [reserva, setReserva] = useState(!!info.reserva);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    const linha: any = { nome: nome.trim(), tipo, taxa: FC.lerNum(taxa), valor_aplicado: FC.lerNum(valor) || 0,
      vencimento: venc || null, pilar, data_inicio: ini || null };
    if (!novo) {
      const v = String(atual || "").trim() === "" ? null : FC.lerNum(atual);
      linha.valor_atual = FC.ok(v) && v >= 0 ? v : null;
      linha.valor_atual_em = linha.valor_atual == null ? null : atualEm || FC.datas.hoje();
    }
    if (!linha.nome) { setErro("Dê um nome ao título."); return; }
    const extra = { instituicao: inst.trim(), isento: !!isento, reserva: !!reserva };
    try {
      // título novo: o id só existe depois de criado
      const salvo = novo ? await FC.db.inserir("renda_fixa", linha) : await FC.db.atualizar("renda_fixa", item.id, linha);
      const id = (salvo && salvo.id) || item.id;
      const antes: any = novo ? {} : info;
      const mudou = (["instituicao", "isento", "reserva"] as const).some((k) => (k === "instituicao" ? (antes[k] || "") : !!antes[k]) !== (extra as any)[k]);
      if (id != null && (mudou || (novo && (extra.instituicao || extra.isento || extra.reserva)))) await gravaInfoTitulo(id, extra);
      api.fechar();
      await depoisDeMudar(novo ? "Título adicionado" : "Título atualizado");
    } catch (err: any) { setErro(FC.ui.traduzErro(err.message)); }
  };
  FormRF.salvar.set(api.id, salvar);
  const rf = !novo ? ((FC.estado.dados && FC.estado.dados.rendaFixa) || []).find((x: any) => x.id === item.id) : null;

  return (
    <Form>
      <Campo rotulo="Nome">
        <Entrada valor={nome} maxLength={80} placeholder="CDB Banco X 2028" accessibilityLabel="Nome" autoCapitalize="sentences"
          aoMudar={(v) => { setNome(v); if (!isentoMexido) setIsento(sugere(v)); }} />
      </Campo>
      <LinhaCampos>
        <Campo rotulo="Indexador">
          <Seletor valor={tipo} aoMudar={setTipo} rotuloA11y="Indexador"
            opcoes={[{ v: "cdi", rotulo: "% do CDI" }, { v: "selic", rotulo: "% da Selic" }, { v: "ipca", rotulo: "IPCA + taxa" }, { v: "prefixado", rotulo: "Prefixado" }]} />
        </Campo>
        <Campo rotulo="Taxa contratada" dica={DICA_TAXA[tipo]}>
          <Entrada valor={taxa} aoMudar={setTaxa} decimal placeholder="110" accessibilityLabel="Taxa contratada" />
        </Campo>
      </LinhaCampos>
      <LinhaCampos>
        <Campo rotulo="Saldo inicial (R$)" dica="o que já estava aplicado antes. Se vai lançar o dinheiro em Aportes, deixe 0 — senão ele conta duas vezes.">
          <Entrada valor={valor} aoMudar={setValor} decimal placeholder="0,00" accessibilityLabel="Saldo inicial" />
        </Campo>
        <Campo rotulo="Saldo inicial desde" dica="a partir de quando o saldo inicial rende">
          <CampoData valor={ini} aoMudar={setIni} rotuloA11y="Saldo inicial desde" />
        </Campo>
      </LinhaCampos>
      {novo ? null : (
        <LinhaCampos>
          <Campo rotulo="Valor atual (R$)" dica="o saldo que o banco mostra. A diferença para o que você aplicou conta como rendimento. Vazio = calcula pela taxa.">
            <Entrada valor={atual} aoMudar={setAtual} decimal placeholder="calculado pela taxa" accessibilityLabel="Valor atual" />
          </Campo>
          <Campo rotulo="Valor de" dica="aportes depois desta data somam ao valor">
            <CampoData valor={atualEm} aoMudar={setAtualEm} rotuloA11y="Valor de" />
          </Campo>
        </LinhaCampos>
      )}
      <Campo rotulo="Vencimento"><CampoData valor={venc} aoMudar={setVenc} rotuloA11y="Vencimento" /></Campo>
      <Campo rotulo="Pilar"><Seletor valor={pilar} aoMudar={setPilar} opcoes={pilares()} rotuloA11y="Pilar" /></Campo>
      <Campo rotulo="Instituição" dica="o banco que emitiu o título — serve para conferir o limite de R$ 250 mil do FGC">
        <Entrada valor={inst} aoMudar={setInst} maxLength={60} placeholder="Banco X" autoCapitalize="words" accessibilityLabel="Instituição" />
      </Campo>
      <LinhaCampos>
        <Interruptor valor={isento} aoMudar={(v) => { setIsentoMexido(true); setIsento(v); }} rotulo="Isento de IR" />
        <Interruptor valor={reserva} aoMudar={setReserva} rotulo="É reserva de emergência" />
      </LinhaCampos>
      <T style={{ fontSize: 12, color: t.cores.ink3 }}>LCI, LCA, CRI, CRA e poupança não pagam IR para pessoa física. A reserva é o dinheiro para imprevistos, que dá para resgatar a qualquer momento.</T>
      {rf && rf.rent ? <View style={{ marginTop: t.espaco.e3 }}><TabelaLotesRF rent={rf.rent} /></View> : null}
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Form>
  );
}
FormRF.salvar = new Map<number, () => Promise<void>>();

export function formRendaFixa(item?: any) {
  const novo = !item || !!item._novo;
  const it = item || { tipo: "cdi", pilar: "caixa" };
  ui.folha({
    titulo: novo ? "Novo título de renda fixa" : "Editar título",
    corpo: (api) => <FormRF item={it} novo={novo} api={api} />,
    rodape: (api) => (
      <>
        {novo ? null : (
          <Botao variante="perigo" icone="lixo" style={{ marginRight: "auto" }} onPress={async () => {
            if (!(await ui.confirma(`Remover ${it.nome}?`, { botao: "Remover", perigo: true }))) return;
            try {
              await FC.db.apagar("renda_fixa", it.id); api.fechar();
              // tira o título apagado de premissas.titulos
              if ((((FC.estado.base.prefsBrutas || {}).premissas || {}).titulos || {})[it.id]) {
                try { await gravaInfoTitulo(it.id, null); } catch (e) { console.error(e); }
              }
              await depoisDeMudar("Título removido");
            } catch (e) { ui.erro(e); }
          }}>Remover</Botao>
        )}
        <Botao variante="sec" onPress={api.fechar}>Cancelar</Botao>
        <Botao onPress={() => FormRF.salvar.get(api.id)?.()}>Salvar</Botao>
      </>
    ),
  });
}

FC.comum = Object.assign(FC.comum || {}, { formAtivo, formRendaFixa });
