/**
 * Planning half of the action-origin backfill (see scripts/prisma/backfill-action-origins.ts).
 * Pure: takes the per-org copies as they sit in the database and decides which originals to
 * create under the municipality's umbrella org and which copies link to which original.
 *
 * Background: municipal action catalogues were imported as one action per responsible
 * committee/company ("Uppsala KS", "Uppsala GSN", ...), so an action with three responsibles
 * exists as three equal copies. The catalogue's own number column (NR / Åtgärdsnummer) survived
 * on every copy and identifies the source row, which is the cluster key here.
 */

import { randomUUID } from "node:crypto";

export type MunicipalityConfig = {
  /** GeoAreas code the per-responsible orgs are linked to (e.g. "0380") */
  geoAreaCode: string;
  /** Name of the umbrella org that will own the originals (e.g. "Uppsala"); created if missing */
  orgName: string;
  /** Header of the field holding the catalogue's action number, unique per source row */
  numberHeader: string;
  /** Header the responsible orgs are written back under on the original, one short field per copy */
  responsibleHeader: string;
};

export type CopyAction = {
  id: string;
  name: string;
  indicator_parameter: string;
  start_year: number | null;
  end_year: number | null;
  created_at: Date;
  author_id: string | null;
  org: { id: string; name: string; geo_area_code: string | null };
  fields: { header: string; value: string; type: string; order: number }[];
};

export type ExistingOrg = { id: string; name: string; geo_area_code: string | null };

export type PlannedOriginal = {
  id: string;
  orgId: string;
  name: string;
  indicator_parameter: string;
  start_year: number | null;
  end_year: number | null;
  author_id: string | null;
  fields: { header: string; value: string; type: string; order: number }[];
  /** The copy the original's content was taken from */
  representativeId: string;
  /** Copies that will point at this original */
  members: { id: string; orgName: string; name: string; nameDiffers: boolean; contentDiffers: boolean }[];
  clusterKey: string;
};

export type OriginPlan = {
  /** Umbrella orgs that don't exist yet */
  orgsToCreate: { id: string; name: string; geo_area_code: string }[];
  originals: PlannedOriginal[];
  /** Copies in a configured municipality that carry no number field and therefore can't be clustered */
  unmatched: { id: string; orgName: string; name: string }[];
};

/** Strips the municipality prefix the split gave per-responsible orgs ("Uppsala KS" -> "KS") */
export function responsibleName(orgName: string, municipality: MunicipalityConfig): string {
  const prefix = `${municipality.orgName} `;
  return orgName.startsWith(prefix) ? orgName.slice(prefix.length) : orgName;
}

function contentKey(action: Pick<CopyAction, "name" | "start_year" | "end_year" | "fields">, responsibleHeader: string): string {
  return JSON.stringify([
    action.name,
    action.start_year,
    action.end_year,
    action.fields.filter(field => field.header !== responsibleHeader).map(field => [field.header, field.value]),
  ]);
}

/**
 * Groups the copies by (municipality, number) and plans one original per group.
 * @param clustersOnly Skip groups with a single copy (the original would just duplicate it)
 */
export function planActionOrigins(
  copies: CopyAction[],
  existingOrgs: ExistingOrg[],
  municipalities: MunicipalityConfig[],
  options: { clustersOnly?: boolean; uuid?: () => string } = {},
): OriginPlan {
  const uuid = options.uuid ?? randomUUID;
  const plan: OriginPlan = { orgsToCreate: [], originals: [], unmatched: [] };

  for (const municipality of municipalities) {
    const umbrellaId = existingOrgs.find(org => org.name === municipality.orgName)?.id
      ?? (() => {
        const id = uuid();
        plan.orgsToCreate.push({ id, name: municipality.orgName, geo_area_code: municipality.geoAreaCode });
        return id;
      })();

    const clusters = new Map<string, CopyAction[]>();
    for (const copy of copies) {
      if (copy.org.geo_area_code !== municipality.geoAreaCode) continue;
      // The umbrella org's own actions are originals, not copies
      if (copy.org.id === umbrellaId) continue;
      const number = copy.fields.find(field => field.header === municipality.numberHeader)?.value.trim();
      if (!number) {
        plan.unmatched.push({ id: copy.id, orgName: copy.org.name, name: copy.name });
        continue;
      }
      const key = `${municipality.geoAreaCode}|${number}`;
      clusters.set(key, [...(clusters.get(key) ?? []), copy]);
    }

    for (const [clusterKey, members] of [...clusters.entries()].sort(([a], [b]) => a.localeCompare(b, "sv", { numeric: true }))) {
      if (options.clustersOnly && members.length < 2) continue;
      // The oldest copy (then the first org by name) stands in for the source row
      const sorted = [...members].sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.org.name.localeCompare(b.org.name, "sv"));
      const representative = sorted[0];
      const representativeKey = contentKey(representative, municipality.responsibleHeader);

      const ownFields = representative.fields
        .filter(field => field.header !== municipality.responsibleHeader)
        .map((field, index) => ({ header: field.header, value: field.value, type: field.type, order: index }));
      const responsibleFields = sorted
        .map(member => responsibleName(member.org.name, municipality))
        .sort((a, b) => a.localeCompare(b, "sv"))
        .map((value, index) => ({ header: municipality.responsibleHeader, value, type: "SHORT", order: ownFields.length + index }));

      plan.originals.push({
        id: uuid(),
        orgId: umbrellaId,
        name: representative.name,
        indicator_parameter: representative.indicator_parameter,
        start_year: representative.start_year,
        end_year: representative.end_year,
        author_id: representative.author_id,
        fields: [...ownFields, ...responsibleFields],
        representativeId: representative.id,
        members: sorted.map(member => ({
          id: member.id,
          orgName: member.org.name,
          name: member.name,
          nameDiffers: member.name !== representative.name,
          contentDiffers: contentKey(member, municipality.responsibleHeader) !== representativeKey,
        })),
        clusterKey,
      });
    }
  }

  return plan;
}

