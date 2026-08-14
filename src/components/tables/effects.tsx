'use client';

import type { Action, Goal } from "@/types";
import { AccessLevel } from "@/types/enums";
import Link from "next/link";
import { ControlsMenu } from "../elements/controls/controls";
import type { EffectMenuEntry } from "../elements/controls/controls";
import { useTranslation } from "react-i18next";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import type { ReactNode } from "@tabler/icons-react";
import { IconCaretRightFilled } from "@tabler/icons-react";
import { hasEditAccess } from "@/lib/accessChecker";

type EffectTableCommonProps = {
  accessLevel?: AccessLevel;
  object: Action | Goal;
};

/**
 * Displays a table of effects. Prefers using data from effect.action over effect.goal.
 * @param effects The effects to display
 * @param accessLevel The access level of the user
 */
export default function EffectTable({
  object,
  accessLevel,
}: EffectTableCommonProps): ReactNode {
  const { t } = useTranslation("components");

  // If no effects are found, show a message
  if (!object.effects.length) {
    return (
      <p>{t("components:effects_table.no_effects")}
        { // Only show the button if the user has edit access to the object
          hasEditAccess(accessLevel ?? AccessLevel.None)
          && <span> {t("components:effects_table.wanna_create_effect")}&nbsp;
            <Link
              href={"fields" in object
                ? `/effect/create?actionId=${object.id}`
                : `/effect/create?goalId=${object.id}`}
            >
              {t("components:effects_table.create_new_effect")}
            </Link>
          </span>
        }
      </p>
    );
  }

  return (
    <ul className={`${styles['roadmap-nav-ul']}`} style={{ paddingInlineStart: '0' }}>
      {object.effects.map(effect => {
        const action: Goal["effects"][number]["action"] | null = (effect as Goal["effects"][number]).action ?? null;
        const goal: Action["effects"][number]["goal"] | null = (effect as Action["effects"][number]).goal ?? null;

        if (!action && !goal) return null;

        return (
          <li key={`${effect.action_id}_${effect.goal_id}`} className="margin-block-75">
            <div className='flex justify-content-space-between align-items-center width-100'>
              <IconCaretRightFilled fill="lightgray" aria-hidden="true" className="margin-inline-25 padding-25" style={{ minWidth: '24px' }} />
              <Link
                href={"fields" in object
                  ? `/goal/${effect.goal_id}`
                  : `/action/${effect.action_id}`
                }
                className="font-weight-500 color-pureblack text-decoration-none flex-grow-100 inline-block padding-25 smooth">
                <span>
                  {
                    action?.name
                    ?? (
                      goal?.name
                      || goal?.indicator_parameter
                    )
                    ?? t("components:effects_table.effect_missing_name")
                  }
                </span>
                <br />
                {
                  action?.start_year && action?.end_year
                    ? <small className="color-gray">{action?.start_year} - {action?.end_year}</small>
                    : null
                }
              </Link>
              <ControlsMenu
                accessLevel={accessLevel}
                // The embedded effect carries everything ControlsMenu reads at runtime,
                // but action/goal-embedded effects each expose only their counterpart
                // relation, so we assert the menu-entry shape directly.
                object={effect as unknown as EffectMenuEntry}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}