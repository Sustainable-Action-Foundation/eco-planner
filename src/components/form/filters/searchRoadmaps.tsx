"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import ListFilter from "@/components/form/filters/listFilter";

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
    <ListFilter
      className="margin-top-25"
      aria-labelledby={labelledBy}
      defaultValue={searchParams.get('searchFilter') ?? undefined}
      onChange={(e) => {
        debouncedUpdateStringParam('searchFilter', e.target.value);
      }}
    />
  );
}