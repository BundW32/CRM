// Darstellung eines Handbuch-Kapitels aus dem Baum von `lib/hilfe/markdown.ts`.
//
// Server-Komponente ohne Zustand. Interne Links (`/…`) werden zu <Link>,
// äußere öffnen in einem neuen Fenster. Die Optik folgt den Karten des
// Portals; ein Kapitel ist ein langer Text, deshalb bekommt es eine
// Lesebreite und großzügigere Zeilenabstände als ein Formular.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/hilfe/markdown";

function zeichneInline(kinder: Inline[]): ReactNode[] {
  return kinder.map((k, i) => {
    switch (k.art) {
      case "text":
        return k.text;
      case "fett":
        return <strong key={i} className="font-semibold text-gray-900">{zeichneInline(k.kinder)}</strong>;
      case "kursiv":
        return <em key={i}>{zeichneInline(k.kinder)}</em>;
      case "code":
        return (
          <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.85em] text-gray-800">
            {k.text}
          </code>
        );
      case "link":
        if (k.href.startsWith("/") || k.href.startsWith("#")) {
          return (
            <Link key={i} href={k.href} className="font-medium text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green">
              {zeichneInline(k.kinder)}
            </Link>
          );
        }
        return (
          <a key={i} href={k.href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-green underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green">
            {zeichneInline(k.kinder)}
          </a>
        );
    }
  });
}

export function HandbuchInhalt({ bloecke }: { bloecke: Block[] }) {
  return (
    <div className="max-w-prose space-y-4 text-[15px] leading-relaxed text-gray-700">
      {bloecke.map((b, i) => {
        switch (b.art) {
          case "ueberschrift":
            return b.ebene === 2 ? (
              <h2 key={i} id={b.id} className="scroll-mt-6 pt-4 text-lg font-semibold text-gray-900 first:pt-0">
                {zeichneInline(b.kinder)}
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="scroll-mt-6 pt-2 text-base font-semibold text-gray-900">
                {zeichneInline(b.kinder)}
              </h3>
            );
          case "absatz":
            return <p key={i}>{zeichneInline(b.kinder)}</p>;
          case "liste":
            return b.nummeriert ? (
              <ol key={i} className="list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-brand-green">
                {b.punkte.map((p, j) => (
                  <li key={j} className="pl-1">{zeichneInline(p)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-gray-400">
                {b.punkte.map((p, j) => (
                  <li key={j} className="pl-1">{zeichneInline(p)}</li>
                ))}
              </ul>
            );
          case "zitat":
            return (
              <div key={i} className="rounded-xl border-l-4 border-brand-orange bg-brand-orange-light/40 px-4 py-3 text-sm text-gray-800">
                {zeichneInline(b.kinder)}
              </div>
            );
          case "tabelle":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      {b.kopf.map((z, j) => (
                        <th key={j} className="py-2 pr-4 font-semibold">{zeichneInline(z)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.zeilen.map((zeile, j) => (
                      <tr key={j} className="border-b border-gray-100 align-top">
                        {zeile.map((z, k) => (
                          <td key={k} className="py-2 pr-4">{zeichneInline(z)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "linie":
            return <hr key={i} className="border-gray-200" />;
        }
      })}
    </div>
  );
}
