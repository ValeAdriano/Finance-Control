# Roteiros de comparação

Cada roteiro é escrito uma vez e roda em três lugares, sempre com a **conta demo** e as fixtures
de mercado do dia congelado:

- **site atual**: Playwright (referência)
- **app no web**: Playwright
- **app no iOS/Android**: Maestro

Em cada passo marcado com 📸 tira-se uma captura nos três; o resultado vai para a `PARIDADE.md`.
Roteiros que gravam dados desfazem o que criaram no fim.

| ID | Fase | Roteiro | Passos | Confere |
|---|---|---|---|---|
| R0 | F1 | Núcleo carregado | abrir o app em modo teste → ler `FC` | chaves de `FC` iguais às do site; snapshots de cálculo iguais |
| R1 | F2 | Entrar e sair | login com e-mail e senha 📸 → Início 📸 → Mais opções → sair 📸 | mesmas telas e mensagens; senha errada mostra o mesmo erro |
| R2 | F2 | Duas etapas | conta com TOTP → código errado 📸 → código certo → Início | mesma mensagem de erro e mesmo destino |
| R3 | F3 | Cadastrar ativo | Investimentos 📸 → Novo ativo (ITSA4, carteira, 10 × R$ 10) 📸 → lista 📸 → apagar | nota, veredito, posição e preço médio iguais |
| R4 | F3 | Aportar e ver no Início | Aportes → compra de MXRF11 📸 → Início: patrimônio e alocação 📸 → apagar aporte | patrimônio, "coloquei", alocação e preço médio iguais |
| R5 | F3 | Importar extrato | Aportes → Importar → extrato de exemplo 📸 → confirmar → histórico 📸 → apagar importados | mesmos lançamentos, nenhum duplicado ao repetir |
| R6 | F4 | Salário e guia do mês | Salário → novo ganho 📸 → plano 30% → guia do mês 📸 → apagar | meta do mês e sequência iguais |
| R7 | F4 | Agro | Agro → nova compra de gado 📸 → resultado e rebanho 📸 → apagar | cabeças, valor do rebanho e resultado iguais |
| R8 | F4 | Imposto de renda e dividendos | IRPF 📸 → Dividendos 📸 | valores e listas iguais |
| R9 | F4 | Ajustes | ligar/desligar módulo (aba some do menu) 📸 → metas 📸 → baixar backup | menu, metas e conteúdo do backup iguais |
| R10 | F5 | Perfil do investidor | convite 📸 → questionário inteiro 📸 por bloco → resultado 📸 → aplicar plano (antes/depois) 📸 → relatório 📸 | perfil, eixos, plano e metas gravadas iguais |
| R11 | F5 | Layout | Ajustes → Layout → arrastar "Alocação" para o topo 📸 → ocultar "Agro" → menu: mover "Salário" para a barra 📸 → padrão | ordem salva em `preferencias.layout` igual; Início e barra iguais |
| R12 | F6 | Retrospectiva | Ajustes → Retrospectiva do mês 📸 → tocar para avançar 📸 | mesmas etapas e números |
| R13 | F2–F7 | Estados visuais | cada tela da matriz em celular/desktop, claro/escuro, modo privado, carregando, erro de cotações 📸 | diff de imagem dentro do limiar |
