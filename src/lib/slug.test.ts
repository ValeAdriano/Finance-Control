import { describe, expect, it } from "vitest";
import { assetSlug } from "./slug";

describe("assetSlug", () => {
  it("mantém ticker simples", () => {
    expect(assetSlug("PETR4")).toBe("petr4");
    expect(assetSlug("HGLG11")).toBe("hglg11");
  });

  it("resolve símbolo com espaço e sinal", () => {
    expect(assetSlug("CDB Inter 112% CDI")).toBe("cdb-inter-112-cdi");
    expect(assetSlug("Tesouro IPCA+ 2029")).toBe("tesouro-ipca-2029");
    expect(assetSlug("Safra de soja 26/27")).toBe("safra-de-soja-26-27");
  });

  it("remove acento", () => {
    expect(assetSlug("Ação Preferencial")).toBe("acao-preferencial");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(assetSlug("  PETR4  ")).toBe("petr4");
    expect(assetSlug("%%%")).toBe("");
  });
});
