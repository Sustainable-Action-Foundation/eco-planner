'use client';

import styles from "./likeGoalButton.module.css" with { type: "css" };
import { useToast } from "@/components/generic/toast/toastContext.use";
import { likeAspectDescription, likeAspectLabel } from "@/functions/likeAspect";
import { LikeAspect } from "@/types/enums";
import { isStandardObject } from "@/types/typeguards";
import { IconChevronDown, IconChevronUp, IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type LikeState = { liked: boolean, likeCount: number, aspects: LikeAspect[] };

/** The like state in a response from /api/goal-like, if it is one */
function parseLikeResponse(body: unknown): LikeState | null {
  if (!isStandardObject(body) || !("liked" in body) || typeof body.liked !== "boolean" || !("likeCount" in body) || typeof body.likeCount !== "number") return null;
  const aspects = "aspects" in body && Array.isArray(body.aspects) ? body.aspects : [];
  return { liked: body.liked, likeCount: body.likeCount, aspects: Object.values(LikeAspect).filter(aspect => aspects.includes(aspect)) };
}

/** The error message of a failed response */
function failure(body: unknown, status: number): Error {
  return new Error(isStandardObject(body) && "message" in body && typeof body.message === "string" ? body.message : `${status}`);
}

/**
 * Toggles the user's like on a goal and shows the goal's like count. Once the
 * goal is liked, an optional row of aspects opens: through which kinds of
 * rådighet (ability to act, see `LikeAspect`) the user's org can act on the
 * goal. The like counts with or without them. The server's values are the
 * truth: the button follows them whenever they change and refreshes the route
 * after a change, so lists ranked by likes catch up.
 */
export default function LikeGoalButton({
  goalId,
  liked,
  likeCount,
  aspects = [],
  className,
  size = 20,
  layout = "stacked",
}: {
  goalId: string,
  liked: boolean,
  likeCount: number,
  /** The aspects of the user's like */
  aspects?: LikeAspect[],
  className?: string,
  size?: number,
  /**
   * `stacked`: the aspects open under the button, right-aligned (goal page).
   * `row`: inside a wrapping flex row, the open aspects take a full line of their own
   * below the row instead of widening the button's cell
   */
  layout?: "stacked" | "row",
}) {
  const { t } = useTranslation(["components", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const aspectsId = useId();
  const [state, setState] = useState<LikeState>({ liked, likeCount, aspects });
  const [received, setReceived] = useState<LikeState>({ liked, likeCount, aspects });
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // The aspect set last asked for, and whether a request is carrying it; rapid toggles send the latest set once the previous request is done
  const wantedAspects = useRef<LikeAspect[] | null>(null);
  const savingAspects = useRef(false);

  // Fresh values from the server win over the last response
  if (received.liked !== liked || received.likeCount !== likeCount || received.aspects.join() !== aspects.join()) {
    setReceived({ liked, likeCount, aspects });
    setState({ liked, likeCount, aspects });
  }

  async function send(method: "POST" | "DELETE", body: object): Promise<LikeState | null> {
    const response = await fetch("/api/goal-like", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, ...body }),
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) throw failure(json, response.status);
    return parseLikeResponse(json);
  }

  async function toggle() {
    if (pending) return;
    setPending(true);
    const before = state;
    // Optimistic: the request practically never fails
    setState({ liked: !before.liked, likeCount: Math.max(0, before.likeCount + (before.liked ? -1 : 1)), aspects: [] });
    // A fresh like asks for its aspects right away
    setExpanded(!before.liked);
    try {
      const result = await send(before.liked ? "DELETE" : "POST", {});
      if (result) setState(result);
      router.refresh();
    } catch (error) {
      setState(before);
      addToast(t("components:like_button.failed", { details: error instanceof Error ? error.message : String(error) }), "error", true);
    } finally {
      setPending(false);
    }
  }

  async function toggleAspect(aspect: LikeAspect) {
    const current = wantedAspects.current ?? state.aspects;
    const next = Object.values(LikeAspect).filter(item => item === aspect ? !current.includes(item) : current.includes(item));
    wantedAspects.current = next;
    setState(previous => ({ ...previous, aspects: next }));
    if (savingAspects.current) return;

    savingAspects.current = true;
    const confirmed = state;
    try {
      let result: LikeState | null = null;
      let sent: LikeAspect[] | null = null;
      while (wantedAspects.current && wantedAspects.current !== sent) {
        sent = wantedAspects.current;
        result = await send("POST", { aspects: sent });
      }
      // Only the latest set's answer is shown, so earlier ones can't flicker back
      if (result) setState(result);
      router.refresh();
    } catch (error) {
      setState(confirmed);
      addToast(t("components:like_button.failed", { details: error instanceof Error ? error.message : String(error) }), "error", true);
    } finally {
      wantedAspects.current = null;
      savingAspects.current = false;
    }
  }

  return (
    <div className={`${layout === "row" ? styles.row : styles.wrapper} ${className ?? ""}`} data-testid="goal-like">
      <div className="display-inline-flex align-items-center gap-25">
        <button
          type="button"
          onClick={() => void toggle()}
          aria-pressed={state.liked}
          aria-label={state.liked ? t("components:like_button.unlike") : t("components:like_button.like")}
          title={state.liked ? t("components:like_button.unlike") : t("components:like_button.like")}
          data-testid="goal-like-button"
          className="transparent display-inline-flex align-items-center gap-25 padding-25 smooth"
          style={{ lineHeight: 1, color: state.liked ? 'var(--seagreen)' : 'inherit', opacity: pending ? 0.7 : 1 }}
        >
          {state.liked
            ? <IconHeartFilled aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} />
            : <IconHeart aria-hidden="true" width={size} height={size} style={{ minWidth: `${size}px` }} />}
          <span data-testid="goal-like-count">{state.likeCount}</span>
        </button>
        {state.liked ?
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={aspectsId}
            title={expanded ? t("components:like_button.aspects_hide") : t("components:like_button.aspects_show")}
            data-testid="goal-like-aspects-toggle"
            className={`transparent display-inline-flex align-items-center gap-25 smooth color-gray ${styles.toggle}`}
          >
            {state.aspects.length > 0
              ? t("components:like_button.aspects_toggle_count", { count: state.aspects.length })
              : t("components:like_button.aspects_toggle")}
            {expanded
              ? <IconChevronUp aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />
              : <IconChevronDown aria-hidden="true" width={14} height={14} style={{ minWidth: '14px' }} />}
          </button>
          : null}
      </div>
      {state.liked && expanded ?
        <div id={aspectsId} role="group" aria-label={t("components:like_button.aspects_label")} className={styles.aspects} data-testid="goal-like-aspects">
          <span className={styles.hint} aria-hidden="true">{t("components:like_button.aspects_label")}</span>
          {Object.values(LikeAspect).map(aspect => {
            const label = likeAspectLabel(t, aspect);
            const pressed = state.aspects.includes(aspect);
            return (
              <button
                key={aspect}
                type="button"
                className={styles.chip}
                aria-pressed={pressed}
                title={`${label}: ${likeAspectDescription(t, aspect)}`}
                data-aspect={aspect}
                onClick={() => void toggleAspect(aspect)}
              >
                {label}
              </button>
            );
          })}
        </div>
        : null}
    </div>
  );
}
