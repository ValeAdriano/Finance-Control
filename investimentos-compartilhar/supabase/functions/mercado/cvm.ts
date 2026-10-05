// FIIs pela CVM: o informe trimestral que todo fundo entrega, nos dados
// abertos (dados.cvm.gov.br). Daqui saem o que o Fundamentus não tem:
// vacância financeira, inadimplência, concentração (maior imóvel, setor de
// inquilino, maior CRI, maior FII) e a composição da receita, que diz o
// tipo do fundo (tijolo, papel, fundo de fundos, híbrido).
import { unzipSync } from "npm:fflate@0.8.2";

type Linha = string[];
const latin1 = new TextDecoder("iso-8859-1");
const n = (s: string | undefined) => { const v = Number(String(s ?? "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const pct = (x: number) => Math.round(x * 10000) / 100;      // fração → % com 2 casas

function csv(bytes: Uint8Array): { cab: Record<string, number>; linhas: Linha[] } {
  const txt = latin1.decode(bytes).replace(/\r/g, "");
  const ls = txt.split("\n").filter((l) => l.length);
  const cab: Record<string, number> = {};
  (ls[0] || "").split(";").forEach((c, i) => { cab[c] = i; });
  return { cab, linhas: ls.slice(1).map((l) => l.split(";")) };
}

// arquivos de um ano: { "imovel": {...}, "ativo": {...}, ... }
export function lerZip(zip: Uint8Array) {
  const arq = unzipSync(zip, { filter: (f) => /_(geral|imovel|imovel_renda_acabado_inquilino|ativo|resultado_contabil_financeiro)_\d{4}\.csv$/.test(f.name) });
  const out: Record<string, ReturnType<typeof csv>> = {};
  for (const [nome, bytes] of Object.entries(arq)) {
    const m = nome.match(/inf_trimestral_fii_(.+)_\d{4}\.csv$/);
    if (m) out[m[1]] = csv(bytes);
  }
  return out;
}

// Junta um ou mais anos e devolve, por ticker, o retrato do último trimestre entregue.
export function resumoFiis(anos: ReturnType<typeof lerZip>[]) {
  // o trimestre mais recente de cada fundo (CNPJ)
  const ultimo: Record<string, string> = {};
  const cadastro: Record<string, { nome: string; isin: string; segmento: string }> = {};
  for (const a of anos) {
    const g = a.geral; if (!g) continue;
    const c = g.cab;
    for (const l of g.linhas) {
      const cnpj = l[c.CNPJ_Fundo_Classe], data = l[c.Data_Referencia];
      if (!cnpj || !data) continue;
      if (!ultimo[cnpj] || data > ultimo[cnpj]) {
        ultimo[cnpj] = data;
        cadastro[cnpj] = { nome: l[c.Nome_Fundo_Classe], isin: l[c.Codigo_ISIN] || "", segmento: l[c.Segmento_Atuacao] || "" };
      }
    }
  }
  const doUltimo = (cnpj: string, data: string) => ultimo[cnpj] === data;

  type Acum = {
    imoveis: { area: number; vac: number; inad: number; rec: number; classe: string }[];
    setores: Record<string, number>;
    cri: number[]; fii: number[]; outros: number;
    aluguel: number; tvm: number;
  };
  const f: Record<string, Acum> = {};
  const de = (cnpj: string) => (f[cnpj] = f[cnpj] || { imoveis: [], setores: {}, cri: [], fii: [], outros: 0, aluguel: 0, tvm: 0 });

  for (const a of anos) {
    if (a.imovel) {
      const c = a.imovel.cab;
      for (const l of a.imovel.linhas) {
        const cnpj = l[c.CNPJ_Fundo_Classe];
        if (!doUltimo(cnpj, l[c.Data_Referencia])) continue;
        de(cnpj).imoveis.push({ classe: l[c.Classe] || "", area: n(l[c.Area]), vac: n(l[c.Percentual_Vacancia]),
          inad: n(l[c.Percentual_Inadimplencia]), rec: n(l[c.Percentual_Receitas_FII]) });
      }
    }
    if (a.imovel_renda_acabado_inquilino) {
      const c = a.imovel_renda_acabado_inquilino.cab;
      for (const l of a.imovel_renda_acabado_inquilino.linhas) {
        const cnpj = l[c.CNPJ_Fundo_Classe];
        if (!doUltimo(cnpj, l[c.Data_Referencia])) continue;
        const s = (l[c.Setor_Atuacao] || "Não informado").trim();
        const acc = de(cnpj);
        acc.setores[s] = (acc.setores[s] || 0) + n(l[c.Percentual_Receitas_FII]);
      }
    }
    if (a.ativo) {
      const c = a.ativo.cab;
      for (const l of a.ativo.linhas) {
        const cnpj = l[c.CNPJ_Fundo_Classe];
        if (!doUltimo(cnpj, l[c.Data_Referencia])) continue;
        const v = n(l[c.Valor]); if (!(v > 0)) continue;
        const t = l[c.Tipo] || "", acc = de(cnpj);
        if (t === "CRI/CRA") acc.cri.push(v); else if (t === "FII") acc.fii.push(v); else acc.outros += v;
      }
    }
    if (a.resultado_contabil_financeiro) {
      const c = a.resultado_contabil_financeiro.cab;
      for (const l of a.resultado_contabil_financeiro.linhas) {
        const cnpj = l[c.CNPJ_Fundo_Classe];
        if (!doUltimo(cnpj, l[c.Data_Referencia])) continue;
        const acc = de(cnpj);
        acc.aluguel = Math.max(0, n(l[c.Receita_Aluguel_Investimento_Financeiro]));
        acc.tvm = Math.max(0, n(l[c.Receita_Juros_TVM_Financeiro]));
      }
    }
  }

  const saida: Record<string, unknown> = {};
  for (const [cnpj, data] of Object.entries(ultimo)) {
    const cad = cadastro[cnpj];
    // ISIN de FII: BR + código de 4 letras + CTF... → ticker com final 11
    const m = cad.isin.match(/^BR([A-Z]{4})CTF/);
    if (!m) continue;
    const ticker = m[1] + "11";
    const acc = f[cnpj] || { imoveis: [], setores: {}, cri: [], fii: [], outros: 0, aluguel: 0, tvm: 0 };
    const renda = acc.imoveis.filter((i) => /renda/i.test(i.classe));
    const r: Record<string, unknown> = { cnpj, data_referencia: data, nome: cad.nome, segmento_cvm: cad.segmento };

    // ---- imóveis: vacâncias, inadimplência e concentração
    if (renda.length) {
      const area = renda.reduce((s, i) => s + i.area, 0);
      const rec = renda.reduce((s, i) => s + i.rec, 0);
      if (area > 0) r.vacancia_fisica_cvm = pct(renda.reduce((s, i) => s + i.vac * i.area, 0) / area);
      // Vacância financeira estimada: receita potencial de cada imóvel =
      // receita ÷ (1 − vacância); imóvel quase todo vago usa o aluguel
      // médio por m² do fundo × a área. Perdida ÷ potencial.
      const ocupada = renda.reduce((s, i) => s + i.area * (1 - Math.min(1, i.vac)), 0);
      const aluguelM2 = ocupada > 0 ? rec / ocupada : 0;
      // imóvel sem vacância e sem receita (recém-comprado, carência, sem
      // dado) fica de fora: contá-lo como vago inventaria uma vacância
      let potencial = 0;
      for (const i of renda) {
        if (i.rec > 0 && i.vac < 0.98) potencial += i.rec / (1 - i.vac);
        else if (i.vac >= 0.98) potencial += i.area * aluguelM2;
      }
      if (potencial > 0 && rec > 0) r.vacancia_financeira = pct(Math.max(0, potencial - rec) / potencial);
      if (rec > 0) {
        r.inadimplencia = pct(renda.reduce((s, i) => s + i.inad * i.rec, 0) / rec);
        const fatias = renda.map((i) => i.rec / rec).sort((a, b) => b - a);
        r.maior_imovel = pct(fatias[0]);
        r.hhi_imoveis = Math.round(fatias.reduce((s, x) => s + x * x, 0) * 10000);
      }
      r.n_imoveis = renda.length;
    }
    const setores = Object.entries(acc.setores).filter(([, v]) => v > 0);
    const totSet = setores.reduce((s, [, v]) => s + v, 0);
    if (totSet > 0) {
      setores.sort((a, b) => b[1] - a[1]);
      r.maior_setor = { nome: setores[0][0], pct: pct(setores[0][1] / totSet) };
      r.n_setores = setores.length;
    }
    // ---- papéis: concentração na maior posição
    const conc = (vs: number[]) => {
      const t = vs.reduce((s, x) => s + x, 0);
      if (!(t > 0)) return null;
      const o = [...vs].sort((a, b) => b - a);
      return { n: vs.length, maior: pct(o[0] / t), top5: pct(o.slice(0, 5).reduce((s, x) => s + x, 0) / t) };
    };
    const cri = conc(acc.cri), fii = conc(acc.fii);
    if (cri) r.cri = cri;
    if (fii) r.fii = fii;
    const totAt = acc.cri.reduce((s, x) => s + x, 0) + acc.fii.reduce((s, x) => s + x, 0) + acc.outros;
    if (totAt > 0) r.carteira_papeis = { cri: pct(acc.cri.reduce((s, x) => s + x, 0) / totAt), fii: pct(acc.fii.reduce((s, x) => s + x, 0) / totAt), outros: pct(acc.outros / totAt) };
    // ---- tipo, pela composição da receita do trimestre
    const recTot = acc.aluguel + acc.tvm;
    const fatiaAluguel = recTot > 0 ? acc.aluguel / recTot : renda.length ? 1 : 0;
    r.receita_aluguel = pct(fatiaAluguel);
    const papeis = r.carteira_papeis as { cri: number; fii: number } | undefined;
    // shoppings recebem parte da renda por outras linhas: metade já é tijolo
    r.tipo = fatiaAluguel >= 0.5 && renda.length ? "tijolo"
      : fatiaAluguel <= 0.3 ? (papeis && papeis.fii >= 60 ? "fof" : papeis ? "papel" : renda.length ? "tijolo" : "papel")
      : "hibrido";
    saida[ticker] = r;
  }
  return saida;
}
