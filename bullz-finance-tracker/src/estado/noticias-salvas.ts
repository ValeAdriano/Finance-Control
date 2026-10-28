/* Notícias salvas no aparelho (FC.local): o que você guardou no baralho
 * para ler depois. Fica só neste navegador/aparelho, sem ir para a conta. */
import { create } from "zustand";
import type { Noticia } from "./cripto";
import FC from "../nucleo";

const CHAVE = "noticias_salvas";
const MAX = 200;

export const useSalvas = create<{ itens: Noticia[] }>(() => ({ itens: FC.local.ler(CHAVE, []) || [] }));

export const estaSalva = (itens: Noticia[], link: string) => itens.some((n) => n.link === link);

/** salva ou tira dos salvos; devolve se ficou salva */
export function alternaSalva(n: Noticia): boolean {
  const atuais = useSalvas.getState().itens;
  const ja = estaSalva(atuais, n.link);
  const itens = ja ? atuais.filter((x) => x.link !== n.link) : [n, ...atuais].slice(0, MAX);
  useSalvas.setState({ itens });
  FC.local.gravar(CHAVE, itens);
  return !ja;
}
