import {
  BookOpen,
  Calculator,
  Eye,
  LayoutDashboard,
  LineChart,
  PieChart,
  Scale,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do mobile. */
  primary?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Navegacao unica do app. Agrupada em quatro secoes curtas para nenhuma tela
 * ficar a mais de dois cliques, como pede o planejamento.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Carteira",
    items: [
      { href: "/", label: "Visão geral", icon: LayoutDashboard, primary: true },
      { href: "/investimentos", label: "Investimentos", icon: Wallet, primary: true },
      { href: "/rebalanceamento", label: "Rebalanceamento", icon: Scale },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/analise", label: "Análise de ativos", icon: LineChart, primary: true },
      { href: "/watchlist", label: "Watchlist", icon: Eye },
      { href: "/journal", label: "Journal", icon: BookOpen },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/gastos", label: "Gastos", icon: PieChart, primary: true },
      { href: "/simulador", label: "Simulador de venda", icon: Calculator },
      { href: "/projecao", label: "Projeção", icon: TrendingUp },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const PRIMARY_NAV: NavItem[] = NAV_ITEMS.filter((item) => item.primary);

export const SECONDARY_NAV: NavItem[] = NAV_ITEMS.filter((item) => !item.primary);

/** A rota `/` so casa exata; as outras casam com as subrotas. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
