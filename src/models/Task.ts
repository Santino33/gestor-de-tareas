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
  salt: Uint8Array;
  verifierCiphertext: ArrayBuffer;
  verifierIv: Uint8Array;
}
