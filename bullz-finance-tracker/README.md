# Bullz Finance Tracker (React Native)

Migração do **Bullz** (`../investimentos-compartilhar/`) para React Native, rodando em
**iOS, Android e web** (React Native Web). O objetivo é ficar **igual** ao sistema atual: mesmas
telas, mesmos números, mesmo banco.

O site atual é a referência viva. Nada aqui é considerado pronto sem comparação lado a lado.

## Documentos

| arquivo | para quê |
|---|---|
| [`PLANO.md`](PLANO.md) | fases, tarefas, critérios de aceite e como cada etapa é comparada |
| [`PARIDADE.md`](PARIDADE.md) | matriz tela × estado × elemento, com o status de cada item |
| [`ROTEIROS.md`](ROTEIROS.md) | fluxos de teste escritos uma vez e rodados no site e no app |

## Ideia central

- **Os cálculos não são reescritos.** O app carrega os mesmos arquivos de
  `../investimentos-compartilhar/assets/js/` (`padroes.js`, `layout.js`, `util.js`, `supa.js` e
  `modelo/*`) por um adaptador. Uma única fonte da verdade.
- **O banco não muda.** Mesmo projeto Supabase, mesmas tabelas, RLS, RPCs e Edge Function.
- **O visual vem dos mesmos tokens** de `assets/css/app.css` (claro/escuro, raios, espaços, curvas).

## Estado

