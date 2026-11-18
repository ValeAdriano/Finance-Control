# Parâmetros fiscais

Tabela `parametros_fiscais` (migration 0004 em diante): `chave`, `valor`, `vigencia_inicio`, `vigencia_fim`, `fonte`. O cálculo pega a linha cuja vigência cobre a data da operação (a de início mais recente). Mudou a lei? Insira uma linha nova com a vigência nova e feche a anterior com `vigencia_fim`. Nenhum código muda.

Sem o parâmetro no banco, o imposto sai `null` com o motivo. O Bullz nunca inventa uma alíquota.

## Seed inicial

| chave | valor | vigência | fonte |
|---|---|---|---|
| `funrural_pf_aliquota` | 1,5 (%) | 2018-01-01 → | Lei 13.606/2018: 1,2% previdência + 0,1% RAT + 0,2% SENAR, produtor pessoa física |
| `ir_rural_presuncao_pct` | 20 (%) | 1990-01-01 → | Lei 8.023/1990, art. 5º |
| `ir_rural_aliquota_padrao` | 27,5 (%) | 2015-04-01 → | teto da tabela do IRPF; estimativa conservadora (a pessoa ajusta em `preferencias.agro.ir_aliquota`) |

Os marcos seguintes acrescentam as chaves de DAS/MEI (M5) e de ganho de capital (M10). Esta tabela é atualizada a cada seed novo.
