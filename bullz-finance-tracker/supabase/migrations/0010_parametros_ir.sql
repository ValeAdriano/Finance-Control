-- 0010 · Marco 10 · parâmetros de IR da renda variável (seed documentado em docs/parametros-fiscais.md)
-- Aditiva e idempotente. Também está no fim de supabase/schema.sql.
insert into public.parametros_fiscais (chave, valor, vigencia_inicio, fonte) values
  ('ir_acoes_isencao_vendas_mes', 20000, '2005-01-01', 'Lei 11.033/2004, art. 3º, I: vendas de ações no mercado à vista até R$ 20 mil no mês'),
  ('ir_acoes_aliquota', 15, '2005-01-01', 'Lei 11.033/2004, art. 2º: 15% sobre o ganho líquido (operações comuns)'),
  ('ir_etf_aliquota', 15, '2005-01-01', 'IN RFB 1.585/2015: ETF de renda variável, 15%, sem a isenção de R$ 20 mil'),
  ('ir_daytrade_aliquota', 20, '2005-01-01', 'Lei 8.981/1995 e Lei 11.033/2004: day trade, 20%'),
  ('ir_fii_aliquota', 20, '2005-01-01', 'Lei 8.668/1993, art. 18: ganho na venda de cotas de FII, 20%'),
  ('ir_cripto_isencao_vendas_mes', 35000, '2016-01-01', 'IN RFB 1.888/2019 e Lei 13.259/2016: alienações de até R$ 35 mil no mês'),
  ('ir_cripto_aliquota', 15, '2016-01-01', 'Lei 13.259/2016: 15% na primeira faixa (até R$ 5 milhões de ganho)'),
  ('darf_valor_minimo', 10, '2000-01-01', 'Lei 9.430/1996, art. 68: DARF abaixo de R$ 10 acumula para o período seguinte'),
  ('darf_codigo_renda_variavel', 6015, '2000-01-01', 'Código de receita 6015: ganhos líquidos em operações em bolsa (pessoa física)'),
  ('darf_codigo_cripto', 4600, '2016-01-01', 'Código de receita 4600: ganho de capital na alienação de bens e direitos')
on conflict (chave, vigencia_inicio) do nothing;
notify pgrst, 'reload schema';