**F1–F7 implementadas** (2026-10-14): todas as telas do site existem no app — casca, acesso e MFA,
Início, Investimentos, Aportes, Dividendos, IR, Salário, Agro, Renda, Simular, Projeções, Ajustes,
Perfil (questionário, resultado, relatório), editor de layout, guias, Retrospectiva, vídeo de
divulgação, Administração e instalação como PWA. Validadas no **web**; faltam os gates de
comparação (diff visual, roteiros) e rodar no aparelho. A **F8** (lojas, corte da Vercel) depende
do seu aceite. Detalhes em [`PLANO.md`](PLANO.md#situação-em-2026-10-14).

## Como rodar

```
npm install
npm run web          # http://localhost:8081
npm run ios          # ou: npm run android
```

**Modo fixture** (só em desenvolvimento): dados de demonstração em memória, sem rede nem login.
Acrescente à URL `?fixture=1` (conta com dados), `?fixture=admin` (com a Administração e uso
sintético) ou `?fixture=vazia` (conta nova). No nativo: `EXPO_PUBLIC_FIXTURE=1 npm run ios`.

## Estrutura

| pasta | o quê |
|---|---|
| `app/` | rotas do expo-router, com os mesmos nomes das rotas do site |
| `src/nucleo/` | adaptador que carrega os arquivos de cálculo do site (shim de navegador + ordem do `index.html`) |
| `src/estado/` | `FC.estado` + zustand (rerender), login, cotações, telemetria |
| `src/casca/` | topo, barra de abas, "Mais", página |
| `src/telas/` | as telas (uma por arquivo, port de `telas/*.js`) |
| `src/ui/` | kit visual, folhas, campos, gráficos (SVG do `graficos.js`), ícones |
| `src/recap/` | o "palco" da retrospectiva e do vídeo (WebView/iframe com `recap/*` e `promo.js`) |
| `src/plataforma/` | armazenamento, adaptações do `FC` por plataforma, modo fixture |
| `public/` | template web (meta tags do PWA), manifest, ícones e o `palco.html` gerado |
| `testes/` | paridade sem dependências (`npm test`) |

## Arquivos gerados

Rode de novo quando o site mudar a fonte correspondente:

| comando | fonte no site | saída |
|---|---|---|
| `npm run gera:icones` | `util.js` (dicionário `P`) | `src/ui/icones.gen.ts` |
| `npm run gera:palco` | `modelo/retrospectiva.js`, `recap/*`, `promo/promo.js` + `src/recap/motor*.js` | `src/recap/palco.gen.ts`, `public/palco.html`, `public/palco.js` |

## Verificações

```
npm test             # paridade com as fontes do site (node --test)
npm run lint
npx tsc --noEmit
```

## Gerar o APK (Android)

O APK sai assinado com a chave de debug: instala direto no celular para teste, mas não serve
para a Play Store (para a loja, use o perfil `production` do EAS, que gera `.aab`). É a versão
de produção do app: login e dados reais, sem o modo fixture.

### Nesta máquina, num comando

Com o Java 17 e o Android SDK instalados (Opção B abaixo, uma vez só):

```bash
cd bullz-finance-tracker
npm run apk              # ~2 min; o APK sai em ../Bullz.apk (raiz do repositório)
npm run apk -- --limpo   # refaz android/ do zero: depois de mexer em app.json ou em libs nativas
```

O `Bullz.apk` fica na raiz do repositório (fora do git) para passar ao celular por AirDrop ou
cabo. O script recusa rodar dentro de pastas do iCloud (Documentos, Mesa): com o disco cheio o
macOS tira o conteúdo dos arquivos dali e o build sai quebrado. Mantenha o projeto em
`~/Projetos` ou outra pasta fora do iCloud.

### Opção A — na nuvem com EAS (mais simples)

Não precisa de Java nem Android SDK. Precisa de uma conta Expo (gratuita).

```bash
cd bullz-finance-tracker
npx eas-cli login                                 # uma vez
npx eas-cli build -p android --profile preview    # perfil do eas.json que gera APK
```

Na primeira vez o EAS pergunta se pode criar o projeto e uma chave de assinatura: aceite. O build
leva ~10–20 min na fila gratuita e termina com um link e um QR code: abra no celular e instale.

### Opção B — nesta máquina

Pré-requisitos (uma vez só; ~3 GB, sem sudo):

```bash
# Java 17 (Eclipse Temurin)
mkdir -p ~/.local/jdk17
curl -fL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
  | tar -xz -C ~/.local/jdk17 --strip-components=1

# Android SDK: ferramentas de linha de comando + pacotes que o Expo SDK 57 pede
mkdir -p ~/Android/Sdk/cmdline-tools && cd /tmp
curl -fLO https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q commandlinetools-linux-11076708_latest.zip && mv cmdline-tools ~/Android/Sdk/cmdline-tools/latest
export JAVA_HOME=~/.local/jdk17 ANDROID_HOME=~/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
sdkmanager --licenses                              # leia e aceite as licenças da Google
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```

Coloque os três `export` acima no `~/.bashrc` para não repetir.

Build:

```bash
cd bullz-finance-tracker
npm install
npx expo prebuild -p android --clean      # gera a pasta android/ (fora do git)
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

O APK fica em `android/app/build/outputs/apk/release/app-release.apk`.

- `-PreactNativeArchitectures=arm64-v8a` compila só para celulares de 64 bits (praticamente todos
  os atuais): o build fica bem mais rápido e leve. Sem ele, sai um APK para todas as arquiteturas.
- O primeiro build baixa as dependências do Gradle e compila C++: 15–40 min. Os próximos são
  bem mais rápidos.
- Pouca memória? Feche outros programas; se o Gradle morrer por falta de memória, rode com
  `--no-daemon --max-workers=2`.

### Instalar no celular

- **Cabo USB:** ative *Opções do desenvolvedor → Depuração USB* e rode
  `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
- **Sem cabo:** mande o `.apk` para o celular (Drive, Telegram, e-mail…), abra pelo gerenciador
  de arquivos e permita *instalar apps desconhecidos* para esse app quando o Android pedir.
- Já tem uma versão instalada com outra assinatura (por exemplo, a do EAS)? Desinstale antes.

## Deploy web (Vercel)

**O app React Native é o site principal.** O site antigo em `../investimentos-compartilhar/`
(HTML, CSS e JS puros) fica como backup: continua no repositório e continua sendo a fonte dos
cálculos que o app carrega.

O `vercel.json` deste diretório faz tudo: `npm ci` → `npx expo export -p web` → `dist/`, como
SPA, com os mesmos headers de segurança do site (CSP sem script inline; o player da
retrospectiva roda em `/palco.html`, servido de `'self'`).

### Trocar o projeto da Vercel para o app (uma vez)

No painel da Vercel, no projeto que hoje serve o site:

1. **Settings → General → Root Directory**: troque `investimentos-compartilhar` por
   `bullz-finance-tracker`.
2. Na mesma tela, deixe **ligado** *Include source files outside of the Root Directory in the Build Step*:
   o app lê os cálculos de `../investimentos-compartilhar/assets/js` durante o build.
3. **Framework Preset**: *Other* (o `vercel.json` já define build, saída e headers).
   **Node.js Version**: 22.x (ou 20.x).
4. **Environment Variables**: nenhuma é necessária. Não defina `EXPO_PUBLIC_FIXTURE` (ela liga
   os dados de demonstração).
5. **Deployments → Redeploy** a última versão da `main` (ou faça um push).

Depois do deploy, confira: login, Início com cotações, uma retrospectiva (Ajustes → Retrospectiva)
e o console do navegador sem erros de CSP.

Links antigos continuam valendo: `/#/ativos` (favoritos, PWA instalada) abre `/ativos`.
O domínio não muda, então a URL do site no Supabase (Authentication → URL Configuration) também
não precisa mudar.

### Voltar para o site antigo (rollback)

- **Imediato:** em *Deployments*, escolha o último deploy do site antigo → *Promote to Production*.
- **Definitivo:** volte o Root Directory para `investimentos-compartilhar` e faça redeploy.

Para manter o site antigo no ar como backup em outro endereço, crie um **segundo projeto** na
Vercel apontando para o mesmo repositório com Root Directory `investimentos-compartilhar` (o
`vercel.json` de lá já está pronto) e um domínio como `backup.seudominio.com`.

### Testar o build de produção localmente

```bash
npx expo export -p web     # gera dist/
npx serve dist -s          # SPA em http://localhost:3000
```