function sqlString(value: string | null): string {
  if (value === null) return "NULL";
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
}

function sqlNumber(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

/** One transaction that creates the umbrella orgs and originals and links the copies. Idempotent on the links. */
export function originPlanToSql(plan: OriginPlan): string {
  const lines: string[] = ["START TRANSACTION;"];
  for (const org of plan.orgsToCreate) {
    lines.push(`INSERT INTO \`Orgs\` (\`id\`, \`name\`, \`domain\`, \`geo_area_code\`) VALUES (${sqlString(org.id)}, ${sqlString(org.name)}, NULL, ${sqlString(org.geo_area_code)});`);
  }
  for (const original of plan.originals) {
    lines.push(`INSERT INTO \`Actions\` (\`id\`, \`created_at\`, \`updated_at\`, \`org_id\`, \`name\`, \`indicator_parameter\`, \`start_year\`, \`end_year\`, \`roadmap_iteration_id\`, \`parent_action_id\`, \`author_id\`, \`origin_action_id\`) VALUES (${sqlString(original.id)}, NOW(3), NOW(3), ${sqlString(original.orgId)}, ${sqlString(original.name)}, ${sqlString(original.indicator_parameter)}, ${sqlNumber(original.start_year)}, ${sqlNumber(original.end_year)}, NULL, NULL, ${sqlString(original.author_id)}, NULL);`);
    for (const field of original.fields) {
      lines.push(`INSERT INTO \`ActionFields\` (\`id\`, \`action_id\`, \`header\`, \`value\`, \`type\`, \`order\`) VALUES (${sqlString(randomUUID())}, ${sqlString(original.id)}, ${sqlString(field.header)}, ${sqlString(field.value)}, ${sqlString(field.type)}, ${field.order});`);
    }
    const memberIds = original.members.map(member => sqlString(member.id)).join(", ");
    lines.push(`UPDATE \`Actions\` SET \`origin_action_id\` = ${sqlString(original.id)} WHERE \`id\` IN (${memberIds}) AND \`origin_action_id\` IS NULL;`);
  }
  lines.push("COMMIT;");
  return lines.join("\n") + "\n";
}

/** Markdown summary for a human skim before the SQL is run */
export function originPlanToReport(plan: OriginPlan, municipalities: MunicipalityConfig[]): string {
  const lines: string[] = ["# Action origin backfill report", ""];
  const clusters = plan.originals.filter(original => original.members.length > 1);
  const singletons = plan.originals.filter(original => original.members.length === 1);
  lines.push(`- Umbrella orgs to create: ${plan.orgsToCreate.map(org => org.name).join(", ") || "none (all exist)"}`);
  lines.push(`- Originals to create: ${plan.originals.length} (${clusters.length} with several copies, ${singletons.length} single copies)`);
  lines.push(`- Copies to link: ${plan.originals.reduce((sum, original) => sum + original.members.length, 0)}`);
  lines.push(`- Copies whose content already differs within their cluster: ${plan.originals.flatMap(original => original.members).filter(member => member.contentDiffers).length}`);
  lines.push(`- Unmatched copies (no number field): ${plan.unmatched.length}`);
  lines.push("");

  for (const municipality of municipalities) {
    const own = plan.originals.filter(original => original.clusterKey.startsWith(`${municipality.geoAreaCode}|`));
    if (own.length === 0) continue;
    lines.push(`## ${municipality.orgName} (${own.length} originals)`, "");
    for (const original of own) {
      const number = original.clusterKey.split("|")[1];
      lines.push(`### ${municipality.numberHeader} ${number}: ${original.name}`);
      lines.push(`- original \`${original.id}\` from copy \`${original.representativeId}\``);
      for (const member of original.members) {
        const markers = [member.nameDiffers ? "name differs" : null, member.contentDiffers && !member.nameDiffers ? "fields differ" : null].filter(Boolean);
        lines.push(`- ${member.orgName}: \`${member.id}\`${markers.length ? ` (${markers.join(", ")})` : ""}${member.nameDiffers ? ` — "${member.name}"` : ""}`);
      }
      lines.push("");
    }
  }

  if (plan.unmatched.length > 0) {
    lines.push("## Unmatched copies", "");
    for (const copy of plan.unmatched) lines.push(`- ${copy.orgName}: \`${copy.id}\` "${copy.name}"`);
    lines.push("");
  }
  return lines.join("\n");
}

/** The catalogues split so far (prod, 2026-09-03). Extend when another municipality is imported the same way. */
export const municipalities: MunicipalityConfig[] = [
  { geoAreaCode: "0380", orgName: "Uppsala", numberHeader: "NR", responsibleHeader: "Ansvariga" },
  { geoAreaCode: "0381", orgName: "Enköping", numberHeader: "Åtgärdsnummer", responsibleHeader: "Ansvariga nämnder" },
];
