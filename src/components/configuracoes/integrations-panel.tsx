import { listCredentialStatus } from "@/lib/integrations/credentials";
import { IntegrationCard, type IntegrationDefinition } from "./integration-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

/**
 * Cadastro das chaves de integração.
 *
 * As chaves ficam aqui, na interface, e não em variável de ambiente: são do
 * usuário, trocam de tempos em tempos e precisam ser revogáveis sem deploy.
 * Cada uma é cifrada antes de ir para o banco e nunca volta para a tela — o
 * que aparece é só uma prévia mascarada.
 */

const INTEGRATIONS: IntegrationDefinition[] = [
  {
    provider: "brapi",
    title: "brapi.dev",
    description: "Cotação e fundamentos de ações e FIIs. O token é opcional.",
    href: "https://brapi.dev",
    hrefLabel: "Criar token grátis",
    quota:
      "Opcional: a brapi responde cotação sem token, com limite menor. Com token, são 15.000 requisições por ciclo mensal. As cotações ficam em cache no banco para não repetir chamada.",
    warning:
      "A brapi não recusa token inválido — ela devolve cotação com qualquer valor. Por isso o cadastro confere o formato, mas não tem como confirmar que o token está sendo aplicado.",
    fields: [{ name: "token", label: "Token", type: "password", placeholder: "Token da brapi" }],
    steps: [
      "Crie uma conta em brapi.dev.",
      "No painel, copie o token do plano gratuito — é uma sequência de letras e números.",
      "Cole aqui — ele fica cifrado no banco.",
    ],
  },
  {
    provider: "binance",
    title: "Binance",
    description: "Saldo e cotação das criptomoedas.",
    href: "https://www.binance.com/en/my/settings/api-management",
    hrefLabel: "Abrir API Management",
    quota: "A chave precisa ter permissão SOMENTE de leitura. A plataforma nunca negocia nem saca.",
    warning:
      "Se uma chave com permissão de saque vazar, o dinheiro sai da corretora. Com permissão só de leitura, o pior caso é alguém ver o saldo.",
    fields: [
      { name: "apiKey", label: "API Key", type: "text", placeholder: "Chave pública da API" },
      {
        name: "apiSecret",
        label: "Secret Key",
        type: "password",
        placeholder: "Só aparece uma vez na Binance",
      },
    ],
    steps: [
      "Na Binance, abra o menu da conta e vá em API Management.",
      "Crie uma chave nova (System generated) com um nome reconhecível.",
      'Em permissões, deixe marcado apenas "Enable Reading".',
      'Confirme que "Enable Spot & Margin Trading" e qualquer permissão de saque estão DESMARCADAS.',
      "Copie a API Key e a Secret Key e cole aqui — a Secret só aparece uma vez.",
    ],
  },
  {
    provider: "pluggy",
    title: "Pluggy — Open Finance",
    description: "Extrato e saldo do Banco Inter e outros bancos.",
    href: "https://www.pluggy.ai/meu-pluggy",
    hrefLabel: "Abrir Meu Pluggy",
    quota: "Até 5 conexões ativas no plano gratuito, com dados atualizados a cada 24h.",
    fields: [
      { name: "clientId", label: "Client ID", type: "text", placeholder: "Client ID da aplicação" },
      {
        name: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Client Secret",
      },
    ],
    steps: [
      "Acesse o Meu Pluggy e crie uma aplicação.",
      "Copie o Client ID e o Client Secret da aplicação.",
      "Cole aqui e depois conecte cada banco pelo fluxo do Open Finance.",
    ],
  },
];

export async function IntegrationsPanel() {
  const statuses = await listCredentialStatus();
  const byProvider = new Map(statuses.map((s) => [s.provider, s]));

  return (
    <Card>
      <CardHeader
        title="Integrações"
        description="As chaves são cifradas antes de ir para o banco e nunca voltam para a tela — o que aparece depois é só uma prévia."
      />
      <CardBody className="flex flex-col gap-3">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard
            key={integration.provider}
            definition={integration}
            status={byProvider.get(integration.provider) ?? null}
          />
        ))}
      </CardBody>
    </Card>
  );
}
