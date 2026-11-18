/* Alertas (Marco 9): alertas de preço com o preço de empate, revisões
 * programadas e os avisos da carteira. */
import React from "react";
import { View } from "react-native";
import { useTema } from "../tema";
import { useEstado } from "../estado/app";
import { Pagina } from "../casca/casca";
import { Cabecalho, Item, Lista, Pilula, Rs, Secao, T, Vazio } from "../ui/kit";
import FC from "../nucleo";

const NIVEL: Record<string, string> = { alto: "vermelho", medio: "amarelo", info: "azul" };

export default function Alertas() {
  const t = useTema();
  const e = useEstado();
  if (!e.dados || !e.base) return <Pagina>{null}</Pagina>;
  const avisos = FC.alertas.calcula(e.dados, e.base, e.prefs);
  const precos = FC.alertasPreco.avalia(e.base.alertasPreco || [], e.dados);
  const revisoes = (e.base.revisoes || []).filter((r: any) => !r.feita).sort((a: any, b: any) => a.data.localeCompare(b.data));
  const hoje = FC.datas.hoje();
  return (
    <Pagina>
      <Cabecalho titulo="Alertas" sub="Avisa na hora: preço, empate com o preço médio e as revisões que você marcou." />
      <Secao titulo="Alertas de preço">
        {precos.length ? (
          <Lista>
            {precos.map((x: any, i: number) => (
              <Item key={i}
                titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <T style={{ fontWeight: "600", fontSize: 15 }}>{x.alerta.ticker}</T>
                  <Pilula cor={x.dispara ? "verde" : "cinza"}>{x.dispara ? "disparou" : x.alerta.condicao === "empate" ? "empate" : x.alerta.condicao}</Pilula>
                </View>}
                detalhe={x.alerta.condicao === "empate" ? `avisa quando voltar ao preço médio${x.alvo ? " de " + FC.fmt.brlTexto(x.alvo) : ""}` : `avisa ${x.alerta.condicao} de ${FC.fmt.brlTexto(x.alvo)}`}
                valores={<View style={{ alignItems: "flex-end" }}>
                  <Rs style={{ fontWeight: "600" }}>{x.preco ? FC.fmt.brlTexto(x.preco) : "—"}</Rs>
                  {x.alvo && x.preco && x.preco < x.alvo ? <T style={{ fontSize: 12.5, color: t.cores.ink2 }}>{`falta subir ${FC.fmt.num((x.alvo / x.preco - 1) * 100, 1)}%`}</T> : null}
                </View>} />
            ))}
          </Lista>
        ) : <Lista><Vazio icone="🔔" titulo="Nenhum alerta de preço" texto="Crie um alerta de empate para as posições no prejuízo: o Bullz avisa quando o preço voltar ao seu preço médio." /></Lista>}
      </Secao>
      <Secao titulo="Revisões programadas">
        <Lista>
          {revisoes.length ? revisoes.map((r: any) => (
            <Item key={r.id} titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <T style={{ fontWeight: "600", fontSize: 15 }}>{r.ticker || r.tema}</T>{r.data <= hoje ? <Pilula cor="amarelo">hoje</Pilula> : <Pilula cor="cinza" semPonto>{FC.datas.br(r.data)}</Pilula>}</View>}
              detalhe={r.pergunta} />
          )) : <Vazio icone="🗓️" titulo="Nenhuma revisão marcada" />}
        </Lista>
      </Secao>
      <Secao titulo="Avisos da carteira">
        <Lista>
          {avisos.map((a: any, i: number) => <Item key={i} titulo={<View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}><Pilula cor={NIVEL[a.nivel] || "cinza"}>{a.nivel}</Pilula><T style={{ fontWeight: "600" }}>{a.titulo}</T></View>} detalhe={a.texto} detalheLinhas={3} />)}
        </Lista>
      </Secao>
    </Pagina>
  );
}
