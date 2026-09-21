import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret } from "./secrets";

const KEY = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("decifra de volta o que cifrou", () => {
    const secret = "chave-secreta-da-binance-12345";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("preserva acento e caractere especial", () => {
    const secret = 'çãé!@#$%^&*()_+{}"|<>?';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("gera ciphertext diferente a cada chamada, mesmo para o mesmo texto", () => {
    const a = encryptSecret("mesmo-segredo");
    const b = encryptSecret("mesmo-segredo");

    // IV novo por operação — reusar IV em GCM quebra a cifra.
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rejeita ciphertext adulterado em vez de devolver lixo", () => {
    const encrypted = encryptSecret("segredo");
    encrypted.ciphertext[0] ^= 0xff;

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("rejeita tag de autenticação adulterada", () => {
    const encrypted = encryptSecret("segredo");
    encrypted.ciphertext[encrypted.ciphertext.length - 1] ^= 0xff;

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("não decifra com outra chave", () => {
    const encrypted = encryptSecret("segredo");
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("recusa chave com tamanho errado, dizendo o que fazer", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });

  it("recusa rodar sem chave configurada", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("detecta registro corrompido antes de tentar decifrar", () => {
    expect(() => decryptSecret({ ciphertext: Buffer.alloc(4), iv: Buffer.alloc(12) })).toThrow(
      /curto demais/,
    );
    expect(() => decryptSecret({ ciphertext: Buffer.alloc(40), iv: Buffer.alloc(5) })).toThrow(
      /IV/,
    );
  });
});

describe("maskSecret", () => {
  it("mostra só as pontas de uma chave longa", () => {
    expect(maskSecret("abcd1234567890wxyz")).toBe("abcd••••••••wxyz");
  });

  it("esconde por completo uma chave curta", () => {
    expect(maskSecret("abc")).toBe("••••••••");
    expect(maskSecret("12345678")).toBe("••••••••");
  });
});
