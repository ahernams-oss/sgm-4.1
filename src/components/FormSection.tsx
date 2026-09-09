import { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  delay?: number;
}

const FormSection = ({ title, children, delay = 0 }: FormSectionProps) => (
  <div
    className="section-card animate-fade-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <h2 className="section-title">{title}</h2>
    {children}
  </div>
);

export default FormSection;