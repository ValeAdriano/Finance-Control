# Changelog

Plano de evolução do Bullz, executado em 2026-11-18. Um commit por marco na `main`. Detalhes em `docs/progresso.md`; decisões em `docs/decisoes.md`.

## M15 · Documentação e encerramento
README, `docs/mcp.md` (gerado), este changelog, `docs/conteudo.md` e o resumo final em `docs/progresso.md`.

## M14 · Onboarding (`aec6a37`)
Onboarding em `/configurar` com 9 passos que gravam a configuração real, retomável; checklist "Complete a configuração" no Início; contas existentes veem só as novidades. Migration 0011.

## M13 · Home pública (`548edcc`)
Home estática em `/` (gerada no build a partir de `content/home.pt-BR.ts`): hero com mockups, tour com capítulos, pilares, blocos de funcionalidade, promessas e perguntas. Lighthouse celular 100/100/100/100. O app passou a `/app` no `vercel.json`.

## M12 · Vídeo do tour (`68f3a94`)
Tour de 41 s com 7 capítulos e legendas, gravado das telas reais da conta demo (`npm run video:render`); capítulos em `content/tour.ts`.

## M11 · Conta demo e capturas (`872cdb5`, `db3bb6f`)
Conta demo fictícia (`seed/demo`), `npm run seed:demo` idempotente, modo `?fixture=demo`, `npm run capturas` (36 WebP). Seções novas: projeção mês a mês, lotes do agro, a ordem certa e a tela de alertas.

## M10 · IR (`aadc17b`)
Apuração estimada de renda variável (isenções, day trade, compensação, DARF), IR rural do ano e relatório anual, tudo por `parametros_fiscais`. Ferramenta `apurar_ir`. Migration 0010.

## M9 · Alertas (`f63fc7b`)
Alertas de preço (acima, abaixo, empate), preço de empate nas posições, revisões programadas, notificações e o agendamento `fc-avalia-alertas`. Migration 0009.

## M8 · Plano mensal (`b313d3b`)
Plano por mês com snapshot, execução por destino, fora do plano, fechamento automático, reabertura com log, geração do mês seguinte e backfill. Linha do tempo na tela de Salário. Migration 0008.

## M7 · Projeções (`0ef013b`)
Projeção mês a mês por ativo com eventos e cenários; CDI/IPCA da série do Banco Central. Ferramentas `projetar`, `listar_eventos`, `registrar_evento`. Migration 0007.

## M6 · Hierarquia (`021b504`)
RF › Ações › Cripto com faixas, validação do plano, divisão sugerida, meses para corrigir e reserva dinâmica. Migration 0006.

## M5 · Renda PJ (`927bfa4`)
Ganho PJ (DAS/Simples), pagamento proporcional, despesas, custo de vida, plano fixo + sobra e aporte parcelado. Migration 0005.

## M4 · Agro por lote (`d485693`)
Ciclo por lote, permuta, venda planejada, estimativa manual e impostos rurais; tabela `parametros_fiscais`. Migration 0004.

## M3 · Movimento interno (`6459eea`)
Troca entre ativos, títulos e potes sem virar aporte nem mexer na TIR total. Migration 0003.

## M2 · Potes (`4081067`)
Renda fixa por finalidade; reserva medida pelo pote; IR a pagar comprometido. Migration 0002.

## M1 · Bugs de dados (`b3c5375`)
Custo dos lançamentos como fonte única, resultado coerente, Dietz sem percentual absurdo, cotação quebrada, plano e proventos como fontes únicas, fim do contrato separado do último pagamento, `auditar_dados`. Migration 0001.

## M0 · Linha de base (`5781dd2`)
Mapeamento, scripts de verificação e documentos de execução.
