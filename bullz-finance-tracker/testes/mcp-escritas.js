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
module.exports.registrar_evento = { data: "2027-02-15", tipo: "aporte_extra", valor: 1000 };
module.exports.LEITURAS.projetar = { meses: 3 };
Object.assign(module.exports, {
  gerar_plano_mensal: { mes: "2026-12" }, editar_plano_mensal: { mes: "2026-12", meta_total: 1 }, ativar_plano_mensal: { mes: "2026-12" },
  fechar_plano_mensal: { mes: "2026-12" }, reabrir_plano_mensal: { mes: "2026-12", motivo: "teste" }, reconstruir_planos_mensais: { meses: ["2026-10"] },
});
module.exports.LEITURAS.detalhar_plano_mensal = null;   // precisa de plano salvo: coberto em testes/plano-mensal-m8.test.js
