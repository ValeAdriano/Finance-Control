/* Adaptador do núcleo para o app (React Native / Hermes e RN Web).
 *
 * Em runtime o Metro empacota os arquivos do site como módulos. A estratégia:
 *   1. instalar o shim sobre o `global` ANTES de qualquer require do núcleo
 *      (é o que faz `window.FC = ...` virar o global `FC`);
 *   2. dar as dependências de plataforma: localStorage (MMKV no nativo),
 *      o cliente @supabase/supabase-js com a sessão nesse armazenamento, e
 *      @zip.js/zip.js;
 *   3. requerer os arquivos do site NA ORDEM de `ordem.js` (cada um é um IIFE
 *      que muta `window.FC`);
 *   4. trocar as poucas utilidades que no site dependem do DOM
 *      (`FC.carregaScript`, `FC.baixar`) por equivalentes do app.
 *
 * Os arquivos vêm de `../../../investimentos-compartilhar/assets/js`, alcançável
 * pelo Metro graças ao `watchFolders` do metro.config.js. Os requires têm de
 * ser literais para o empacotador resolvê-los em build. */
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as zip from "@zip.js/zip.js";
import { Platform } from "react-native";
import { aplicaShim } from "./shim.js";
import { armazenamento, armazenamentoSessao } from "../plataforma/armazenamento";
import type { FC as FCTipo } from "./fc";

let FC_CACHE: FCTipo | null = null;

/** Monta (uma vez) e devolve o `FC` do núcleo já carregado. */
export function carregaNucleo(): FCTipo {
  if (FC_CACHE) return FC_CACHE;
  const g: any = globalThis as any;

  // o supabase do site é criado com storageKey "fc-sessao"; aqui injetamos o
  // armazenamento do app para a sessão sobreviver ao fechar o aplicativo
  const supabase = {
    createClient: (url: string, chave: string, opcoes: any = {}) =>
      createClient(url, chave, {
        ...opcoes,
        auth: {
          ...(opcoes.auth || {}),
          storage: armazenamentoSessao,
          detectSessionInUrl: false,
        },
      }),
  };

  aplicaShim(g, { localStorage: armazenamento, supabase, zip });
  // no web o zip.js deve estar em window.zip mesmo com window já existente
  if (!g.zip) g.zip = zip;

  /* eslint-disable @typescript-eslint/no-require-imports */
  require("../../../investimentos-compartilhar/assets/js/config.js");
  require("../../../investimentos-compartilhar/assets/js/util.js");
  require("../../../investimentos-compartilhar/assets/js/padroes.js");
  require("../../../investimentos-compartilhar/assets/js/layout.js");
  require("../../../investimentos-compartilhar/assets/js/supa.js");
  require("../../../investimentos-compartilhar/assets/js/graficos.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/avaliador.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/agro.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/rentabilidade.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/carteira.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/perfil.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/recomendacao.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/renda.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/projecao.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/importador.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/dividendos.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/caixa-proventos.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/impostos.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/alertas.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/salario.js");
  require("../../../investimentos-compartilhar/assets/js/modelo/retrospectiva.js");
  // só pela lógica pura: FC.promo (montaDados, CENAS, TOTAL) e FC.admin
  // (analisa, insights, nomeRota). As telas deles são as do app.
  require("../../../investimentos-compartilhar/assets/js/promo/promo.js");
  require("../../../investimentos-compartilhar/assets/js/telas/admin.js");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const FC = g.FC as FCTipo;
  // o zip.js já vem no pacote do app: nada a baixar
  FC.carregaScript = async () => {};
  // `FC.baixar` é trocado pela versão do app em src/plataforma/arquivos.ts
  FC.plataforma = Platform.OS;

  FC_CACHE = FC;
  return FC;
}

export const FC: FCTipo = carregaNucleo();
export default FC;
