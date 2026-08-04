"use client";

// TODO: Move to actions.tsx
import styles from './tables.module.css' with { type: "css" };
import { actionFieldLabel, getActionDescription, groupActionFields } from "@/functions/actionFields";
import type { Action, RoadmapIteration } from "@/types";
import { AccessLevel } from "@/types/enums";
import Link from 'next/link';
import { ControlsMenu } from '../elements/controls/controls';
import { useTranslation } from "react-i18next";
import { IconLink } from '@tabler/icons-react';
import { hasEditAccess } from '@/lib/accessChecker';

/**
 * Displays a table of actions. Requires either a goal XOR a list of actions.
 * @param goal The goal containing the actions to display
 * @param actions A list of actions to display
 * @param accessLevel The access level of the user
 */
export default function ActionTable({
  actions,
  accessLevel,
  iterationId,
}: {
  actions: Action[] | RoadmapIteration["actions"];
  accessLevel?: AccessLevel;
  iterationId?: string;
}) {
  const { t } = useTranslation(["components", "forms"]);

  // If no actions are found, return a message
  if (!actions?.length) return (
    <p>{t("components:action_table.no_actions")}
      { // Only show the button if the user has edit access and an iterationId is provided
        hasEditAccess(accessLevel ?? AccessLevel.None)
        && !!iterationId
        && (
          <span> {t("components:action_table.wanna_create_action")}&nbsp;
            <Link href={`/action/create?iterationId=${iterationId}`}>
              {t("components:action_table.create_action")}
            </Link>
          </span>
        )
      }
    </p>
  );

  return <>
    {actions.map(action => (
      <div className='flex gap-25 justify-content-space-between align-items-center margin-block-25' key={action.id}>
        <IconLink aria-hidden="true" color="gray" className="round padding-25 margin-inline-25" />
        <Link href={`/action/${action.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
          <span className='font-weight-500'>{action.name}</span>
          {/* Actions no longer have a description column; prefer the description field, else summarize the rest */}
          <p className={`${styles.actionLinkInfo} color-gray`}>
            {("fields" in action && action.fields.length > 0)
              ? getActionDescription(action.fields)
                ?? groupActionFields(action.fields).map(group => `${actionFieldLabel(group.header, t)}: ${group.values.join(', ')}`).join(' \u00B7 ')
              : '\u00A0'}
          </p>
        </Link>
        <ControlsMenu
          accessLevel={accessLevel}
          object={action}
        />
      </div>
    ))}
  </>;

}