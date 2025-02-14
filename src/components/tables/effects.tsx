'use client';


// TODO: Check if styles are used properly, I just yoinked these from ActionTable
import styles from './tables.module.css' with { type: "css" };
import { AccessLevel } from "@/types.ts";
import { Action, Effect, Goal } from "@prisma/client";
import Link from "next/link";
import { TableMenu } from "./tableMenu/tableMenu.tsx";

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
  // If no effects are found, show a message
  if (!object.effects.length) {
    return (
      <p>Det finns inga effekter att visa.
        { // Only show the button if the user has edit access to the object
          [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessLevel ?? AccessLevel.None) &&
          <span> Vill du skapa en?&nbsp;
            <Link href={(object as Goal).indicatorParameter != undefined ? `/effect/create?goalId=${object.id}` : (object as Action).isSufficiency != undefined ? `/effect/create?actionId=${object.id}` : '/effect/create'}>
              Skapa ny effekt
            </Link>
          </span>
        }
      </p>
    );
  }

  return (<>
    {object.effects.map(effect => (
      <div className='flex gap-100 justify-content-space-between align-items-center' key={`${effect.actionId}_${effect.goalId}`}>
        <a href={(object as Action).isSufficiency != undefined ? `/goal/${effect.goalId}` : `/action/${effect.actionId}`} className={`${styles.roadmapLink} flex-grow-100`}>
          <span className={styles.linkTitle}>{effect.action?.name || effect.goal?.name || effect.goal?.indicatorParameter || "Namnlös effekt"}</span>
          <p className={styles.actionLinkInfo}>{effect.action?.description || effect.goal?.description}</p>
        </a>
        <TableMenu
          accessLevel={accessLevel}
          object={effect}
        />
      </div>
    ))}
  </>);
}