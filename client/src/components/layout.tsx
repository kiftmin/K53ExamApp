import React from "react";
import { SlideoutNav } from "@/components/slideout-nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <SlideoutNav />
      <main className="w-full max-w-2xl flex-1 flex flex-col pb-24 pt-10">
        {children}
      </main>
    </div>
  );
}
