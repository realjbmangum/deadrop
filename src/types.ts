export interface StoredSecret {
  ciphertext: string;
  iv: string;
  viewLimit: number;
  viewCount: number;
  expiresAt: number;
  createdAt: number;
}
