import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NewAssetForm } from "@/components/carteira/new-asset-form";

export const metadata = { title: "Novo ativo" };

export default function NovoAtivoPage() {
  return (
    <div className="flex max-w-[680px] flex-col gap-6">
      <div>
        <Link
          href="/investimentos"
          className="text-muted hover:text-content mb-3 inline-flex items-center gap-1.5 text-[13px]"
        >
          <ArrowLeft aria-hidden className="size-4" /> Investimentos
        </Link>
        <PageHeader
          title="Adicionar ativo"
          description="Lançamento manual, sem depender de nenhuma integração."
        />
      </div>

      <NewAssetForm />
    </div>
  );
}
