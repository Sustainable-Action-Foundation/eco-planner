"use client";

// TODO: Move to actions.tsx
import styles from './tables.module.css' with { type: "css" };
import { Action } from '@prisma/client';
import { AccessLevel } from '@/types';
import Link from 'next/link';
import { TableMenu } from './tableMenu/tableMenu';
import { useTranslation } from "react-i18next";

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
  actions: (Action & {
    author?: {
      id: string;
      username: string;
    },
    _count?: {
      effects: number;
    },
    effects?: {
      goal: { id: string, roadmap: { id: string } }
    }[],
  })[]
  accessLevel?: AccessLevel,
  roadmapId?: string,
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
      <div className='flex gap-100 justify-content-space-between align-items-center' key={action.id}>
        <a href={`/action/${action.id}`} className={`${styles.roadmapLink} flex-grow-100`}>
          <span className={styles.linkTitle}>{action.name}</span>
          <p className={styles.actionLinkInfo}>{action.description}</p>
        </a>
        <TableMenu
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