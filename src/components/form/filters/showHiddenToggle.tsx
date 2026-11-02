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

  const toggle = () => {
    const newParams = new URLSearchParams(window.location.search);
    if (checked) newParams.delete(showHiddenParam);
    else newParams.set(showHiddenParam, "true");
    const query = newParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    // Same pill as the landing's other filters (scope, aspect): green when on
    <button
      type="button"
      onClick={toggle}
      aria-pressed={checked}
      aria-busy={isPending}
      className={`button round smooth font-size-14px padding-block-25${checked ? ' seagreen color-purewhite font-weight-500' : ''} ${className ?? ""}`}
      data-testid="show-hidden-roadmaps"
    >
      {checked ? t("components:roadmap_filters.show_hidden_on") : t("components:roadmap_filters.show_hidden")}
    </button>
  );
}
