import { CheckCircle2, CircleAlert, CircleDashed, KeyRound } from "lucide-react";
import { repo } from "@/lib/repo";
import { ASSET_CLASS_LABEL } from "@/types/domain";
import { percent } from "@/lib/format";
import { targetsAreValid } from "@/lib/finance";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WeightsPanel } from "@/components/configuracoes/weights-panel";
import { MfaPanel } from "@/components/configuracoes/mfa-panel";
import { usesSupabase } from "@/lib/supabase/env";

export const metadata = { title: "Configurações" };

const PROVIDER_LABEL = {
  pluggy: "Open Finance (Pluggy)",
  binance: "API Binance (somente leitura)",
  manual: "Lançamento manual",
} as const;

export default async function ConfiguracoesPage() {
  const [institutions, targets, fundamentals, assets, market] = await Promise.all([
    repo.getInstitutions(),
    repo.getAllocationTargets(),
    repo.getStockFundamentals(),
    repo.getAssets(),
    repo.getMarketContext(),
  ]);

  const names = Object.fromEntries(assets.map((a) => [a.id, a.symbol]));
  const targetsSum = targets.reduce((acc, t) => acc + t.target, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Contas conectadas, metas de alocação e os pesos do motor de análise."
      />

      {/* O 2FA depende da sessão do Supabase; no modo mock não há o que ativar. */}
      {usesSupabase() ? <MfaPanel /> : null}

      <Card>
        <CardHeader
          title="Contas conectadas"
          description="Open Finance atualiza a cada 24h; a Binance sincroniza por API com permissão de leitura."
        />
        <CardBody className="flex flex-col gap-2">
          {institutions.map((institution) => (
            <div
              key={institution.id}
              className="border-line flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-3.5 py-3"
            >
              <div className="flex items-center gap-3">
                {institution.status === "conectada" ? (
                  <CheckCircle2 aria-hidden className="text-positive size-4" />
                ) : institution.status === "manual" ? (
                  <CircleDashed aria-hidden className="text-faint size-4" />
                ) : (
                  <CircleAlert aria-hidden className="text-negative size-4" />
                )}
                <div>
                  <p className="text-[14px] font-medium">{institution.name}</p>
                  <p className="text-faint text-[12px]">{PROVIDER_LABEL[institution.provider]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {institution.lastSyncAt ? (
                  <span className="text-faint text-[12px]">
                    {new Date(institution.lastSyncAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
                <Badge
                  tone={
                    institution.status === "conectada"
                      ? "positive"
                      : institution.status === "manual"
                        ? "neutral"
                        : "negative"
                  }
                >
                  {institution.status === "conectada"
                    ? "Conectada"
                    : institution.status === "manual"
                      ? "Manual"
                      : institution.status === "expirada"
                        ? "Expirada"
                        : "Erro"}
                </Badge>
              </div>
            </div>
          ))}
        </CardBody>
        <CardFooter>
          O plano gratuito do Meu Pluggy permite até 5 conexões ativas. Tokens são criptografados
          antes de ir para o banco.
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Como gerar a chave da Binance"
          description="A plataforma nunca precisa de permissão de negociação ou saque."
        />
        <CardBody>
          <ol className="text-muted flex flex-col gap-2.5 text-[14px]">
            {[
              "Na Binance, abra o menu da sua conta e vá em API Management.",
              "Crie uma chave nova (System generated) e dê um nome que você reconheça depois.",
              'Em permissões, deixe marcado apenas "Enable Reading".',
              'Confirme que "Enable Spot & Margin Trading" e qualquer permissão de saque estão DESMARCADAS.',
              "Copie a API Key e a Secret Key e cole aqui — a Secret só aparece uma vez.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="tabular bg-sunken text-content flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-medium">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="bg-warning-soft text-warning mt-4 flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-[13px] leading-relaxed">
            <KeyRound aria-hidden className="mt-0.5 size-4 shrink-0" />
            Se uma chave com permissão de saque vazar, o dinheiro sai da corretora. Com permissão só
            de leitura, o pior caso é alguém ver o saldo.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Meta de alocação"
          description="Define o alvo de cada classe e alimenta a sugestão de rebalanceamento."
          action={
            <Badge tone={targetsAreValid(targets) ? "positive" : "negative"}>
              Soma {percent(targetsSum, 0)}
            </Badge>
          }
        />
        <CardBody className="flex flex-col gap-4">
          {targets.map((target) => (
            <div key={target.assetClass} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>{ASSET_CLASS_LABEL[target.assetClass]}</span>
                <span className="tabular font-medium">{percent(target.target, 0)}</span>
              </div>
              <Progress
                value={target.target}
                label={`Meta de ${ASSET_CLASS_LABEL[target.assetClass]}`}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <WeightsPanel fundamentals={fundamentals} names={names} market={market} />
    </div>
  );
}
