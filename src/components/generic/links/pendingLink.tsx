"use client";

import { IconArrowRight, IconLoader2 } from "@tabler/icons-react";
import Link, { useLinkStatus } from "next/link";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./pendingLink.module.css";

/**
 * How long a navigation may stay pending before the link gives up on the
 * client-side transition and loads the destination the plain way. A
 * transition React drops (the server stalled, the stream was cut) never
 * settles `useLinkStatus`, which would leave the spinner going forever with
 * nothing to tell the user; a full load at least shows the browser's own
 * progress and whatever the server answers.
 */
export const PENDING_NAVIGATION_LIMIT_MS = 30_000;

/** The trailing icon slot: a spinner while the surrounding Link's navigation is in flight, bounded by a full load of `href`. */
function StatusIcon({ idle, size, href }: { idle: ReactNode, size: number, href: string }) {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(() => window.location.assign(href), PENDING_NAVIGATION_LIMIT_MS);
    return () => clearTimeout(timeout);
  }, [pending, href]);

  if (!pending) return idle;
  return <IconLoader2 data-pending="true" aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} className={styles.spinner} />;
}

/**
 * A `Link` for slow destinations, like the goal form's prefill which fetches
 * per-area statistics before it can render: while the navigation is in
 * flight the trailing icon becomes a spinner and further clicks are ignored,
 * so the click visibly did something instead of "nothing happens". A
 * navigation pending longer than `PENDING_NAVIGATION_LIMIT_MS` falls back to a
 * full page load, so a dropped transition doesn't spin forever.
 */
export default function PendingLink({
  href,
  className,
  style,
  title,
  icon,
  iconSize = 18,
  children,
}: {
  href: string,
  className?: string,
  style?: CSSProperties,
  title?: string,
  /** The trailing icon while idle (an arrow by default), replaced by the spinner while pending */
  icon?: ReactNode,
  iconSize?: number,
  children: ReactNode,
}) {
  const idleIcon = icon ?? <IconArrowRight aria-hidden="true" width={iconSize} height={iconSize} style={{ minWidth: `${iconSize}px` }} />;
  return (
    <Link href={href} title={title} className={`${styles.link} ${className ?? ""}`} style={style}>
      {children}
      <StatusIcon idle={idleIcon} size={iconSize} href={href} />
    </Link>
  );
}
