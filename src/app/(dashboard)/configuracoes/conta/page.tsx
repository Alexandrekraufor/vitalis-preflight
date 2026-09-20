import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const metadata = { title: "Minha Conta" };

export default async function ContaPage() {
  const services = await appServices();
  const user = await requireUser(services.access, "/login");

  return (
    <>
      <PageHeader
        title="Minha Conta"
        description="Gerencie suas informações pessoais e credenciais de acesso."
      />

      <PageContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Perfil"
              description="Como você é identificado dentro do sistema."
            />
            <CardBody>
              <form className="space-y-4 pt-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={user.name}
                    className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-all focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:bg-slate-50 disabled:text-ink-muted"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    E-mail de acesso
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={user.email}
                    disabled
                    className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-muted"
                  />
                  <p className="mt-1.5 text-xs text-ink-muted">
                    O e-mail é utilizado para login e identificação única. Para alterar, contate o suporte.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-hover hover:shadow-md active:scale-95"
                  >
                    Salvar alterações
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Segurança"
              description="Atualize sua senha de acesso regularmente."
            />
            <CardBody>
              <form className="space-y-4 pt-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Senha atual
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-all focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition-all focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                  />
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-95"
                  >
                    Atualizar senha
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
