#!/bin/sh
# Gera o APK de teste (Android, arm64) e deixa em <raiz do repositório>/Bullz.apk,
# pronto para passar ao celular por AirDrop ou cabo.
#
#   npm run apk            build incremental (rápido: ~2 min depois do primeiro)
#   npm run apk -- --limpo refaz a pasta android/ do zero (use depois de mudar
#                          app.json, plugins ou dependências nativas)
#
# Pré-requisitos (uma vez só; ver README, "Gerar o APK"): Java 17 e o Android
# SDK. Por padrão procura o JDK em ~/.local/jdk17 e o SDK em
# ~/Library/Android/sdk; JAVA_HOME e ANDROID_HOME do ambiente têm precedência.
#
# Não rode de dentro de uma pasta sincronizada pelo iCloud (Documentos, Mesa):
# com o disco cheio o macOS tira o conteúdo dos arquivos do disco, eles passam
# a ser lidos como vazios e o build trava ou sai quebrado.
set -e

APP="$(cd "$(dirname "$0")/.." && pwd)"
RAIZ="$(cd "$APP/.." && pwd)"
SAIDA="$RAIZ/Bullz.apk"

case "$APP" in
  "$HOME/Documents"/*|"$HOME/Desktop"/*|"$HOME/Library/Mobile Documents"/*)
    echo "O projeto está numa pasta do iCloud ($APP)." >&2
    echo "Mova-o para fora (ex.: ~/Projetos) antes de gerar o APK." >&2
    exit 1 ;;
esac

if [ -z "$JAVA_HOME" ]; then
  if [ -d "$HOME/.local/jdk17/Contents/Home" ]; then JAVA_HOME="$HOME/.local/jdk17/Contents/Home"
  else JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"; fi
fi
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -x "$JAVA_HOME/bin/java" ] || { echo "Java 17 não encontrado (defina JAVA_HOME)." >&2; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK não encontrado em $ANDROID_HOME (defina ANDROID_HOME)." >&2; exit 1; }
export JAVA_HOME ANDROID_HOME

cd "$APP"
[ -d node_modules ] || npm ci --no-audit --no-fund

if [ "$1" = "--limpo" ] || [ ! -d android ]; then
  echo "› gerando a pasta android/ do zero"
  npx expo prebuild -p android --clean
fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "› compilando (release, arm64)"
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain -q)

cp android/app/build/outputs/apk/release/app-release.apk "$SAIDA"
VERSAO="$(git -C "$RAIZ" rev-parse --short HEAD 2>/dev/null || echo '?')"
SUJO="$(git -C "$RAIZ" status --porcelain --untracked-files=no 2>/dev/null | head -1)"
echo "✔ $SAIDA ($(du -h "$SAIDA" | cut -f1 | tr -d ' '), commit $VERSAO${SUJO:+ + mudanças não commitadas})"
