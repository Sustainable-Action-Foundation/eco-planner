"use client";

import { IconArrowRight, IconLoader2 } from "@tabler/icons-react";
import Link, { useLinkStatus } from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./pendingLink.module.css";

/** The trailing icon slot: a spinner while the surrounding Link's navigation is in flight. */
function StatusIcon({ idle, size }: { idle: ReactNode, size: number }) {
  const { pending } = useLinkStatus();
  if (!pending) return idle;
  return <IconLoader2 data-pending="true" aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} className={styles.spinner} />;
}

/**
 * A `Link` for slow destinations, like the goal form's prefill which fetches
 * per-area statistics before it can render: while the navigation is in
 * flight the trailing icon becomes a spinner and further clicks are ignored,
 * so the click visibly did something instead of "nothing happens".
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
      <StatusIcon idle={idleIcon} size={iconSize} />
    </Link>
  );
}
