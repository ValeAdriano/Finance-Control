/* Potes: a renda fixa separada por finalidade (Marco 2). Mostra o saldo de
 * cada pote, a reserva de emergência contra a meta e move dinheiro entre
 * potes (o patrimônio não muda: são duas linhas que somam zero). */
import React, { useState } from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import { Botao, Cabecalho, Cartao, Item, Lista, Mensagem, Pilula, Rs, Secao, T, Trilha, Vazio } from "../ui/kit";
import { Campo, Entrada, Form, LinhaCampos, Seletor } from "../ui/campos";
import { ui } from "../ui/folha";
import { depoisDeMudar } from "./comum/dados";
import FC from "../nucleo";

function Mover({ potes }: { potes: any }) {
  const opcoes = potes.potes.map((p: any) => ({ v: p.id, rotulo: p.nome }));
  const [de, setDe] = useState<string>(potes.livre_id || opcoes[0]?.v);
  const [para, setPara] = useState<string>(opcoes.find((o: any) => o.v !== de)?.v);
  const [valor, setValor] = useState("");
  const mover = async () => {
    try {
      const t = FC.potes.transferencia(potes, { de, para, valor: FC.lerNum(valor) });
      for (const l of t.linhas) await FC.db.inserir("potes_movimentos", l);
      setValor("");
      await depoisDeMudar(`${FC.fmt.brlTexto(t.valor)} de ${t.origem.nome} para ${t.destino.nome}`);
    } catch (err) { ui.erro(err); }
  };
  return (
    <Cartao>
      <Form>
        <LinhaCampos>
          <Campo rotulo="De"><Seletor valor={de} opcoes={opcoes} aoMudar={setDe} rotuloA11y="Pote de origem" /></Campo>
          <Campo rotulo="Para"><Seletor valor={para} opcoes={opcoes} aoMudar={setPara} rotuloA11y="Pote de destino" /></Campo>
        </LinhaCampos>
        <Campo rotulo="Valor (R$)" dica="Muda só a finalidade: o patrimônio e a alocação continuam iguais.">
          <Entrada valor={valor} aoMudar={setValor} decimal />
        </Campo>
        <Botao onPress={mover} desabilitado={!(FC.lerNum(valor) > 0) || de === para}>Mover</Botao>
      </Form>
    </Cartao>
  );
}

export default function Potes() {
  const t = useTema();
  const e = useEstado();
  const potes = e.dados && e.dados.potes;
  const cab = <Cabecalho titulo="Potes" sub="Cada real da renda fixa com uma finalidade." />;
  if (!potes) {
    const semTabela = FC.db && FC.db.temTabela && !FC.db.temTabela("potes");
    const criar = async () => {
      try { for (const p of FC.potes.padroes()) await FC.db.inserir("potes", p); await depoisDeMudar("Potes criados"); } catch (err) { ui.erro(err); }
    };
    return (
      <Pagina>{cab}
        <Lista><Vazio icone="🫙" titulo={semTabela ? "Potes ainda não disponíveis" : "Você ainda não tem potes"}
          texto={semTabela ? "O banco desta conta ainda não tem a tabela de potes. Assim que ela for criada, esta tela passa a funcionar."
            : "Reserva de emergência, oportunidade, oportunidade do agro, IR a pagar e livre. Todo o saldo atual começa no livre."}
          acao={semTabela ? undefined : <Botao onPress={criar}>Criar os potes</Botao>} /></Lista>
      </Pagina>
    );
  }
  const r = potes.reserva;
  return (
    <Pagina>
      {cab}
      {r.meta != null ? (
        <Cartao>
          <T style={{ fontSize: 15, color: t.cores.ink2 }}>Reserva de emergência</T>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginVertical: 6, flexWrap: "wrap" }}>
            <Rs style={{ fontSize: 28, fontWeight: "600" }}>{FC.fmt.brlTexto(r.saldo)}</Rs>
            <T style={{ color: t.cores.ink2 }}>{`de ${FC.fmt.brlTexto(r.meta)}`}</T>
          </View>
          <Trilha pct={r.meta ? Math.min(100, (r.saldo / r.meta) * 100) : 0} cor={r.abaixo_da_meta ? "amarelo" : "verde"} />
          <T style={{ fontSize: 13, color: t.cores.ink2, marginTop: 8 }}>
            {r.abaixo_da_meta ? `Faltam ${FC.fmt.brlTexto(r.falta)}. A reserva é medida só por este pote.` : "Meta atingida."}
          </T>
        </Cartao>
      ) : <Mensagem>Informe seu custo de vida em Ajustes para medir a reserva de emergência.</Mensagem>}
      <Secao titulo="Saldo por pote" sub={`Total ${FC.fmt.brlTexto(potes.total)}`}>
        <Lista>
          {potes.potes.map((p: any) => (
            <Item key={p.id} titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <T style={{ fontWeight: "600", fontSize: 15 }}>{p.nome}</T>
              {p.comprometido ? <Pilula cor="vermelho">comprometido</Pilula> : null}
            </View>}
              detalhe={p.titulos.length ? p.titulos.map((x: any) => x.nome).join(", ") : p.valor_movimentos ? "saldo fora de títulos" : "vazio"}
              valores={<Rs style={{ fontWeight: "600", fontSize: 15 }}>{FC.fmt.brlTexto(p.saldo)}</Rs>} />
          ))}
        </Lista>
      </Secao>
      <Secao titulo="Mover entre potes"><Mover potes={potes} /></Secao>
    </Pagina>
  );
}
