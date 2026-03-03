"use client";

// TODO: Move to actions.tsx
import styles from './tables.module.css' with { type: "css" };
import { AccessLevel, Action, Roadmap } from '@/types';
import Link from 'next/link';
import { ControlsMenu } from '../elements/controls/controls';
import { useTranslation } from "react-i18next";
import { IconLink } from '@tabler/icons-react';

/**
 * Displays a table of actions. Requires either a goal XOR a list of actions.
 * @param goal The goal containing the actions to display
 * @param actions A list of actions to display
 * @param accessLevel The access level of the user
 */
export default function ActionTable({
  actions,
  accessLevel,
  roadmapId,
}: {
  actions: Action[] | Roadmap["actions"];
  accessLevel?: AccessLevel;
  roadmapId?: string;
}) {
  const { t } = useTranslation("components");

  // If no actions are found, return a message
  if (!actions?.length) return (
    <>
      <p>{t("components:action_table.no_actions")}
        { // Only show the button if the user has edit access and a roadmapId is provided
          (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) && roadmapId &&
          <span> {t("components:action_table.wanna_create_action")}&nbsp;
            <Link href={`/action/create?roadmapId=${roadmapId}`}>
              {t("components:action_table.create_action")}
            </Link>
          </span>
        }
      </p>
    </>
  );

  return <>
    {actions.map(action => (
      <div className='flex gap-25 justify-content-space-between align-items-center margin-block-25' key={action.id}>
        <IconLink aria-hidden="true" color="gray" className="round padding-25 margin-inline-25" />
        <Link href={`/action/${action.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
          <span className='font-weight-500'>{action.name}</span>
          <p className={`${styles.actionLinkInfo} color-gray`}>{action.description || '\u00A0'}</p>
        </Link>
        <ControlsMenu
          accessLevel={accessLevel}
          object={action}
        />
        {/*
          <span>{action.costEfficiency}</span>
          <span>{action.expectedOutcome}</span>
          <span>{action.relevantActors}</span>
        */}
      </div>
    ))}
  </>

}