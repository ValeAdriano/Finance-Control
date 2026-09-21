import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

/**
 * Identificação de quem está logado e saída. Server Component: o e-mail vem da
 * sessão já validada no servidor, não de estado no cliente.
 */
export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted hidden max-w-[180px] truncate text-[13px] sm:block">{email}</span>
      <form action={signOut}>
        <button
          type="submit"
          title="Sair"
          aria-label="Sair"
          className="text-faint hover:bg-sunken hover:text-content flex size-9 items-center justify-center rounded-full transition-colors"
        >
          <LogOut aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}
