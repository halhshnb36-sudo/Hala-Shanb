import { ContactSection } from '@/components/ContactSection';
import { useSeo } from '@/lib/seo';

export default function Contact() {
  useSeo({ title: 'تواصل معنا' });
  return <ContactSection standalone />;
}
