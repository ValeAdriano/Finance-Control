# Plano de segurança

Fecha as lacunas levantadas em 2026-10-14 e adiciona **criptografia de ponta a ponta** dos dados
financeiros: só o aparelho de quem é dono da conta consegue ler carteira, aportes, renda fixa,
agro, salário, metas e perfil. O Supabase (e quem administra o projeto) guarda apenas dados
cifrados.

| # | Fase | Resolve | Depende de |
|---|---|---|---|
| S1 | Endurecimento rápido | sessão sem criptografia no celular, bloqueio do app, limite de tentativas por IP, painel do Supabase | — |
| S2 | E-mail: confirmação e "esqueci a senha" | contas com e-mail alheio, recuperação de acesso | e-mail do Supabase (ver limites) |
| S3 | Recuperação do 2FA | quem perde o autenticador | S2 |
| S4 | Criptografia de ponta a ponta | servidor lê os dados financeiros | S2, S3 |
| S5 | Auditoria e testes de segurança | provar que tudo acima funciona | contínuo |

---

## S1 · Endurecimento rápido (1–2 dias)

### S1.1 Sessão cifrada no celular
Hoje o token do Supabase fica no MMKV sem criptografia (protegido só pelo isolamento do sistema).

- Gerar uma chave aleatória de 256 bits no primeiro uso e guardá-la no **`expo-secure-store`**
  (Android Keystore / iOS Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Abrir o MMKV com `encryptionKey` = essa chave. Tudo o que hoje vai para o MMKV (sessão, cache
  da base, preferências locais) passa a ficar cifrado em disco.
- Migração: na primeira abertura, ler o MMKV antigo, regravar no cifrado e apagar o antigo.
- Por que não guardar a sessão direto no SecureStore: há limite de tamanho por valor em algumas
  versões do Android, e a sessão do Supabase pode passar dele.

### S1.2 Bloqueio do app (biometria ou PIN)
- `expo-local-authentication`: ao abrir e ao voltar para o app depois de N minutos em segundo
  plano (padrão 5), pedir Face ID / digital / PIN do aparelho.
- Ajustes → Segurança: ligar/desligar e escolher o tempo. Sem biometria cadastrada no aparelho,
  a opção aparece desativada com a explicação.
- Na troca de app, a tela fica coberta (prévia do multitarefa não mostra valores).

### S1.3 Limite de tentativas por IP (sem CAPTCHA)

**Por que precisamos fazer o nosso:** no Supabase, o login por senha (`/auth/v1/token`) só tem o
limite por IP de 1.800 requisições/hora, compartilhado com a renovação de sessão — frouxo demais
contra força bruta. O gancho que barraria tentativas de senha (*Password Verification Attempt
Hook*) só existe nos planos Teams e Enterprise, e mesmo ele não recebe o IP.

**Desenho:** uma Edge Function `acesso` passa a intermediar as ações sensíveis do app:

| ação | o que a função faz |
|---|---|
| `entrar` (e-mail + senha) | confere os contadores, chama o Auth do Supabase do lado do servidor e devolve a sessão |
| `pedir_codigo` (cadastro, senha) | confere os contadores e dispara o e-mail |
| `confirmar_codigo` | confere os contadores e chama `verify` |

- **Contadores** numa tabela no schema `privado` (fora da API): `ip_hash`, `email_hash`, `acao`,
  `quando`, `ok`. IP e e-mail guardados só como HMAC com um segredo da função — dá para contar
  sem guardar o dado pessoal (LGPD). Limpeza automática depois de 24 h (`pg_cron`).
- **Regras** (ajustáveis):
  - por IP: 5 falhas em 15 min → bloqueio de 15 min; 20 falhas em 24 h → bloqueio de 24 h;
  - por conta (e-mail): 10 falhas em 1 h → bloqueio de 1 h, valendo para qualquer IP (pega
    ataque distribuído contra uma conta só);
  - pedidos de código: no máximo 3 por e-mail a cada 15 min e 10 por IP por hora.
- O IP vem do cabeçalho que a infraestrutura do Supabase repassa à função (`x-forwarded-for`,
  primeiro valor).
- Resposta do bloqueio: HTTP 429 com "Muitas tentativas. Tente de novo em N min." — a mesma
  mensagem para conta existente ou não.
- **No app:** espera crescente entre erros (1 s, 2 s, 4 s… até 30 s), contador visível e botão
  desabilitado durante a espera.
- **Nativos do Supabase** que continuam valendo por IP: verificação de código (360/h), desafio e
  verificação do 2FA (15/min). Revisar em *Authentication → Rate Limits*.

**Limite, dito com honestidade:** quem chamar a API do Supabase direto, por fora do app, ainda
encontra só o limite padrão do Supabase — não há como fechar o endpoint de login em Free/Pro. A
defesa de verdade contra senha adivinhada é a combinação **senha forte + checagem de vazada +
2FA**: com 2FA ligado, acertar a senha não abre nenhum dado (o banco exige o código). Se um dia
o projeto for para o plano Teams, o gancho de senha completa a proteção por conta.

### S1.4 Painel do Supabase (checklist — você executa)
- [ ] *Authentication → Password security*: tamanho mínimo 10, exigir maiúscula/minúscula/número
      (igual ao app) e **Leaked password protection** (HaveIBeenPwned do próprio Supabase; plano Pro).
- [ ] *Advisors → Security Advisor*: zerar os avisos (RLS, funções `security definer`, extensões).
- [ ] Conferir que os jobs `fc-limpa-uso` e (até a S4) `fc-registro-diario` existem em
      `cron.job` e que o segredo `fc_cron_secret` está no Vault.
- [ ] *Auth → Sessions*: tempo de vida do refresh token e "single session" se quiser.
- [ ] Chave `service_role` só na Edge Function (nunca no app, no site ou no git) — rotacionar se
      já tiver sido exposta em algum momento.
- [ ] *Authentication → URL Configuration*: só o domínio de produção e `bullz://` na lista.

**Pronto quando:** sessão ilegível copiando os arquivos do app; app pede biometria ao voltar;
6ª senha errada seguida do mesmo IP recebe 429 por 15 min; Security Advisor limpo.

---

## S2 · Confirmação de e-mail e "esqueci a senha" (2–3 dias)

O plano detalhado já foi aprovado em conversa; resumo:

- **Código de 6 dígitos por e-mail** (`verifyOtp`), não link: funciona igual na web, Android e
  iOS, sem deep link, e em qualquer aparelho.
- **Envio pelo e-mail do próprio Supabase** (decisão de 2026-10-14). Limites desse serviço,
  conforme a documentação:
  - **só entrega para endereços da equipe do projeto** (Organization → Team) — qualquer outra
    pessoa simplesmente não recebe;
  - poucas mensagens por hora no total e sem garantia de entrega (não é feito para produção).

  Consequência prática: **não ligar *Confirm email* enquanto houver usuários fora da equipe** —
  eles criariam a conta e nunca receberiam o código. O "esqueci a senha" funciona para quem está
  na equipe; para os demais o app mostra o aviso neutro, mas o e-mail não chega.
  Não adicionar usuários comuns à equipe para contornar isso: membro da equipe tem acesso ao
  painel do Supabase.
  **Trocar depois para um SMTP próprio não exige mudança no app** — é só configuração no painel
  (*Authentication → Emails → SMTP Settings*), e aí os limites somem. Está no **Backlog** (fim
  deste arquivo).
- **Enquanto não houver SMTP próprio:** as telas e os fluxos são implementados e publicados, mas
  *Confirm email* **fica desligado**. "Esqueci a senha" já funciona para quem está na equipe do
  projeto. Ligar a confirmação é o primeiro passo quando o item do backlog sair.
- Configuração: *Confirm email* ligado, OTP de 6 dígitos válido por 15 min, modelos em
  português com `{{ .Token }}`.
- Cadastro → tela do código (reenviar com contador, trocar e-mail). Login com e-mail não
  confirmado → mesma tela.
- Esqueci a senha → e-mail → código → **2FA se houver** → nova senha (mesmas regras) →
  encerra as outras sessões.
- Mensagens neutras (não revelam se o e-mail tem conta).
- **Ordem:** publicar o app com as telas **antes** de ligar *Confirm email* no Supabase.
- Site de backup: esconder "Criar conta" e "Esqueci a senha", com link para o app.

> Na S4 o "esqueci a senha" ganha um passo: a **chave de recuperação** (ver S4.5).

---

## S3 · Recuperação do 2FA (1 dia)

O Supabase não oferece códigos de backup para TOTP. Proposta em camadas:

1. **Segundo autenticador**: Ajustes → Segurança → "Adicionar outro aparelho" (o Supabase
   aceita mais de um fator TOTP verificado). Recomendado logo depois de ligar o 2FA.
2. **Recuperação assistida** (último recurso): a pessoa pede pelo e-mail da conta; o admin
   confere a identidade fora do app e remove os fatores com a `service_role` (script no
   repositório, registrado em `log_sistema`). Depois de S4, isso devolve o **acesso**, mas os
   dados só voltam com a senha ou a chave de recuperação — o admin não consegue lê-los.
3. Texto no app explicando os dois caminhos na tela do código 2FA ("Perdi meu autenticador").

---

## S4 · Criptografia de ponta a ponta (1–2 semanas)

### S4.1 O que muda para quem usa
- No primeiro acesso depois da atualização, o app gera as chaves, mostra uma **chave de
  recuperação** (24 palavras) e pede para guardar (imprimir, gerenciador de senhas). Só segue
  depois de a pessoa digitar 3 palavras sorteadas, para provar que anotou.
- Nada mais muda no dia a dia: o login continua com e-mail e senha.
- **Esqueceu a senha E perdeu a chave de recuperação = os dados não voltam.** Ninguém, nem o
  administrador, consegue decifrá-los. O app diz isso com todas as letras na hora de criar a
  chave e no fluxo de recuperação.

### S4.2 Modelo de chaves (no estilo Bitwarden/1Password)

```
senha ──PBKDF2-SHA256 (600 mil iterações, sal da conta)──▶ chave mestra (nunca sai do aparelho)
            ├─ HKDF "auth" ─▶ segredo de login  ──▶ é isto que vai para o Supabase como "senha"
            └─ HKDF "kek"  ─▶ KEK-senha ──┐
chave de recuperação (24 palavras, 256 bits) ─▶ KEK-recuperação ─┤
                                                                 ├─ embrulham (AES-256-GCM)
DEK: chave dos dados, 256 bits aleatórios, uma por conta ◀───────┘
DEK ─HKDF─▶ chave de dados (AES-256-GCM) e chave de índice (HMAC-SHA256)
```

- **O servidor nunca vê a senha real.** Ele recebe só o "segredo de login" derivado; sem isso,
  quem controla o servidor poderia capturar a senha no login e derivar a chave. É o ponto que
  separa "cifrado no banco" de "ponta a ponta de verdade".
- A **DEK** é o que cifra os dados. Trocar a senha só reembrulha a DEK (instantâneo, sem
  recifrar nada).
- Tabela nova `chaves_usuario` (RLS do dono + 2FA): `sal`, `dek_senha`, `dek_recuperacao`,
  `versao`, `estado` (`aberto` → `migrando` → `cifrado`).
- Primitivas: AES-256-GCM, HKDF-SHA256, PBKDF2-SHA256, HMAC-SHA256.
  - Web: **WebCrypto** (`crypto.subtle`), com a DEK guardada como `CryptoKey` **não exportável**
    no IndexedDB (sobrevive ao recarregar a página sem ficar legível por script).
  - Celular: **`react-native-quick-crypto`** (implementação nativa, mesma API do WebCrypto; o
    Hermes não tem `crypto.subtle`). DEK no SecureStore, opcionalmente atrás da biometria da S1.2
    (abre o app com Face ID sem digitar senha).
- Todo esse código fica num módulo único, `assets/js/cripto.js` no núcleo compartilhado, para o
  app e o site de backup cifrarem igual — com testes de vetores conhecidos.

### S4.3 Formato dos dados no banco
Cada tabela de dados mantém em claro só o mínimo para a RLS e a ordenação, e o resto vai num
envelope cifrado:

| em claro | cifrado (`cifra` jsonb: `{v, iv, ct}`) |
|---|---|
| `id`, `user_id`, `criado_em` | todos os campos de negócio: ticker, quantidade, preço, valor, data, título, taxa, observação, metas, regras, respostas do perfil… |

- **AAD** do AES-GCM = `tabela|id|user_id`: impede copiar um registro cifrado para outra linha
  ou outra conta sem ser detectado.
- **Unicidade** (ex.: um ativo por ticker, título de renda fixa por nome, importação sem
  duplicar) passa a usar um **índice cego**: `idx = HMAC(chave de índice, valor normalizado)`.
  O banco garante o `unique (user_id, idx)` sem conhecer o valor.
- Validações `check` do banco que dependiam dos valores passam para o app (os formulários já
  validam).
- Tabelas cifradas: `ativos`, `renda_fixa`, `aportes`, `preferencias`, `agro_movimentos`,
  `agro_custos`, `agro_pesagens`, `patrimonio_historico`, `ganhos`, `log_sistema.detalhe`,
  tabelas do perfil e do plano.
- Ficam em claro (não são dados pessoais financeiros): `mercado_cache`, `indices_diarios`,
  `uso_eventos` (já anônima), `admins`.

### S4.4 O que precisa mudar no sistema
| hoje | depois |
|---|---|
| Rotina diária no servidor (`registro_diario`) lê carteiras em claro para gravar a foto do patrimônio | **sai**. O app já grava a foto ao abrir; passa também a preencher os dias sem foto a partir da série reconstruída (`rentab.serieDiaria`, que já existe). Remove-se o job `fc-registro-diario` e o caminho na Edge Function. |
| Edge Function recebe os tickers para buscar cotações | continua (precisa saber o que cotar), mas **não grava** o vínculo usuário↔ticker nem o loga |
| Admin → Onboarding mostra quantos perfis conservador/moderado/arrojado | essa contagem por perfil vira um evento anônimo da telemetria (com consentimento) ou sai |
| Apagar conta pela Edge Function | continua (apagar não precisa ler) |
| Exportar/backup em JSON | o app decifra e exporta (como hoje, mas decifrando antes) |

### S4.5 Senha, recuperação e e-mail com a criptografia
- **Trocar a senha (logado):** deriva nova chave mestra, reembrulha a DEK, troca o segredo de
  login no Supabase — numa ordem que nunca deixa a conta sem DEK válida (grava a DEK nova
  embrulhada antes de trocar o login; se falhar no meio, a antiga continua valendo).
- **Esqueci a senha (S2) + chave de recuperação:** código por e-mail → 2FA → nova senha →
  digitar a chave de recuperação → reembrulha a DEK com a senha nova. Sem a chave: o app oferece
  "começar do zero" (apaga os dados cifrados, que ninguém consegue ler) com confirmação dupla.
- **Novo aparelho:** login → baixa `chaves_usuario` → desembrulha a DEK com a senha.
- **Gerar nova chave de recuperação** em Ajustes → Segurança (invalida a anterior).

### S4.6 Migração das contas existentes
1. Publicar a versão que **lê** os dois formatos (claro e cifrado), sem cifrar ainda.
2. No login seguinte de cada conta: criar chaves → mostrar a chave de recuperação → trocar a
   senha do Supabase pelo segredo de login derivado (a senha que a pessoa digita não muda) →
   `estado = migrando` → cifrar e enviar em lotes → **ler de volta e conferir** cada lote →
   apagar as colunas em claro dessas linhas → `estado = cifrado`.
   Se fechar no meio, retoma de onde parou (o claro só some depois de conferido).
3. Quando todas as contas estiverem `cifrado`, migração no banco remove as colunas em claro e
   as constraints antigas; o app deixa de ler o formato antigo.
4. O site de backup recebe o mesmo `cripto.js`; enquanto não receber, contas migradas ficam sem
   acesso por ele (aviso no login do backup).

### S4.7 Limites (dito com honestidade)
- **Metadados continuam visíveis** ao servidor: quantas linhas, quando foram criadas, tamanho
  aproximado, quais tickers foram cotados naquele momento.
- **Na web**, o código do app vem do servidor a cada acesso: quem controlasse a Vercel poderia
  servir uma versão que captura a senha. CSP rígida e o domínio protegido reduzem o risco; o
  **app nativo** (código assinado e instalado) é o canal mais seguro.
- Desempenho: decifrar alguns milhares de linhas é questão de milissegundos; o PBKDF2 de 600 mil
  iterações leva ~0,3–1 s no login (de propósito).

**Pronto quando:** com a `service_role` no painel do Supabase, as tabelas de dados só mostram
envelopes ilegíveis; app e site funcionam igual; recuperação com a chave testada; a rotina
diária do servidor desligada.

---

## S5 · Auditoria e testes (contínuo)

- **RLS com duas contas reais de teste**: A não lê, não grava e não apaga nada de B, pela API
  direto (chave pública), em todas as tabelas; `anon` não lê nada; sessão `aal1` de conta com 2FA
  não lê nada. Rodar como script (`npm run teste:seguranca`) a cada mudança no `schema.sql`.
- **Criptografia**: vetores de teste oficiais (AES-GCM, HKDF, PBKDF2), adulteração de
  ciphertext/AAD é detectada, troca de linha entre contas falha, chave errada falha.
- **Ferramentas**: Security Advisor do Supabase; o `supabase-security` apontado para o
  `schema.sql` (o projeto não usa a pasta `supabase/migrations`); `npm audit` no app.
- **Revisão de dependências** com acesso a dados sensíveis (`@supabase/supabase-js`,
  `react-native-quick-crypto`, `expo-secure-store`) a cada atualização.
- **Antes de cada versão nas lojas**: checklist curto (sem `console.log` de dados, sem
  `EXPO_PUBLIC_FIXTURE`, `service_role` fora do bundle, CSP intacta).

---

## Ordem e estimativa

| Fase | Esforço | Precisa de você |
|---|---|---|
| S1 | 2–3 dias | checklist do painel do Supabase |
| S2 | 2–3 dias | modelos de e-mail no painel; decidir quando ligar *Confirm email* (ver S2) |
| S3 | 1 dia | decidir o procedimento de recuperação assistida |
| S4 | 1–2 semanas | aceite do modelo (a perda de dados sem senha e sem chave de recuperação é definitiva) |
| S5 | 1 dia + contínuo | duas contas de teste com e-mail real |

S1 e S2 podem andar em paralelo. A S2 entra em produção "pela metade" até o SMTP próprio (ver
Backlog): o código fica pronto e a confirmação de cadastro só é ligada depois.
A S4 só começa com S2 e S3 no ar, porque o "esqueci a senha" e a recuperação do 2FA mudam de forma com a criptografia.

---

## Backlog

| item | por que está aqui | o que destrava |
|---|---|---|
| **Provedor de e-mail próprio (SMTP)** — Resend, Brevo, Amazon SES ou similar, com domínio do remetente (SPF/DKIM/DMARC) | decisão de 2026-10-14: por enquanto fica o e-mail do Supabase | ligar *Confirm email*; "esqueci a senha" para todos os usuários (hoje só para a equipe do projeto); limites de envio maiores; e-mails que não caem no spam |
| **"Esqueci a senha" pelo autenticador (sem e-mail)** — Edge Function `acesso` recebe e-mail + código do 2FA + nova senha; confere os limites por IP/conta (S1.3); abre uma sessão temporária com `auth.admin.generateLink({ type: "recovery" })` (não envia e-mail) + `verifyOtp({ token_hash })`; valida o código com `mfa.challengeAndVerify`; grava a senha (`updateUser`) e encerra todas as sessões. Só para contas com 2FA ativo | pedido de 2026-10-14, adiado; alternativa enquanto não há SMTP próprio | recuperar a conta sem depender de e-mail; exige a S1.3 antes (o código tem só 6 dígitos) |
| **Plano Teams do Supabase** (opcional) | custo | gancho de verificação de senha e de 2FA: limite de tentativas por conta valendo até para quem chama a API direto |

