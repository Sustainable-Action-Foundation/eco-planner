'use client';

import { AccessLevel } from "@/types.ts";
import { Action, Effect, Goal } from "@prisma/client";
import Link from "next/link";
import { TableMenu } from "./tableMenu/tableMenu.tsx";

/* Probably should have a cleaner way of importing this */
import styles from '../../app/user/[user]/page.module.css' with { type: "css" }

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

  return (
    <ul className={`${styles.itemsList}`}>
      {object.effects.map(effect => (
        <li key={`${effect.actionId}_${effect.goalId}`}>
          <div className="width-100" style={{verticalAlign: 'middle'}}>
            <div className='flex justify-content-space-between'>
              <a 
                href={(object as Action).isSufficiency != undefined ? `/goal/${effect.goalId}` : `/action/${effect.actionId}`}  
                className="font-weight-500 color-pureblack text-decoration-none flex-grow-100 inline-block">
                {effect.action?.name || effect.goal?.name || effect.goal?.indicatorParameter || "Namnlös effekt"}
              </a>
              <TableMenu
                accessLevel={accessLevel}
                object={effect}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}