import { SignJWT, importPKCS8 } from "jose";
import type { DocumentConnector, ExternalFile } from "./types";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

function getServiceAccount(): ServiceAccountJson {
  const raw = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GDRIVE_SERVICE_ACCOUNT_JSON ist nicht konfiguriert.");
  return JSON.parse(raw) as ServiceAccountJson;
}

async function getAccessToken(sa: ServiceAccountJson): Promise<string> {
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/drive.readonly",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth Fehler: ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type GDriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
};

type GDriveConfig = { folderId: string };

export const googleDriveConnector: DocumentConnector = {
  source: "GDRIVE",

  async listFiles(config: Record<string, unknown>): Promise<ExternalFile[]> {
    const { folderId } = config as GDriveConfig;
    const sa = getServiceAccount();
    const token = await getAccessToken(sa);

    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,size,modifiedTime)",
      pageSize: "200",
    });
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive API Fehler: ${res.status}`);

    const data = (await res.json()) as { files: GDriveApiFile[] };
    return (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? Number(f.size) : 0,
      modifiedAt: new Date(f.modifiedTime),
    }));
  },

  async downloadFile(fileId: string, _config: Record<string, unknown>): Promise<Buffer> {
    const sa = getServiceAccount();
    const token = await getAccessToken(sa);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive Download Fehler: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
};
