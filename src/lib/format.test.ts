import { describe, expect, it } from "vitest";
import {
  brl,
  date,
  monthLabel,
  percent,
  quantity,
  signedBrl,
  signedPercent,
  trend,
} from "./format";

/** O espaço do Intl em pt-BR é NBSP — normalizar evita teste frágil. */
const clean = (value: string) => value.replace(/ /g, " ");

describe("format", () => {
  it("formata moeda em pt-BR", () => {
    expect(clean(brl(1234.5))).toBe("R$ 1.234,50");
    expect(clean(brl(-99))).toBe("-R$ 99,00");
  });

  it("formata percentual a partir de fração", () => {
    expect(clean(percent(0.0525))).toBe("5,25%");
  });

  it("usa sinal explícito na variação, para não depender só de cor", () => {
    expect(clean(signedPercent(0.0125))).toBe("+1,25%");
    expect(clean(signedPercent(-0.0125))).toBe("−1,25%");
    expect(clean(signedPercent(0))).toBe("0,00%");
    expect(clean(signedBrl(-50))).toBe("−R$ 50,00");
  });

  it("mostra casas decimais só quando a quantidade precisa", () => {
    expect(quantity(100)).toBe("100");
    expect(quantity(0.015)).toBe("0,015");
  });

  it("formata data sem depender de fuso horário", () => {
    expect(date("2026-09-21")).toBe("21/09/2026");
    expect(date("2026-01-01T23:00:00Z")).toBe("01/01/2026");
    expect(monthLabel("2026-09")).toBe("set/26");
  });

  it("classifica a direção da variação", () => {
    expect(trend(0.01)).toBe("up");
    expect(trend(-0.01)).toBe("down");
    expect(trend(0)).toBe("flat");
  });
});
