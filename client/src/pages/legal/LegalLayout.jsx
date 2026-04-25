import React from "react";
import { Link } from "react-router-dom";

export default function LegalLayout({ title, updated, children }) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <Link
          to="/"
          className="text-sm font-bold text-purple-700 hover:text-purple-900"
        >
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
          {title}
        </h1>

        {updated && (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Last updated: {updated}
          </p>
        )}

        <div className="prose prose-slate mt-8 max-w-none prose-headings:font-black prose-a:text-purple-700">
          {children}
        </div>
      </div>
    </main>
  );
}
