/* Conexão com o Supabase.
 *
 * Esta chave é a PUBLICÁVEL: foi feita para ficar no navegador. Ela
 * sozinha não lê nada — todas as tabelas têm RLS e só respondem ao
 * usuário logado, dono de cada linha. A chave secreta nunca entra aqui.
 */
window.FC = window.FC || {};
FC.config = {
  supabaseUrl: "https://ahbftafpbailgmjughsq.supabase.co",
  supabaseChave: "sb_publishable_-fQlrxL4xhR_iURRWwisyg_R7k4DJUf",
};
