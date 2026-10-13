/* Gera a função do banco que recalcula o perfil a partir das respostas,
 * com as MESMAS tabelas de pontos de FC.PERFIL (assets/js/padroes.js).
 *
 *   node scripts/gera-perfil-sql.js            imprime a função
 *   node scripts/gera-perfil-sql.js --escreve  atualiza supabase/schema.sql
 *   node scripts/gera-perfil-sql.js --confere  falha se o schema.sql está desatualizado
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const raiz = path.join(__dirname, "..");
const ctx = { window: { FC: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, "assets/js/padroes.js"), "utf8"), ctx);
const P = ctx.window.FC.PERFIL;

const q = (id) => P.perguntas.find((x) => x.id === id);
const lit = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
const mapa = (id, campo) => Object.fromEntries(q(id).opcoes.filter((o) => o[campo] != null).map((o) => [o.id, o[campo]]));
const maxDe = (id, campo) => Math.max(...q(id).opcoes.map((o) => o[campo] || 0));

const itensT = P.perguntas.filter((x) => x.opcoes.some((o) => o.t != null));
const capItens = ["idade", "estab", "dependentes", "moradia", "patrimonio", "reserva"];
const tabelaC = Object.fromEntries(capItens.map((id) => [id, { max: maxDe(id, "c"), neutro: Math.round(maxDe(id, "c") * P.neutro), pts: mapa(id, "c") }]));
const tabelaT = Object.fromEntries(itensT.map((x) => [x.id, mapa(x.id, "t")]));
const maxT = itensT.reduce((s, x) => s + maxDe(x.id, "t"), 0);
const essenciais = P.perguntas.filter((x) => x.essencial).map((x) => x.id);
const reservaCurta = q("reserva").opcoes.filter((o) => o.nd || o.v == null || o.v < 3).map((o) => o.id);
const prazoCurto = q("prazo").opcoes.filter((o) => o.v < 2).map((o) => o.id);
const ndRenda = q("renda").opcoes.filter((o) => o.nd).map((o) => o.id);
const ndSobra = q("sobra").opcoes.filter((o) => o.nd).map((o) => o.id);
const lista = (a) => a.map((x) => `'${x}'`).join(", ");
const faixas = P.faixas;

const MARCA_INI = "-- >>> perfil_confere (gerado por scripts/gera-perfil-sql.js; não edite à mão)";
const MARCA_FIM = "-- <<< perfil_confere";

function gera() {
  return `${MARCA_INI}
-- versão do modelo: ${P.versao}
create or replace function privado.perfil_confere()
returns trigger language plpgsql security definer set search_path = '' as $f$
declare
  r        jsonb := new.respostas;
  cap_tab  jsonb := ${lit(tabelaC)};
  tol_tab  jsonb := ${lit(tabelaT)};
  renda_v  jsonb := ${lit(mapa("renda", "v"))};
  sobra_v  jsonb := ${lit(mapa("sobra", "v"))};
  chave    text;
  pts      integer := 0;
  tol_pts  integer := 0;
  tol      integer;
  cap      integer;
  rv       numeric;
  sv       numeric;
  num      numeric;
  den      numeric;
  agro     numeric;
  ta       integer;
  tb       integer;
  cons     text := 'alta';
  par      text[];
  perfil   text;
  score    integer;
begin
  if new.versao_modelo <> '${P.versao}' then
    raise exception 'versao_modelo_desconhecida' using errcode = '22023';
  end if;
  if jsonb_typeof(r) <> 'object' then
    raise exception 'respostas_invalidas' using errcode = '22023';
  end if;
  foreach chave in array array[${lista(essenciais)}] loop
    if r ->> chave is null then
      raise exception 'resposta_faltando: %', chave using errcode = '22023';
    end if;
  end loop;

  -- tolerância
  for chave in select jsonb_object_keys(tol_tab) loop
    tol_pts := tol_pts + coalesce((tol_tab -> chave ->> (r ->> chave))::integer, 0);
  end loop;
  tol := round(tol_pts::numeric / ${maxT} * 100);

  -- capacidade
  foreach chave in array array[${lista(capItens)}] loop
    pts := pts + coalesce((cap_tab -> chave -> 'pts' ->> (r ->> chave))::integer,
                          (cap_tab -> chave ->> 'neutro')::integer);
  end loop;
  rv := (renda_v ->> (r ->> 'renda'))::numeric;
  sv := (sobra_v ->> (r ->> 'sobra'))::numeric;
  if rv is not null and sv is not null and rv > 0 then
    num := 25 * sv * 100;
    den := rv * ${Math.round(P.taxa_sobra_cheia * 100)};
    if sv * 100 >= den then pts := pts + 25;
    else pts := pts + floor((2 * num + den) / (2 * den))::integer;
    end if;
  else
    pts := pts + ${Math.round(25 * P.neutro)};
  end if;
  agro := (r ->> 'agro_pct')::numeric;
  if agro is not null and agro > ${P.agro_alto.limite_pct} then pts := pts - ${P.agro_alto.desconto}; end if;
  cap := greatest(0, least(100, pts));
  if r ->> 'divida' = 'sim' then cap := least(cap, ${P.tetos.divida_cara}); end if;
  if (r ->> 'reserva') is null or (r ->> 'reserva') in (${lista(reservaCurta)}) then cap := least(cap, ${P.tetos.reserva_curta}); end if;
  if (r ->> 'prazo') in (${lista(prazoCurto)}) then cap := least(cap, ${P.tetos.prazo_curto}); end if;
  if r ->> 'saque' = 'provavel' then cap := least(cap, ${P.tetos.saque_provavel}); end if;

  -- consistência: perguntas espelho
  foreach par slice 1 in array array[${P.espelhos.map((e) => `array['${e[0]}','${e[1]}']`).join(", ")}] loop
    ta := (tol_tab -> par[1] ->> (r ->> par[1]))::integer;
    tb := (tol_tab -> par[2] ->> (r ->> par[2]))::integer;
    if ta is not null and tb is not null and abs(ta - tb) >= ${P.degraus_contradicao} then cons := 'baixa'; end if;
  end loop;

  score := least(tol, cap);
  perfil := case ${faixas.map((f) => `when score <= ${f.ate} then '${f.chave}'`).join(" ")} else '${faixas.at(-1).chave}' end;

  if new.tolerancia <> tol or new.capacidade <> cap or new.score <> score
     or new.perfil <> perfil or new.consistencia <> cons then
    raise exception 'perfil_adulterado' using errcode = '22023';
  end if;
  new.valido_ate := (current_date + interval '${P.meses_validade} months')::date;
  return new;
end $f$;
${MARCA_FIM}`;
}

const saida = gera();
const alvo = path.join(raiz, "supabase/schema.sql");
if (process.argv.includes("--escreve") || process.argv.includes("--confere")) {
  const atual = fs.readFileSync(alvo, "utf8");
  const a = atual.indexOf(MARCA_INI), b = atual.indexOf(MARCA_FIM);
  if (a < 0 || b < 0) { console.error("marcadores não encontrados em schema.sql"); process.exit(1); }
  const novo = atual.slice(0, a) + saida + atual.slice(b + MARCA_FIM.length);
  if (process.argv.includes("--confere")) {
    if (novo !== atual) { console.error("schema.sql desatualizado: rode node scripts/gera-perfil-sql.js --escreve"); process.exit(1); }
    console.log("schema.sql em dia com padroes.js");
  } else { fs.writeFileSync(alvo, novo); console.log("schema.sql atualizado"); }
} else console.log(saida);
