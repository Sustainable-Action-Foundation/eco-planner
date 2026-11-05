import { likeAspectDescription, likeAspectLabel } from "@/functions/likeAspect";
import { LikeAspect } from "@/types/enums";
import type { TFunction } from "i18next";
import { Fragment } from "react";

/**
 * A collapsed explanation of every like aspect, for wherever the aspects are picked or
 * filtered on. Renders on the server and the client alike; `t` needs the common namespace.
 */
export default function LikeAspectLegend({ t, className }: { t: TFunction, className?: string }) {
  return (
    <details className={className} data-testid="like-aspect-legend">
      <summary className="font-size-14px color-gray" style={{ cursor: 'pointer', width: 'fit-content' }}>{t("common:like_aspect.legend_summary")}</summary>
      <dl className="margin-block-25 font-size-14px" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '.75rem', rowGap: '.25rem', textAlign: 'left' }}>
        {Object.values(LikeAspect).map(aspect => (
          <Fragment key={aspect}>
            <dt className="font-weight-500">{likeAspectLabel(t, aspect)}</dt>
            <dd className="margin-0 color-gray">{likeAspectDescription(t, aspect)}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}
