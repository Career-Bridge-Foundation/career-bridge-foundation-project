import type { PortfolioData } from '@/lib/portfolio/getPortfolioBySlug';
import { ProfessionalTemplate } from './ProfessionalTemplate';
import { FocusedTemplate } from './FocusedTemplate';

type Props = {
  data: PortfolioData;
};

export function TemplateRenderer({ data }: Props) {
  switch (data.profile.template) {
    case 'focused':
      return <FocusedTemplate data={data} />;
    case 'professional':
    default:
      return <ProfessionalTemplate data={data} />;
  }
}
