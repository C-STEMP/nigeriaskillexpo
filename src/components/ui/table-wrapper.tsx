import type { ReactNode } from "react";

export function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto md:overflow-clip rounded-xl border border-grey bg-white">
      {children}
    </div>
  );
}
