"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <li>
      <Link
        href={href}
        className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
          active
            ? "bg-brand-green text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
