import { getTeamOverview } from "@/application/access/manage-team.use-case";
import { AccessDenied } from "@/components/layout/access-denied";
import { TeamManagement } from "@/components/team/team-management";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = { title: "Equipe" };

/**
 * Administrator-only screen.
 *
 * The check here decides what is *rendered*; it is not what protects the data.
 * Every action this page offers re-authorizes on the server, so a member who
 * reaches the underlying action directly is refused all the same.
 */
export default async function TeamPage() {
  const services = await appServices();
  const user = await requireUser(services.access, "/configuracoes/equipe");

  if (user.role !== "ADMIN") {
    return (
      <AccessDenied description="A gestão de equipe é restrita a administradores. Fale com um administrador se precisar de acesso." />
    );
  }

  const { members, invitations } = await getTeamOverview(services.access);

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Quem acessa o Vitalis Preflight, com que nível, e quais convites estão em aberto."
      />

      <PageContent>        <TeamManagement
          members={members}
          invitations={invitations}
          currentUserId={user.id}
        />
      </PageContent>
    </>
  );
}
