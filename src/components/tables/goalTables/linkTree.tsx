import styles from '../tables.module.css' with { type: "css" };
import { DataSeries, Goal } from "@prisma/client";
import Image from 'next/image';
import goalsToTree, { GoalTree } from '@/functions/goalsToTree';
import { SyntheticEvent } from 'react';
import { getSessionStorage, setSessionStorage } from '@/functions/localStorage';
import { useTranslation } from "react-i18next";

// interface LinkTreeCommonProps {}

interface LinkTreeWithGoals /* extends LinkTreeCommonProps */ {
  goals: (Goal & {
    _count: { effects: number }
    dataSeries: DataSeries | null,
    roadmap: { id: string, metaRoadmap: { name: string, id: string } },
  })[],
  roadmap?: never,
}

interface LinkTreeWithRoadmap /* extends LinkTreeCommonProps */ {
  goals?: never,
  roadmap: {
    id: string,
    metaRoadmap: { name: string, id: string },
    goals: (Goal & {
      _count: { effects: number },
      dataSeries: DataSeries | null,
    })[]
  },
}

type LinkTreeProps = LinkTreeWithGoals | LinkTreeWithRoadmap;

export default function LinkTree({
  goals,
  roadmap,
}: LinkTreeProps) {
  const { t } = useTranslation();

  // Failsafe in case wrong props are passed
  if ((!goals && !roadmap) || (goals && roadmap)) throw new Error('LinkTree: Either `goals` XOR `roadmap` must be provided');

  if (!goals) {
    goals = roadmap?.goals.map(goal => {
      return {
        ...goal,
        roadmap: (({ goals, ...data }) => data)(roadmap),
      }
    })
  }

  if (!goals?.length) return (<p>{t("components:link_tree.no_roadmaps")}</p>);

  let openCategories: string[] = getSessionStorage(roadmap?.id || "") as string[] || [];
  if (!(openCategories instanceof Array)) {
    openCategories = [];
  }

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement, Event>, key: string) => {
    if (!roadmap) return;
    let currentStorage: string[] = getSessionStorage(roadmap.id) as string[];
    if (!(currentStorage instanceof Array)) {
      setSessionStorage(roadmap.id, []);
      currentStorage = [];
    }

    if (e.currentTarget.open) {
      // Don't add the same branch twice
      if (currentStorage.includes(key))
        return;
      setSessionStorage(roadmap.id, [...currentStorage, key]);
    } else {
      setSessionStorage(roadmap.id, currentStorage.filter(branch => branch != key));
    }
  };

  const NestedKeysRenderer = ({ data, previousKeys = "" }: { data: GoalTree, previousKeys?: string }) => {
    return (
      <ul className={styles.list}>
        {Object.keys(data).map((key) => (
          <li key={key}>
            { // If the current object is a goal (has an id), render a link to the goal
              typeof data[key].id == 'string' ? (
                <a href={`/goal/${data[key].id}`} className={`display-flex gap-50 align-items-center padding-block-50 ${styles.link}`}>
                  <Image src="/icons/link.svg" alt={`Link to ${key}`} width={16} height={16} />
                  <span>
                    {key}
                  </span>
                </a>
              ) : (
                <details className={styles.details} open={openCategories?.includes(previousKeys + "\\" + key)} onToggle={(e) => handleToggle(e, previousKeys + "\\" + key)}>
                  <summary>{key}</summary>
                  {Object.keys(data[key]).length > 0 && (
                    <NestedKeysRenderer data={data[key] as GoalTree} previousKeys={previousKeys + "\\" + key} />
                  )}
                </details>
              )}
          </li>
        ))}
      </ul>
    );
  };

  const data = goalsToTree(goals);

  return (
    <>
      <NestedKeysRenderer data={data} />
    </>
  );

}