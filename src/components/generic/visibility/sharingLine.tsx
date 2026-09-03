import "server-only";
import { Sharing } from "@/lib/prisma/generated";
import serveTea from "@/lib/i18nServer";
import { IconBuildingCommunity, IconLock, IconWorld } from "@tabler/icons-react";

/** One line saying who can see a roadmap (and everything under it), from its access control. */
export default async function SharingLine({
  accessControl,
  className,
}: {
  accessControl: { sharing: Sharing, org: { name: string } };
  className?: string;
}) {
  const t = await serveTea("components");

  const iconProps = { "aria-hidden": true, width: 20, height: 20, style: { minWidth: '20px' } } as const;
  const { icon, text } = ({
    [Sharing.PUBLIC]: { icon: <IconWorld {...iconProps} />, text: t("components:sharing_line.public") },
    [Sharing.ORG]: { icon: <IconBuildingCommunity {...iconProps} />, text: t("components:sharing_line.org", { org: accessControl.org.name }) },
    [Sharing.GROUPS]: { icon: <IconLock {...iconProps} />, text: t("components:sharing_line.groups") },
  } satisfies Record<Sharing, { icon: React.ReactNode, text: string }>)[accessControl.sharing];

  return (
    <span className={`inline-flex align-items-center gap-25 ${className ?? ""}`} style={{ color: 'gray' }} data-testid="sharing-line">
      {icon}
      {text}
    </span>
  );
}
