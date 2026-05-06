"use client";

import { IconSearch } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { useDebouncedCallback } from "use-debounce";

export default function SearchRoadmaps({labelledBy}: {labelledBy: string}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
 
  function updateStringParam(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);

    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }

    startTransition(() => {
      router.replace(`${pathname}?${newParams.toString()}`);
    });
  }

  const debouncedUpdateStringParam = useDebouncedCallback(updateStringParam, 300);

  return (
    <div className="margin-top-25 flex align-items-center padding-50 smooth focusable">
      <IconSearch width={20} height={20} style={{ minWidth: '20px' }} strokeWidth={1.5} aria-hidden="true" />
      <input /* TODO: Need this to be properly clickable considering it has no label... (also applies to actions page.) */
        aria-labelledby={labelledBy}
        type="search" 
        className="padding-0 margin-inline-50" 
        defaultValue={searchParams.get('searchFilter') ?? undefined} 
        onChange={(e) => {
          debouncedUpdateStringParam('searchFilter', e.target.value);
        }} 
      />
    </div>
  );
}