/* Gera docs/mcp.md a partir de supabase/functions/mcp/ferramentas.mjs:
 * cada ferramenta com descrição, parâmetros (do schema zod) e se é nova no
 * plano de evolução.   node scripts/gera-doc-mcp.mjs */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { z } = createRequire(import.meta.url)("zod");
const { ferramentas } = await import(path.join(RAIZ, "supabase", "functions", "mcp", "ferramentas.mjs"));
const ORIGINAIS = new Set(["resumo_patrimonio", "listar_posicoes", "detalhar_ativo", "listar_lancamentos", "listar_renda_fixa", "rentabilidade", "dividendos", "agro_resumo",
  "agro_lancamentos", "salario_e_plano", "historico_patrimonio", "preferencias", "registrar_lancamento", "salvar_ativo", "salvar_titulo", "salvar_ganho", "registrar_agro",
  "atualizar_metas", "editar_registro", "apagar_registro"]);
const EXEMPLOS = {
  auditar_dados: "{}",
  mover_entre_potes: '{ "de": "livre", "para": "reserva_emergencia", "valor": 1000, "simular": true }',
  registrar_movimento_interno: '{ "origem_tipo": "ativo", "origem_id": "BTC", "origem_quantidade": 0.005, "destino_tipo": "titulo_rf", "destino_id": "Tesouro Selic 2029", "custos": { "taxa": 20 }, "simular": true }',
  simular_realocacao: '{ "origem_tipo": "ativo", "origem_id": "ETH", "origem_quantidade": 0.2, "destino_tipo": "pote", "destino_id": "oportunidade" }',
  registrar_agro: '{ "especie": "movimento", "tipo": "troca", "categoria": "boi_magro", "categoria_destino": "bezerro", "cabecas_saida": 3, "cabecas_entrada": 6, "valor_referencia_saida": 18000, "valor_referencia_entrada": 18000 }',
  planejar_venda_agro: '{ "lote": "Lote Primavera", "data_prevista": "2027-02-15", "preco_esperado_cabeca": 6000, "destino_planejado": "oportunidade_agro", "simular": true }',
  registrar_despesa: '{ "categoria": "moradia", "valor": 3000, "recorrente": true }',
  registrar_parcelamento: '{ "valor_total": 6000, "n_parcelas": 6, "inicio": "2027-01-01", "destino_tipo": "titulo_rf", "destino_id": "Tesouro Selic 2029", "pote": "oportunidade", "simular": true }',
  configurar_alocacao: '{ "modo_alocacao": "hierarquia", "simular": true }',
  projetar: '{ "meses": 12, "cenario": "estresse", "eventos": [{ "data": "2027-02-15", "tipo": "venda_agro", "valor": 36000, "cabecas": 6 }] }',
  registrar_evento: '{ "data": "2027-03-10", "tipo": "aporte_extra", "valor": 5000, "simular": true }',
  gerar_plano_mensal: '{ "mes": "2026-12", "simular": true }',
  ativar_plano_mensal: '{ "mes": "2026-12", "aceitar_violacao": false }',
  reabrir_plano_mensal: '{ "mes": "2026-11", "motivo": "lançamento esquecido" }',
  reconstruir_planos_mensais: '{ "meses": ["2026-10", "2026-11"], "simular": true }',
  criar_alerta_preco: '{ "ticker": "ETH", "condicao": "empate" }',
  criar_revisao: '{ "ticker": "ETH", "data": "2027-03-01", "pergunta": "A tese ainda vale?" }',
  apurar_ir: '{ "ano": 2026, "relatorio": true }',
};
const tipo = (s) => s.enum ? s.enum.map((x) => `\`${x}\``).join(" \\| ") : s.type === "array" ? `lista de ${s.items ? tipo(s.items) : "itens"}` : s.anyOf ? s.anyOf.map(tipo).join(" ou ") : s.type || "objeto";
const linhas = ["# Ferramentas MCP do Bullz", "",
  "Gerado por `node scripts/gera-doc-mcp.mjs` a partir de `supabase/functions/mcp/ferramentas.mjs`. Não edite à mão.", "",
  "Servidor: Edge Function `mcp` (ver `nucleo/README.md`, seção Conexão com IA). Valores em reais, datas AAAA-MM-DD, percentuais em %.", "",
  "- **🆕** = nova no plano de evolução (M1 a M14). As 20 originais mantêm nome e tipo dos campos; só ganharam campos.",
  "- Toda ferramenta nova de gravação aceita `simular: true`, que devolve o efeito sem gravar.",
  "- Ferramentas que gravam exigem a conexão com permissão de edição.", ""];
const lista = ferramentas(z);
linhas.push("| ferramenta | tipo | |", "|---|---|---|");
for (const f of lista) linhas.push(`| [\`${f.nome}\`](#${f.nome}) | ${f.escreve ? (f.destrutiva ? "grava (apaga)" : "grava") : "lê"} | ${ORIGINAIS.has(f.nome) ? "" : "🆕"} |`);
linhas.push("");
for (const f of lista) {
  linhas.push(`## ${f.nome}${ORIGINAIS.has(f.nome) ? "" : " 🆕"}`, "", `**${f.titulo}** · ${f.escreve ? "grava" : "só leitura"}`, "", f.descricao, "");
  const js = z.toJSONSchema(z.object(f.entrada()), { io: "input" });
  const props = Object.entries(js.properties || {});
  if (props.length) {
    linhas.push("| parâmetro | tipo | obrigatório | descrição |", "|---|---|---|---|");
    for (const [k, s] of props) linhas.push(`| \`${k}\` | ${tipo(s)} | ${(js.required || []).includes(k) && s.default === undefined ? "sim" : ""} | ${(s.description || (s.default !== undefined ? `padrão: ${JSON.stringify(s.default)}` : "")).replace(/\|/g, "\\|")} |`);
    linhas.push("");
  }
  if (EXEMPLOS[f.nome]) linhas.push("Exemplo:", "", "```json", EXEMPLOS[f.nome], "```", "");
}
fs.writeFileSync(path.join(RAIZ, "docs", "mcp.md"), linhas.join("\n"));
console.log(`docs/mcp.md: ${lista.length} ferramentas (${lista.filter((f) => !ORIGINAIS.has(f.nome)).length} novas)`);
