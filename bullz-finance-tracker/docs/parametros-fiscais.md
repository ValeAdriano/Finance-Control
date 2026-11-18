# Parâmetros fiscais

Tabela `parametros_fiscais` (migration 0004 em diante): `chave`, `valor`, `vigencia_inicio`, `vigencia_fim`, `fonte`. O cálculo pega a linha cuja vigência cobre a data da operação (a de início mais recente). Mudou a lei? Insira uma linha nova com a vigência nova e feche a anterior com `vigencia_fim`. Nenhum código muda.

Sem o parâmetro no banco, o imposto sai `null` com o motivo. O Bullz nunca inventa uma alíquota.

## Seed inicial

| chave | valor | vigência | fonte |
|---|---|---|---|
| `funrural_pf_aliquota` | 1,5 (%) | 2018-01-01 → | Lei 13.606/2018: 1,2% previdência + 0,1% RAT + 0,2% SENAR, produtor pessoa física |
| `ir_rural_presuncao_pct` | 20 (%) | 1990-01-01 → | Lei 8.023/1990, art. 5º |
| `ir_rural_aliquota_padrao` | 27,5 (%) | 2015-04-01 → | teto da tabela do IRPF; estimativa conservadora (a pessoa ajusta em `preferencias.agro.ir_aliquota`) |

### Renda PJ (migration 0005)

| chave | valor | vigência | fonte |
|---|---|---|---|
| `das_mei_servicos` | 80,90 | 2025-01-01 → 2025-12-31 | 5% do salário mínimo de R$ 1.518 + R$ 5 de ISS |
| `das_mei_servicos` | 86,05 | 2026-01-01 → | 5% do salário mínimo de R$ 1.621 + R$ 5 de ISS |
| `simples_aliquota_inicial` | 6 (%) | 2018-01-01 → | LC 123/2006 (LC 155/2016), Anexo III, 1ª faixa |

### Renda variável (migration 0010)

| chave | valor | fonte |
|---|---|---|
| `ir_acoes_isencao_vendas_mes` | 20.000 | Lei 11.033/2004, art. 3º, I |
| `ir_acoes_aliquota` | 15 (%) | Lei 11.033/2004, art. 2º |
| `ir_etf_aliquota` | 15 (%) | IN RFB 1.585/2015 (sem a isenção) |
| `ir_daytrade_aliquota` | 20 (%) | Lei 8.981/1995 |
| `ir_fii_aliquota` | 20 (%) | Lei 8.668/1993, art. 18 |
| `ir_cripto_isencao_vendas_mes` | 35.000 | Lei 13.259/2016 e IN RFB 1.888/2019 |
| `ir_cripto_aliquota` | 15 (%) | Lei 13.259/2016, 1ª faixa |
| `darf_valor_minimo` | 10 | Lei 9.430/1996, art. 68 |
| `darf_codigo_renda_variavel` | 6015 | código de receita |
| `darf_codigo_cripto` | 4600 | código de receita |

Sem a tabela no banco (antes da migration 0004), o módulo de IR usa os valores que o app já trazia e responde `parametros_embutidos: true`. Com a tabela, valem só os parâmetros dela.
