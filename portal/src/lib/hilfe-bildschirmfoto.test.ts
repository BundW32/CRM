import { describe, expect, it } from "vitest";
import { FOTO_MAX_BASE64, parseBildschirmfoto } from "./hilfe-bildschirmfoto";

// 1×1-Pixel-JPEG, Base64.
const JPEG =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

describe("parseBildschirmfoto", () => {
  it("macht aus einer JPEG-Daten-URL einen Anhang", () => {
    const a = parseBildschirmfoto(`data:image/jpeg;base64,${JPEG}`);
    expect(a?.filename).toBe("bildschirmfoto.jpg");
    expect(a?.contentType).toBe("image/jpeg");
    expect(a?.content.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it("nimmt auch PNG", () => {
    const a = parseBildschirmfoto("data:image/png;base64,iVBORw0KGgo=");
    expect(a?.filename).toBe("bildschirmfoto.png");
    expect(a?.contentType).toBe("image/png");
  });

  it("lehnt andere Formate und Nicht-Bilder ab", () => {
    expect(parseBildschirmfoto("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(parseBildschirmfoto("data:text/html;base64,PGh0bWw+")).toBeNull();
    expect(parseBildschirmfoto("https://example.org/bild.jpg")).toBeNull();
    expect(parseBildschirmfoto("data:image/jpeg;base64,")).toBeNull();
    expect(parseBildschirmfoto("data:image/jpeg;base64,nicht base64!")).toBeNull();
  });

  it("ignoriert leere und fremde Werte", () => {
    expect(parseBildschirmfoto("")).toBeNull();
    expect(parseBildschirmfoto(null)).toBeNull();
    expect(parseBildschirmfoto(undefined)).toBeNull();
    expect(parseBildschirmfoto(42)).toBeNull();
  });

  it("lässt zu große Bilder weg, statt die Meldung zu blockieren", () => {
    const riesig = "A".repeat(FOTO_MAX_BASE64 + 4);
    expect(parseBildschirmfoto(`data:image/jpeg;base64,${riesig}`)).toBeNull();
  });
});
