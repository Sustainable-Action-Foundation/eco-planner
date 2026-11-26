import type { TFunction } from "i18next";
import { OrgType } from "@/lib/prisma/generated";

/** What an org type is called; shared by the landing page (server) and the management form (client) */
export function orgTypeLabel(t: TFunction, type: OrgType): string {
  const labels: Record<OrgType, string> = {
    [OrgType.MUNICIPAL_ADMINISTRATION]: t("common:org_type.municipal_administration"),
    [OrgType.MUNICIPAL_COMPANY]: t("common:org_type.municipal_company"),
    [OrgType.ASSOCIATION]: t("common:org_type.association"),
    [OrgType.AUTHORITY]: t("common:org_type.authority"),
    [OrgType.TRADE_ORGANISATION]: t("common:org_type.trade_organisation"),
    [OrgType.LIMITED_COMPANY]: t("common:org_type.limited_company"),
  };
  return labels[type];
}
