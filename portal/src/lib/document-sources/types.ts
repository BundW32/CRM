export type ExternalFile = {
  id: string; // eindeutige ID im externen System (für Deduplizierung)
  name: string; // Dateiname inkl. Endung
  mimeType: string;
  size: number;
  modifiedAt?: Date;
};

export interface DocumentConnector {
  source: "GDRIVE";
  listFiles(config: Record<string, unknown>): Promise<ExternalFile[]>;
  downloadFile(fileId: string, config: Record<string, unknown>): Promise<Buffer>;
}
