export const metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return (
    <article className="prose prose-slate prose-brand mx-auto lg:prose-lg">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-ink">Termos de Uso</h1>
      <p className="text-sm text-ink-muted">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
      
      <div className="mt-10 space-y-8 text-ink">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">1. Aceitação dos Termos</h2>
          <p className="leading-relaxed">
            Ao acessar e utilizar o sistema Vitalis Preflight, você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis e concorda que é responsável pelo cumprimento de todas as leis locais aplicáveis. Se você não concordar com algum desses termos, está proibido de usar ou acessar este site.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">2. Uso de Licença</h2>
          <p className="leading-relaxed">
            É concedida permissão para baixar temporariamente uma cópia dos materiais (informações ou software) no sistema Vitalis Preflight, apenas para visualização transitória pessoal e não comercial. Esta é a concessão de uma licença, não uma transferência de título e, sob esta licença, você não pode:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>modificar ou copiar os materiais;</li>
            <li>usar os materiais para qualquer finalidade comercial ou para exibição pública (comercial ou não comercial);</li>
            <li>tentar descompilar ou fazer engenharia reversa de qualquer software contido no sistema Vitalis Preflight;</li>
            <li>remover quaisquer direitos autorais ou outras notações de propriedade dos materiais; ou</li>
            <li>transferir os materiais para outra pessoa ou espelhar os materiais em qualquer outro servidor.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-ink">3. Isenção de Responsabilidade</h2>
          <p className="leading-relaxed">
            Os materiais no sistema da Clínica Vitalis são fornecidos como estão. A Clínica Vitalis não oferece garantias, expressas ou implícitas, e, por este meio, isenta e nega todas as outras garantias, incluindo, sem limitação, garantias implícitas ou condições de comercialização, adequação a um fim específico ou não violação de propriedade intelectual ou outra violação de direitos.
          </p>
        </section>
      </div>
    </article>
  );
}
