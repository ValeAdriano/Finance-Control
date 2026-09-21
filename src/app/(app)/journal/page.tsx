import Link from "next/link";
import { repo } from "@/lib/repo";
import { date } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Journal" };

/**
 * Journal de investimento: por que comprou, por que vendeu, o que mudou na
 * tese. E o registro que evita reescrever a historia depois do resultado.
 */
export default async function JournalPage() {
  const [entries, assets] = await Promise.all([repo.getJournalEntries(), repo.getAssets()]);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Journal"
        description="A tese por trás de cada decisão, com data. Releia antes de vender no susto."
      />

      {entries.length > 0 ? (
        <ol className="flex flex-col gap-4">
          {entries.map((entry) => {
            const asset = entry.assetId ? assetById.get(entry.assetId) : null;
            return (
              <li key={entry.id}>
                <Card as="article">
                  <CardBody className="flex flex-col gap-2 pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <time className="text-faint text-[12px]" dateTime={entry.date}>
                        {date(entry.date)}
                      </time>
                      {asset ? (
                        <Link href={`/ativos/${asset.slug}`}>
                          <Badge tone="accent">{asset.symbol}</Badge>
                        </Link>
                      ) : (
                        <Badge>Carteira</Badge>
                      )}
                      {entry.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                    <h2 className="text-[17px] font-semibold tracking-tight">{entry.title}</h2>
                    <p className="text-muted max-w-[72ch] text-[15px] leading-relaxed">
                      {entry.body}
                    </p>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <Card>
          <EmptyState
            title="Nenhuma anotação ainda"
            description="Registre a tese junto com a compra — é o que permite avaliar a decisão depois, sem viés de retrospectiva."
          />
        </Card>
      )}
    </div>
  );
}
