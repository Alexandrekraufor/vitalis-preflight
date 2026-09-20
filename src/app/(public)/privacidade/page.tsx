export const metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <article className="prose prose-slate prose-brand mx-auto lg:prose-lg">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-ink">Política de Privacidade</h1>
      <p className="text-sm text-ink-muted">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
      
      <div className="mt-10 space-y-8 text-ink">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">1. Coleta de Informações</h2>
          <p className="leading-relaxed">
            Coletamos informações quando você se registra em nosso sistema, faz login em sua conta, realiza ações nas guias médicas e/ou faz logoff. As informações coletadas incluem seu nome, endereço de e-mail e logs de acesso do sistema para fins de auditoria interna da clínica.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">2. Uso das Informações</h2>
          <p className="leading-relaxed">
            Qualquer das informações que coletamos de você pode ser usada para:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Personalizar sua experiência e atender às suas necessidades individuais;</li>
            <li>Melhorar continuamente o sistema Vitalis Preflight;</li>
            <li>Melhorar o atendimento ao cliente e suas necessidades de suporte;</li>
            <li>Entrar em contato por e-mail para avisos sobre guias e processos críticos.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">3. Proteção e Segurança</h2>
          <p className="leading-relaxed">
            Implementamos uma variedade de medidas de segurança para manter a segurança de suas informações pessoais. Usamos criptografia de ponta a ponta e bancos de dados seguros para proteger informações sensíveis transmitidas online e armazenadas internamente.
          </p>
        </section>
      </div>
    </article>
  );
}
