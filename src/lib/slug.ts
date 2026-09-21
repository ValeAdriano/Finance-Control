/**
 * Slug do ativo para a URL.
 *
 * O símbolo não serve como identificador de rota: ação é limpa (`PETR4`), mas
 * renda fixa e agro têm espaço e sinal — "CDB Inter 112% CDI" viraria uma URL
 * escapada e ilegível, e não casaria de volta na busca.
 *
 * A mesma regra está no SQL da migração `..._asset_slug.sql`; mudar uma exige
 * mudar a outra, senão o link deixa de resolver.
 */
export function assetSlug(symbol: string): string {
  return symbol
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
