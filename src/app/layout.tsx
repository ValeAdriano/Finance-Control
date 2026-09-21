import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Finance Control",
    template: "%s · Finance Control",
  },
  description:
    "Plataforma pessoal de gestão de investimentos e finanças: ações, FIIs, cripto, renda fixa, agro e controle de gastos em um lugar só.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` é exigido pelo next-themes: ele escreve a
     * classe do tema no <html> antes da hidratação para não piscar branco.
     */
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
