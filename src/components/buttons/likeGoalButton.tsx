'use client';

import { useToast } from "@/components/generic/toast/toastContext.use";
import { isStandardObject } from "@/types/typeguards";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Toggles the user's like on a goal and shows the goal's like count. The
 * server's values are the truth: the button follows them whenever they change
 * and refreshes the route after a toggle, so lists ranked by likes catch up.
 */
export default function LikeGoalButton({
  goalId,
  likeCount,
  liked,
  className,
  size = 20,
}: {
  goalId: string,
  likeCount: number,
  liked: boolean,
  className?: string,
  size?: number,
}) {
  const { t } = useTranslation(["components", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const [state, setState] = useState({ liked, likeCount });
  const [received, setReceived] = useState({ liked, likeCount });
  const [pending, setPending] = useState(false);

  // Fresh values from the server win over the last response
  if (received.liked !== liked || received.likeCount !== likeCount) {
    setReceived({ liked, likeCount });
    setState({ liked, likeCount });
  }

  async function toggle() {
    if (pending) return;
    setPending(true);
    const wasLiked = state.liked;
    // Optimistic: the request practically never fails
    setState(current => ({ liked: !wasLiked, likeCount: Math.max(0, current.likeCount + (wasLiked ? -1 : 1)) }));
    try {
      const response = await fetch("/api/goal-like", {
        method: wasLiked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(isStandardObject(body) && "message" in body && typeof body.message === "string" ? body.message : `${response.status}`);
      }
      if (isStandardObject(body) && "liked" in body && typeof body.liked === "boolean" && "likeCount" in body && typeof body.likeCount === "number") {
        setState({ liked: body.liked, likeCount: body.likeCount });
      }
      router.refresh();
    } catch (error) {
      setState({ liked: wasLiked, likeCount: state.likeCount });
      addToast(t("components:like_button.failed", { details: error instanceof Error ? error.message : String(error) }), "error", true);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={state.liked}
      aria-label={state.liked ? t("components:like_button.unlike") : t("components:like_button.like")}
      title={state.liked ? t("components:like_button.unlike") : t("components:like_button.like")}
      data-testid="goal-like-button"
      className={`transparent display-inline-flex align-items-center gap-25 padding-25 smooth ${className ?? ""}`}
      style={{ lineHeight: 1, color: state.liked ? 'var(--seagreen)' : 'inherit', opacity: pending ? 0.7 : 1 }}
    >
      {state.liked
        ? <IconHeartFilled aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} />
        : <IconHeart aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} />}
      <span data-testid="goal-like-count">{state.likeCount}</span>
    </button>
  );
}
