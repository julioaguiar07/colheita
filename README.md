# Colheita de Caju

Ranking e folha de pagamento da colheita de castanha.

- `/` — ranking público (dia, 7 dias, 30 dias, mês; pódio, gráficos e perfil de cada pessoa)
- `/painel` — painel de lançamento (login): pesagens do dia, cadastro de pessoas, análise e folha

Site estático (HTML + JS, sem build) com Apache ECharts e Supabase.

- `config.js` — URL e chave pública do Supabase, nome da fazenda e início da safra
- `supabase-schema.sql` — tabelas, regras de acesso (RLS) e funções
- Para dar acesso de edição a outro e-mail: `insert into administradores (email) values ('...');`
