import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia dos tokens de terceiros antes de irem para o banco.
 *
 * AES-256-GCM: além de cifrar, autentica — um ciphertext adulterado falha na
 * verificação em vez de decifrar em lixo silencioso. Isso importa aqui porque
 * o texto decifrado vira uma chave de API que sai para a internet.
 *
 * Só roda no servidor. A chave vem de `TOKEN_ENCRYPTION_KEY`, que nunca tem
 * prefixo `NEXT_PUBLIC_`.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, o tamanho recomendado para GCM
const KEY_LENGTH = 32; // 256 bits

export interface EncryptedSecret {
  /** Ciphertext seguido da tag de autenticação de 16 bytes. */
  ciphertext: Buffer;
  iv: Buffer;
}

function encryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY não definida. Gere com `openssl rand -base64 32` e coloque no .env.local.",
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64 (tem ${key.length}). Gere com \`openssl rand -base64 32\`.`,
    );
  }

  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  // IV novo a cada operação: reusar IV em GCM quebra a cifra por completo.
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return { ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]), iv };
}

export function decryptSecret({ ciphertext, iv }: EncryptedSecret): string {
  if (iv.length !== IV_LENGTH) {
    throw new Error("IV com tamanho inválido — registro corrompido.");
  }
  if (ciphertext.length <= 16) {
    throw new Error("Ciphertext curto demais para conter a tag de autenticação.");
  }

  const tag = ciphertext.subarray(ciphertext.length - 16);
  const body = ciphertext.subarray(0, ciphertext.length - 16);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/**
 * Mostra só o suficiente para o usuário reconhecer a chave que cadastrou, sem
 * reexibir o segredo. Chave curta demais vira só asteriscos — melhor não
 * mostrar nada do que mostrar metade de um segredo.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(8);
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}
