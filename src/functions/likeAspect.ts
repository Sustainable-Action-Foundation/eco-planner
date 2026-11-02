import { LikeAspect } from "@/types/enums";
import type { TFunction } from "i18next";

/** Whether a value is one of the listed `LikeAspect`s */
export function isLikeAspect(value: unknown): value is LikeAspect {
  return (Object.values(LikeAspect) as unknown[]).includes(value);
}

/** The display name of a like aspect; `t` needs the common namespace */
export function likeAspectLabel(t: TFunction, aspect: LikeAspect): string {
  return {
    [LikeAspect.OwnOperations]: t("common:like_aspect.own_operations"),
    [LikeAspect.Ownership]: t("common:like_aspect.ownership"),
    [LikeAspect.AuthorityPlanning]: t("common:like_aspect.authority_planning"),
    [LikeAspect.MarketPower]: t("common:like_aspect.market_power"),
    [LikeAspect.Enabling]: t("common:like_aspect.enabling"),
    [LikeAspect.InfluenceLocal]: t("common:like_aspect.influence_local"),
    [LikeAspect.InfluenceUpward]: t("common:like_aspect.influence_upward"),
  }[aspect];
}

/** A one-line explanation of a like aspect; `t` needs the common namespace */
export function likeAspectDescription(t: TFunction, aspect: LikeAspect): string {
  return {
    [LikeAspect.OwnOperations]: t("common:like_aspect.own_operations_description"),
    [LikeAspect.Ownership]: t("common:like_aspect.ownership_description"),
    [LikeAspect.AuthorityPlanning]: t("common:like_aspect.authority_planning_description"),
    [LikeAspect.MarketPower]: t("common:like_aspect.market_power_description"),
    [LikeAspect.Enabling]: t("common:like_aspect.enabling_description"),
    [LikeAspect.InfluenceLocal]: t("common:like_aspect.influence_local_description"),
    [LikeAspect.InfluenceUpward]: t("common:like_aspect.influence_upward_description"),
  }[aspect];
}
