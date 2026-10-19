import type { EncryptionConfig } from "../models/Task";

const VERIFIER = "gestor-tareas:contraseña-correcta:v1";

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function encrypt(key: CryptoKey, text: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(text)
  );
  return { ciphertext, iv };
}

async function decrypt(key: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext);
  return new TextDecoder().decode(bytes);
}

export class NoteCrypto {
  private key?: CryptoKey;

  async createConfig(password: string): Promise<EncryptionConfig> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    const { ciphertext, iv } = await encrypt(key, VERIFIER);
    // La clave solo se conserva si el almacenamiento de la configuración tuvo éxito.
    return { id: "encryption", salt, verifierCiphertext: ciphertext, verifierIv: iv };
  }

  async unlock(password: string, config: EncryptionConfig): Promise<void> {
    const key = await deriveKey(password, config.salt);
    try {
      const value = await decrypt(key, config.verifierCiphertext, config.verifierIv);
      if (value !== VERIFIER) throw new Error("Contraseña incorrecta");
    } catch {
      throw new Error("Contraseña incorrecta");
    }
    this.key = key;
  }

  async encryptNote(text: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    if (!this.key) throw new Error("Las notas están bloqueadas");
    return encrypt(this.key, text);
  }

  async decryptNote(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
    if (!this.key) throw new Error("Las notas están bloqueadas");
    return decrypt(this.key, ciphertext, iv);
  }
}
