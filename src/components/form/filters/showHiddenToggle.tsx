'use client';

import { showHiddenParam } from "@/lib/listing";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";

/**
 * "Show hidden" for the roadmap listings: adds the hidden roadmaps the user can
 * write to (see `HiddenRoadmaps.Writable`). Lives in the URL like the other filters,
 * so the server decides what to fetch and the state survives back/forward.
 */
export default function ShowHiddenToggle({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation(["components"]);
  const [isPending, startTransition] = useTransition();

  const checked = searchParams.get(showHiddenParam) === "true";

  return (
    // The chip hides its checkbox, so the label carries the test id
    <label className={`chip ${className ?? ""}`} aria-busy={isPending} data-testid="show-hidden-roadmaps">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          const newParams = new URLSearchParams(window.location.search);
          if (e.target.checked) newParams.set(showHiddenParam, "true");
          else newParams.delete(showHiddenParam);
          const query = newParams.toString();
          startTransition(() => {
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
          });
        }}
      />
      {t("components:roadmap_filters.show_hidden")}
    </label>
  );
}
