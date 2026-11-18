/* Alertas de preço, preço de empate e revisões programadas (Marco 9).
 *
 * Alerta: { ticker, condicao: acima | abaixo | empate, valor, ligado, ultimo_disparo }.
 * "empate" usa o preço médio atual da posição: dispara quando o preço chega
 * ao preço médio (preço ≥ preço médio), o ponto em que a posição deixa de
 * estar no prejuízo. Comparação em centavos, para 4.313,00 disparar e
 * 4.312,99 não.
 *
 * Revisão: { ticker | tema, data, pergunta, feita }. Aparece nos alertas do
 * resumo a partir da data, até ser marcada como feita.
 *
 * O mesmo cálculo roda no app, no MCP e (em SQL, pelo agendamento
 * fc-avalia-alertas) no banco, que grava a notificação in-app. */
(function () {
  const FC = window.FC;
  const cent = (v) => Math.round(Number(v) * 100);

  /** preço de empate e quanto falta subir, por posição */
  function empate(posicao, preco) {
    if (!posicao || !(posicao.preco_medio > 0)) return { preco_empate: null, alta_necessaria_pct: null };
    const pe = posicao.preco_medio;
    return { preco_empate: pe, alta_necessaria_pct: preco > 0 && preco < pe ? (pe / preco - 1) * 100 : 0 };
  }

  /** o alerta dispara com este preço? (e qual o alvo) */
  function dispara(alerta, preco, precoMedio) {
    if (!(Number(preco) > 0)) return { dispara: false, alvo: null, motivo: "sem cotação" };
    const alvo = alerta.condicao === "empate" ? precoMedio : Number(alerta.valor);
    if (!(alvo > 0)) return { dispara: false, alvo: null, motivo: alerta.condicao === "empate" ? "sem preço médio" : "sem valor" };
    const p = cent(preco), a = cent(alvo);
    const ok = alerta.condicao === "abaixo" ? p <= a : p >= a;   // acima e empate: chegou ao alvo
    return { dispara: ok, alvo };
  }

  /** avalia os alertas ligados contra as posições de hoje */
  function avalia(alertas, dados) {
    const saida = [];
    for (const al of alertas || []) {
      if (al.ligado === false) continue;
      const a = (dados.ativos || []).find((x) => x.ticker === al.ticker);
      if (!a || a.cotacao_quebrada) { saida.push({ alerta: al, dispara: false, motivo: a ? "cotação quebrada" : "ativo fora da carteira" }); continue; }
      const pm = a.posicao ? a.posicao.preco_medio : null;
      const r = dispara(al, a.preco, pm);
      saida.push({ alerta: al, ticker: al.ticker, preco: a.preco, ...r });
    }
    return saida;
  }

  /** texto do aviso de um disparo */
  function texto(d) {
    const brl = (v) => FC.fmt.brlTexto(v);
    const al = d.alerta;
    if (al.condicao === "empate") return { titulo: `${al.ticker} voltou ao preço médio`, texto: `Cotação ${brl(d.preco)}, preço médio ${brl(d.alvo)}: a posição saiu do prejuízo.` };
    return { titulo: `${al.ticker} ${al.condicao === "acima" ? "passou de" : "caiu abaixo de"} ${brl(d.alvo)}`, texto: `Cotação de agora: ${brl(d.preco)}.` };
  }

  /** revisões vencidas (a partir da data, até feita) */
  function revisoesDoDia(revisoes, hoje = FC.datas.hoje()) {
    return (revisoes || []).filter((r) => !r.feita && r.data <= hoje).sort((a, b) => a.data.localeCompare(b.data));
  }

  /** sugestão de alertas de empate para as posições no prejuízo (onboarding, Marco 14) */
  function sugereEmpates(dados, alertas = []) {
    const tem = new Set((alertas || []).filter((a) => a.condicao === "empate").map((a) => a.ticker));
    return (dados.ativos || []).filter((a) => a.posicao && a.posicao.preco_medio > 0 && a.preco > 0 && a.preco < a.posicao.preco_medio && !tem.has(a.ticker))
      .map((a) => ({ ticker: a.ticker, condicao: "empate", preco: a.preco, preco_medio: a.posicao.preco_medio, alta_necessaria_pct: (a.posicao.preco_medio / a.preco - 1) * 100 }));
  }

  FC.alertasPreco = { empate, dispara, avalia, texto, revisoesDoDia, sugereEmpates };
})();
