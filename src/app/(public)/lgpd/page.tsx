export const metadata = { title: "Política de LGPD" };

export default function LgpdPage() {
  return (
    <article className="prose prose-slate prose-brand mx-auto lg:prose-lg">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-ink">Política de LGPD</h1>
      <p className="text-sm text-ink-muted">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
      
      <div className="mt-10 space-y-8 text-ink">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">1. Introdução</h2>
          <p className="leading-relaxed">
            A Clínica Vitalis compromete-se com a segurança da informação e com a privacidade dos dados pessoais de seus colaboradores e pacientes, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">2. Direitos do Titular</h2>
          <p className="leading-relaxed">
            Em conformidade com a LGPD, os titulares dos dados têm o direito de solicitar à Clínica Vitalis, a qualquer momento, mediante requisição formal:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Confirmação da existência de tratamento;</li>
            <li>Acesso aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Portabilidade dos dados a outro fornecedor de serviço ou produto.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">3. Encarregado pelo Tratamento de Dados (DPO)</h2>
          <p className="leading-relaxed">
            Para exercer seus direitos, ou se tiver dúvidas sobre esta Política e nossas práticas de proteção de dados, entre em contato com nosso Encarregado pelo Tratamento de Dados Pessoais através do e-mail oficial da clínica (dpo@vitalis.com.br).
          </p>
        </section>
      </div>
    </article>
  );
}
