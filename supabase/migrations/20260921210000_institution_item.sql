-- =============================================================================
-- Vínculo da instituição com o item do Open Finance
--
-- A Pluggy identifica cada conexão de banco por um `item`. Sem guardar esse
-- id, não há como buscar extrato depois que o usuário conecta a conta pelo
-- widget.
-- =============================================================================

alter table institutions add column external_id text;

-- Uma conexão da Pluggy não pode virar duas instituições: o sync buscaria o
-- mesmo extrato duas vezes e o usuário veria a conta duplicada na tela.
create unique index institutions_user_external_unique
  on institutions (user_id, provider, external_id)
  where external_id is not null;

-- Data do lançamento mais antigo que ainda interessa importar. Sem isso, todo
-- sync pediria o extrato inteiro desde sempre — caro e desnecessário.
alter table institutions add column sync_from date;
