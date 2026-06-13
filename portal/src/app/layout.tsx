import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "B&W Kundenportal",
  description:
    "Kundenportal der B&W Immobilien Management UG – für Mieter, Eigentümer und Verwaltung.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="bw-shell-bg flex min-h-full flex-col text-gray-100">
        {children}
      </body>
    </html>
  );
}
