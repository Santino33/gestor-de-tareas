export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  createdAt: string;
  noteCiphertext?: ArrayBuffer;
  noteIv?: Uint8Array;
}

export interface EncryptionConfig {
  id: "encryption";
  version?: 1;
  iterations?: number;
  kdf?: "PBKDF2-SHA256";
  cipher?: "AES-GCM-256";
  salt: Uint8Array;
  verifierCiphertext: ArrayBuffer;
  verifierIv: Uint8Array;
}
