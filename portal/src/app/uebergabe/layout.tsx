import { requireVerwalter } from "@/lib/session";

export default async function UebergabeLayout({ children }: { children: React.ReactNode }) {
  await requireVerwalter();
  return <div className="bw-shell-bg min-h-screen">{children}</div>;
}
