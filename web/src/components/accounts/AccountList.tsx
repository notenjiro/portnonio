import { useEffect, useState } from "react";
import { fetchAccounts } from "@/lib/api";

export default function AccountList({ refreshKey }: { refreshKey: number }) {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchAccounts().then((res) => {
      setAccounts(res ?? []);
    });
  }, [refreshKey]);

  if (!accounts.length) {
    return (
      <p className="text-sm text-[#f0b90b]">
        No accounts connected yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {accounts.map((acc) => (
        <div
          key={acc.id}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#222] px-4 py-3 shadow-sm"
        >
          {/* icon */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
            {acc.name?.charAt(0)?.toUpperCase()}
          </div>

          {/* name */}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-[#f0b90b]">
              {acc.name}
            </span>

            <span className="text-xs text-[#f0b90b]">
              
            </span>
          </div>

          {/* badge */}
          <span className="ml-2 rounded-full bg-[#f0b90b] px-2 py-0.5 text-xs font-medium text-slate-900">
            {acc.provider?.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}