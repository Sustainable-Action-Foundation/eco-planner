'use client';

import { AccessLevel } from "@/types.ts";
import { Action, Effect, Goal } from "@prisma/client";
import Link from "next/link";
import { TableMenu } from "./tableMenu/tableMenu.tsx";
import { useTranslation } from "react-i18next";
import styles from "@/components/tables/tables.module.css" with { type: "css" };
import { IconCaretRightFilled } from "@tabler/icons-react";

interface EffectTableComonProps {
  accessLevel?: AccessLevel,
  object: (Action | Goal) & {
    effects: (Effect & {
      action?: Action,
      goal?: Goal,
    })[],
  }
}

/**
 * Displays a table of effects. Prefers using data from effect.action over effect.goal.
 * @param effects The effects to display
 * @param accessLevel The access level of the user
 */
export default function EffectTable({
  object,
  accessLevel,
}: EffectTableComonProps) {
  const { t } = useTranslation("components");

  // If no effects are found, show a message
  if (!object.effects.length) {
    return (
      <p>{t("components:effects_table.no_effects")}
        { // Only show the button if the user has edit access to the object
          [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessLevel ?? AccessLevel.None) &&
          <span> {t("components:effects_table.wanna_create_effect")}&nbsp;
            <Link href={(object as Goal).indicatorParameter != undefined ? `/effect/create?goalId=${object.id}` : (object as Action).isSufficiency != undefined ? `/effect/create?actionId=${object.id}` : '/effect/create'}>
              {t("components:effects_table.create_new_effect")}
            </Link>
          </span>
        }
      </p>
    );
  }

  return (
    <ul className={`${styles['roadmap-nav-ul']}`} style={{ paddingInlineStart: '0' }}>
      {object.effects.map(effect => (
        <li key={`${effect.actionId}_${effect.goalId}`} className="margin-block-75">
          <div className='flex justify-content-space-between align-items-center width-100'>
            <IconCaretRightFilled fill="lightgray" aria-hidden="true" className="margin-inline-25 padding-25" style={{minWidth: '24px'}} />
            <a
              href={(object as Action).isSufficiency != undefined ? `/goal/${effect.goalId}` : `/action/${effect.actionId}`}
              className="font-weight-500 color-pureblack text-decoration-none flex-grow-100 inline-block padding-25 smooth">
              <span>{effect.action?.name || effect.goal?.name || effect.goal?.indicatorParameter || t("components:effects_table.effect_missing_name")}</span>
              <br />
              {effect.action?.startYear && effect.action?.endYear ? (
                <small className="color-gray">{effect.action?.startYear} - {effect.action?.endYear}</small>
              ) : null}
            </a>
            <TableMenu
              accessLevel={accessLevel}
              object={effect}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}