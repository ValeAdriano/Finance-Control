/* Argumentos de exemplo das ferramentas de gravação novas (plano de
 * evolução), para o teste "conexão só de consulta não grava nada". */
module.exports = {
  mover_entre_potes: { de: "livre", para: "oportunidade", valor: 1 },
};
module.exports.registrar_movimento_interno = { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.001, destino_tipo: "titulo_rf", destino_id: "LCI Banco Demo" };
// leituras novas que precisam de argumento (teste de arredondamento)
Object.defineProperty(module.exports, "LEITURAS", { enumerable: false, value: {
  simular_realocacao: { origem_tipo: "ativo", origem_id: "BTC", origem_quantidade: 0.001, destino_tipo: "titulo_rf", destino_id: "LCI Banco Demo" },
} });
module.exports.planejar_venda_agro = { lote: "L1", preco_esperado_cabeca: 6000 };
module.exports.registrar_despesa = { categoria: "moradia", valor: 100 };
module.exports.registrar_parcelamento = { valor_total: 600, n_parcelas: 3, inicio: "2026-12-01", destino_tipo: "titulo_rf", destino_id: "LCI Banco Demo", pote: "livre" };
module.exports.configurar_alocacao = { modo_alocacao: "hierarquia" };
