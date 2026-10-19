import type { EncryptionConfig } from "../models/Task";

const VERIFIER = "gestor-tareas:contraseña-correcta:v1";

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error("El cifrado requiere HTTPS o localhost y WebCrypto.");
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
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
    const iterations = 600_000;
    const key = await deriveKey(password, salt, iterations);
    const { ciphertext, iv } = await encrypt(key, VERIFIER);
    // La clave solo se conserva si el almacenamiento de la configuración tuvo éxito.
    return { id: "encryption", version: 1, iterations, kdf: "PBKDF2-SHA256", cipher: "AES-GCM-256", salt, verifierCiphertext: ciphertext, verifierIv: iv };
  }

  async unlock(password: string, config: EncryptionConfig): Promise<void> {
    this.key = undefined;
    // Configuraciones previas no guardaban metadatos y usaban 100 000 iteraciones.
    const iterations = config.iterations ?? 100_000;
    if ((config.version !== undefined && config.version !== 1) ||
      (config.kdf !== undefined && config.kdf !== "PBKDF2-SHA256") ||
      (config.cipher !== undefined && config.cipher !== "AES-GCM-256") ||
      !Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000 ||
      !(config.salt instanceof Uint8Array) || config.salt.length !== 16 ||
      !(config.verifierIv instanceof Uint8Array) || config.verifierIv.length !== 12) {
      throw new Error("Configuración de cifrado dañada o incompatible.");
    }
    const key = await deriveKey(password, config.salt, iterations);
    try {
      const value = await decrypt(key, config.verifierCiphertext, config.verifierIv);
      if (value !== VERIFIER) throw new Error("Contraseña incorrecta");
    } catch {
      throw new Error("Contraseña incorrecta o comprobante cifrado dañado.");
    }
    this.key = key;
  }

  async encryptNote(text: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    if (!this.key) throw new Error("Las notas están bloqueadas");
    return encrypt(this.key, text);
  }

  async decryptNote(ciphertext: ArrayBuffer, iv: Uint8Array): Promise<string> {
    if (!this.key) throw new Error("Las notas están bloqueadas");
    try { return await decrypt(this.key, ciphertext, iv); }
    catch { throw new Error("No se pudo descifrar la nota: los datos pueden estar dañados."); }
  }
}
