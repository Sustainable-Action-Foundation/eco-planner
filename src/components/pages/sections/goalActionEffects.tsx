'use client';

import { ControlsMenu } from "@/components/elements/controls/controls";
import type { EffectMenuEntry } from "@/components/elements/controls/controls";
import { isUnitFlag, parseUnit } from "@/functions/unit";
import { ActionImpactType } from "@/lib/prisma/generated";
import type { Goal } from "@/types";
import type { AccessLevel } from "@/types/enums";
import { IconArrowNarrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

type GoalEffect = Goal["effects"][number];

/**
 * The goal page's list of actions affecting the goal: one collapsible row per action
 * (one effect joins an action to a goal, so rows and effects are one-to-one).
 * Collapsed, a row shows the action's name and timeframe; expanded, it shows the
 * effect on this goal (impact type and the year-by-year series).
 *
 * Renders purely from the effects already included in the goal fetch; expanding
 * a row fetches nothing.
 */
export default function GoalActionEffectList({
  effects,
  accessLevel,
  emptyMessage,
  testId,
}: {
  effects: GoalEffect[],
  accessLevel?: AccessLevel,
  /** Shown instead of the list when there are no effects */
  emptyMessage: string,
  /** Testid for the row <details> elements, so specs can tell the own and foreign lists apart */
  testId: string,
}) {
  const { t } = useTranslation(["components", "forms"]);

  if (!effects.length) {
    return <p>{emptyMessage}</p>;
  }

  // Inline enum record so every key stays literal for the locale scanner
  const impactTypeLabels: Record<ActionImpactType, string> = {
    [ActionImpactType.ABSOLUTE]: t("forms:effect.impact_types.absolute"),
    [ActionImpactType.DELTA]: t("forms:effect.impact_types.delta"),
    [ActionImpactType.PERCENT]: t("forms:effect.impact_types.percent"),
  };

  return (
    <ul className="margin-0 padding-0" style={{ listStyle: 'none' }}>
      {effects.map(effect => {
        const unit = parseUnit(effect.data_series?.unit);

        return (
          <li key={`${effect.action_id}_${effect.goal_id}`} className="margin-block-75">
            <div className="flex align-items-flex-start width-100">
              <details className="flex-grow-100 min-width-0" data-testid={testId}>
                <summary className="padding-25 smooth" style={{ cursor: 'pointer' }}>
                  <span className="font-weight-500">
                    {effect.action.name || t("components:effects_table.effect_missing_name")}
                  </span>
                  {effect.action.start_year && effect.action.end_year
                    ? <small className="color-gray margin-left-50">{effect.action.start_year} - {effect.action.end_year}</small>
                    : null}
                </summary>

                <div className="padding-50 margin-left-100 margin-block-25" style={{ borderLeft: '2px solid var(--gray-80)' }}>
                  <p className="margin-block-25 font-size-14px">
                    <span className="font-weight-500">{t("components:goal_actions.impact_type")}: </span>
                    {impactTypeLabels[effect.impact_type]}
                  </p>

                  {effect.data_series?.values.length ?
                    <div
                      className="grid padding-bottom-50 margin-top-50"
                      style={{
                        gridTemplateColumns: `repeat(${effect.data_series.values.length}, 1fr)`,
                        gridTemplateRows: 'auto auto',
                        overflowX: 'auto',
                        scrollbarWidth: 'thin',
                        contain: 'inline-size',
                        columnGap: '1rem',
                        fontSize: '14px',
                      }}
                    >
                      {effect.data_series.values.map((entry, i) => (
                        <div
                          key={`header-${entry.timestamp.toISOString()}`}
                          className={`font-weight-600 text-align-center ${i === 0 ? "" : "padding-left-100"}`}
                          style={{ gridRow: 1, borderLeft: i === 0 ? 'none' : '1px solid var(--gray-70)' }}
                        >
                          {new Date(entry.timestamp).getUTCFullYear()}
                          {!isUnitFlag(unit) && i === 0 ? <small className="font-weight-normal color-gray"> ({unit})</small> : null}
                        </div>
                      ))}
                      {effect.data_series.values.map((entry, i) => (
                        <div
                          key={`value-${entry.timestamp.toISOString()}`}
                          className={`text-align-center ${i === 0 ? "" : "padding-left-100"}`}
                          style={{ gridRow: 2, borderLeft: i === 0 ? 'none' : '1px solid var(--gray-70)' }}
                        >
                          {entry.value?.toFixed(1) ?? "-"}
                        </div>
                      ))}
                    </div>
                    : <p className="margin-block-25 font-size-14px color-gray">{t("components:goal_actions.no_data_series")}</p>
                  }

                  <Link href={`/action/${effect.action_id}`} className="discrete-link flex gap-25 align-items-center font-size-14px" style={{ width: 'fit-content' }}>
                    {t("components:goal_actions.view_action")}
                    <IconArrowNarrowRight width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
                  </Link>
                </div>
              </details>

              <ControlsMenu
                accessLevel={accessLevel}
                // The embedded effect carries everything ControlsMenu reads at runtime,
                // but goal-embedded effects only expose the action relation, so we
                // assert the menu-entry shape directly (same as the action page's table).
                object={effect as unknown as EffectMenuEntry}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
