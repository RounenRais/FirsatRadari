"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary">
            Fırsat<span className="text-accent">Radarı</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-4 sm:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ana Sayfa
          </Link>
          <Link
            href="/api"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Kampanyaları Güncelle
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="sm:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menü"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 px-4 py-3 sm:hidden dark:border-slate-800">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setMenuOpen(false)}
          >
            Ana Sayfa
          </Link>
          <Link
            href="/api"
            className="mt-1 block rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-dark"
            onClick={() => setMenuOpen(false)}
          >
            Kampanyaları Güncelle
          </Link>
        </div>
      )}
    </nav>
  );
}
