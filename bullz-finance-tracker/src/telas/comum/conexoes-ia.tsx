/* Ajustes → Segurança → Conexões com IA: os assistentes (Claude, ChatGPT…)
 * autorizados a entrar na conta pelo MCP, o alcance de cada um e a saída.
 *
 * A lista vem do Supabase Auth (quem tem autorização OAuth) cruzada com a
 * tabela mcp_acessos (o que o banco deixa cada um fazer). Mudar o alcance ou
 * desconectar vale na hora: a regra é conferida a cada consulta do cliente. */
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTema } from "../../tema";
import { Botao, Detalhes, Item, Lista, Roda, Secao, T } from "../../ui/kit";
import { Interruptor } from "../../ui/campos";
import { Icone } from "../../ui/icone";
import { ui } from "../../ui/folha";
import FC from "../../nucleo";

interface Conexao { id: string; nome: string; site: string; desde: string; com_dados: boolean; escrita: boolean; orfa?: boolean }

export function ConexoesIA() {
  const t = useTema();
  const [lista, setLista] = useState<Conexao[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  const carrega = useCallback(() => {
    FC.mcp.lista().then((l: Conexao[]) => { setLista(l); setFalhou(false); }).catch(() => { setLista([]); setFalhou(true); });
  }, []);
  useEffect(carrega, [carrega]);

  const mudaEscrita = async (c: Conexao, v: boolean) => {
    if (v && !(await ui.confirma(`Deixar ${c.nome} registrar, corrigir e apagar lançamentos na sua conta?`, { titulo: "Permitir edição", botao: "Permitir" }))) return;
    try {
      await FC.mcp.mudaEscrita(c.id, v);
      FC.db.log("seguranca", { acao: v ? "conexão com IA: edição liberada" : "conexão com IA: só consulta", cliente: c.nome });
      carrega();
    } catch (err) { ui.erro(err); }
  };
  const remove = async (c: Conexao) => {
    if (!(await ui.confirma(`Desconectar ${c.nome}? Ele para de ler seus dados na hora. Para voltar, é só conectar de novo pelo assistente.`, { titulo: "Desconectar", botao: "Desconectar", perigo: true }))) return;
    try {
      await FC.mcp.revoga(c.id);
      FC.db.log("seguranca", { acao: "conexão com IA removida", cliente: c.nome });
      ui.aviso(`${c.nome} desconectado`);
      carrega();
    } catch (err) { ui.erro(err); }
  };
  const copia = async () => { await Clipboard.setStringAsync(FC.mcp.url); ui.aviso("Endereço copiado"); };

  return (
    <Secao titulo="Conexões com IA">
      <Lista>
        <Item esquerda={<Icone nome="compartilhar" tam={20} cor={t.cores.ink2} />} detalheLinhas={4}
          titulo="Conectar um assistente"
          detalhe="Adicione o Bullz como conector no Claude, no ChatGPT ou em outro assistente compatível com MCP, usando o endereço abaixo. Ele abre esta conta para você autorizar."
          direita={<Botao variante="sec" pequeno onPress={copia}>Copiar endereço</Botao>} />
        {lista === null ? (
          <View style={{ padding: t.espaco.e4, alignItems: "center" }}><Roda tam={20} /></View>
        ) : lista.map((c) => (
          <Item key={c.id} esquerda={<Icone nome={c.com_dados && !c.orfa ? "escudo" : "alerta"} tam={20} cor={c.com_dados && !c.orfa ? (c.escrita ? t.cores.amarelo : t.cores.verde) : t.cores.ink3} />}
            detalheLinhas={3} titulo={<T style={{ fontWeight: "600", fontSize: 15 }}>{c.nome}</T>}
            detalhe={`${c.orfa ? "autorização encerrada" : !c.com_dados ? "conectado, mas sem acesso aos dados" : c.escrita ? "consulta e edita" : "só consulta"}${c.desde ? " · desde " + FC.datas.br(String(c.desde).slice(0, 10)) : ""}`}
            direita={<Botao variante="texto" pequeno onPress={() => remove(c)}><Text style={{ color: t.cores.vermelho, fontSize: 13.5, fontWeight: "500" }}>Desconectar</Text></Botao>}>
            {c.com_dados && !c.orfa ? (
              <View style={{ marginTop: 10 }}>
                <Interruptor valor={c.escrita} aoMudar={(v) => mudaEscrita(c, v)} rotulo="Pode editar (registrar, corrigir e apagar)" />
              </View>
            ) : null}
          </Item>
        ))}
        {lista && !lista.length ? (
          <Item esquerda={<Icone nome="info" tam={20} cor={t.cores.ink3} />} titulo={<T style={{ fontSize: 14.5, color: t.cores.ink2 }}>{falhou ? "Não foi possível carregar as conexões agora." : "Nenhum assistente conectado."}</T>} />
        ) : null}
      </Lista>
      <Detalhes rotulo="Como a conexão é protegida">
        <View style={{ gap: 4 }}>
          {[`Endereço do conector: ${FC.mcp.url}`,
            "O assistente entra com um login próprio (OAuth), que você aprova aqui, depois da senha e do 2FA. Ele nunca vê sua senha.",
            "O alcance é aplicado pelo banco, não pelo assistente: sem a sua autorização ele não lê nada, e em \"só consulta\" nenhuma gravação passa, por nenhum caminho.",
            "Ele não troca senha, não mexe no 2FA, não apaga a conta e não enxerga o seu perfil de investidor.",
            "Tudo o que um assistente grava aparece em Ajustes → Dados → Log do sistema, com o nome dele.",
            "O que o assistente lê sai do Bullz e passa a valer a política de privacidade dele."].map((x, i) => <T key={i} v="p" style={{ lineHeight: 23 }}>•  {x}</T>)}
        </View>
      </Detalhes>
    </Secao>
  );
}
