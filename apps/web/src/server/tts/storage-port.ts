export interface Storage {
  head(key: string): Promise<boolean>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getText(key: string): Promise<string | null>;
  getBytes(key: string, destPath: string): Promise<void>;
  publicUrl(key: string): string;
}
