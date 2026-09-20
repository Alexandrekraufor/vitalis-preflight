import { listApiCredentials } from "@/application/access/manage-api-credentials.use-case";
import { CredentialManagement } from "@/components/integrations/credential-management";
import { AccessDenied } from "@/components/layout/access-denied";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chaves de API" };

/**
 * Where the clinic's machine credentials come from.
 *
 * The page checks the role on the server before rendering anything, and every
 * action behind it checks again - a member who reaches this URL directly sees
 * the refusal, not the form.
 */
export default async function ApiCredentialsPage() {
  const services = await appServices();
  const user = await requireUser(services.access, "/configuracoes/chaves");

  if (user.role !== "ADMIN") {
    return (
      <>
        <PageHeader title="Chaves de API" />
        <PageContent>
          <AccessDenied description="Apenas administradores podem criar ou revogar chaves de integração." />
        </PageContent>
      </>
    );
  }

  const credentials = await listApiCredentials(user, services.access);

  return (
    <>
      <PageHeader
        title="Chaves de API"
        description="Credenciais que a API REST e o servidor MCP aceitam. Cada chave vale por uma superfície, pode ser revogada a qualquer momento e é guardada apenas como digest."
      />

      <PageContent>
        <CredentialManagement credentials={credentials} />

        <Card>
          <CardHeader
            title="Como a chave é verificada"
            description="O mesmo caminho para a API e para o MCP."
          />
          <CardBody className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-muted">
            <p>
              A chave viaja no header{" "}
              <code className="font-mono text-xs text-ink">Authorization: Bearer …</code> e é
              procurada pelo seu digest. Revogar tem efeito imediato: a próxima chamada recebe
              401.
            </p>
            <p>
              Chave nenhuma configurada mantém a superfície <strong className="font-medium text-ink">fechada</strong>.
              Uma variável de ambiente ausente nunca abre a API.
            </p>
            <p>
              Criação e revogação ficam registradas na auditoria com quem fez e quando - o valor
              da chave, nunca.
            </p>
          </CardBody>
        </Card>
      </PageContent>
    </>
  );
}
