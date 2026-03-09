import React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <main className="w-full max-w-2xl flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
