/* Marco 14 — onboarding retomável e checklist.  node --test testes/configuracao-m14.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const { carregaNucleo } = require("./nucleo.js");

const vazia = () => ({ ativos: [], rendaFixa: [], aportes: [], ganhos: [], potes: [], planosMensais: [], alertasPreco: [], agroLotes: [], prefsBrutas: {} });

test("M14 · conta nova passa pelo onboarding; pular e voltar retoma no mesmo passo", () => {
  const { FC } = carregaNucleo();
  const C = FC.configuracao;
  let e = C.normaliza(null, vazia());
  assert.equal(C.precisaOnboarding(e), true);
  e = C.avanca(e, "boas_vindas", "feito");
  e = C.avanca(e, "perfil", "pulado");
  e = C.avanca(e, "renda", "pulado");
  assert.equal(e.passo_atual, "reserva");
  // o estado salvo volta igual (sair no passo 4 e voltar)
  const volta = C.normaliza(JSON.parse(JSON.stringify(e)), vazia());
  assert.equal(volta.passo_atual, "reserva");
  assert.equal(C.precisaOnboarding(volta), true);
  for (const id of ["reserva", "divisao", "contas", "agro", "plano", "alertas"]) e = C.avanca(e, id, "pulado");
  assert.equal(e.concluido, true);
  assert.equal(C.precisaOnboarding(e), false);
  const ck = C.checklist(e, vazia(), {});
  assert.deepEqual(JSON.parse(JSON.stringify(ck.itens.map((x) => x.id))), ["perfil", "renda", "reserva", "divisao", "contas", "agro", "plano", "alertas"]);
});

test("M14 · conta que já existia não vê o onboarding, só o checklist das novidades", () => {
  const { FC } = carregaNucleo();
  const C = FC.configuracao;
  const base = { ...vazia(), ativos: [{ ticker: "ITSA4" }], ganhos: [{ nome: "Salário" }] };
  const e = C.normaliza(null, base);
  assert.equal(e.existente, true);
  assert.equal(C.precisaOnboarding(e), false);
  const ck = C.checklist(e, base, {});
  assert.deepEqual(JSON.parse(JSON.stringify(ck.itens.map((x) => x.titulo))), ["Potes com finalidade", "Hierarquia RF › Ações › Cripto", "Plano mensal", "Agro por lote", "Alertas de empate"]);
  // o item sai do checklist pelo dado, ou quando a pessoa dispensa
  const comPotes = { ...base, potes: [{ id: 1 }], prefsBrutas: { premissas: { objetivos: { custo_vida_mensal: 3000 } }, hierarquia: { modo_alocacao: "hierarquia" } } };
  const ck2 = C.checklist(C.dispensa(e, "agro"), comPotes, {});
  assert.deepEqual(JSON.parse(JSON.stringify(ck2.itens.map((x) => x.id))), ["plano", "alertas"]);
});
