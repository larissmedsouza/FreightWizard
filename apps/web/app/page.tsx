'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Icon component for easy SVG usage
const Icon = ({ name, className = "w-6 h-6" }: { name: string; className?: string }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} />
);

// Translations
const translations = {
  en: {
    nav: { whatWeDo: 'What we Do', howItWorks: 'How it Works', useCases: 'Use Cases', pricing: 'Pricing', aboutUs: 'About Us', signIn: 'Sign in', signUp: 'Sign up' },
    hero: {
      badge: 'SUPERCHARGE YOUR FREIGHT',
      title1: 'Your AI Copilot',
      title2: 'for ',
      title3: 'Freight Forwarding.',
      subtitle: 'Handling inquiries, quotes, follow-ups and shipment classification automatically.',
      desc: 'Reduce email workload and respond to freight inquiries in minutes, not hours.',
      cta: 'Try it free',
    },
    product: {
      title: 'Everything your freight inbox needs — automated by AI',
      desc: 'Freight forwarding operations rely heavily on email communication. Quote requests, shipment updates, documentation questions, and follow-ups arrive continuously throughout the day. Managing this inbox manually slows teams down and increases the risk of missed opportunities.',
      desc2: 'FreightWizard uses artificial intelligence to analyze incoming freight emails, extract key shipment information, and suggest the appropriate actions automatically.',
      features: [
        { icon: 'web_page_AI Email Understanding', title: 'AI Email Understanding', desc: 'Automatically reads freight emails and extracts shipment details such as ports, container types, cargo information, and delivery dates.' },
        { icon: 'web_page_Smart_Workflow_Suggestions', title: 'Smart Workflow Suggestions', desc: 'Identifies whether an email is a quote request, booking update, documentation request, or status inquiry and suggests the correct next step.' },
        { icon: 'web_page_AI Drafted Responses', title: 'AI Drafted Responses', desc: 'Generates professional reply drafts that your team can review and send in seconds.' },
        { icon: 'web_page_Inbox Prioritization', title: 'Inbox Prioritization', desc: 'Highlights urgent requests and high-value quote opportunities so nothing falls through the cracks.' },
      ],
    },
    features: {
      title: 'Key Features',
      items: [
        { icon: 'web_page_Shipment Data Extraction', title: 'Shipment Data Extraction', desc: 'Detects ports, container types, cargo details, vessel names, and shipment references automatically.' },
        { icon: 'web_page_Email Intent Detection', title: 'Email Intent Detection', desc: 'Classifies incoming emails as quotes, updates, documentation requests, or tracking inquiries.' },
        { icon: 'web_page_Reply Assistant', title: 'Reply Assistant', desc: 'AI generates accurate and professional responses based on the email context.' },
        { icon: 'web_page_Activity Timeline', title: 'Activity Timeline', desc: 'Track communication history for every shipment conversation.' },
        { icon: 'web_page_Smart Notifications', title: 'Smart Notifications', desc: 'Get alerted when high-priority emails arrive or deadlines approach.' },
        { icon: 'web_page_Analytics Dashboard', title: 'Analytics Dashboard', desc: 'Monitor email volume, response times, and team productivity.' },
      ],
    },
    howItWorks: {
      title: 'From inbox chaos to structured freight workflows',
      steps: [
        { num: '1', title: 'Connect Your Inbox', desc: 'Connect your Gmail or Outlook inbox securely. FreightWizard begins monitoring incoming messages in real time without changing how customers contact you.' },
        { num: '2', title: 'AI Analyzes Each Email', desc: 'The system reads incoming messages and identifies shipment details: origin/destination ports, container type, shipment dates, and customer intent.' },
        { num: '3', title: 'Structured Data & Suggestions', desc: 'Extracted information is displayed in a structured format. FreightWizard suggests the next action: prepare a quote, request missing info, or forward to operations.' },
        { num: '4', title: 'Review & Send', desc: 'Your team can review the AI-generated reply, make adjustments if needed, and send the response immediately.' },
      ],
    },
    useCases: {
      title: 'Built for freight forwarding teams',
      desc: 'FreightWizard is designed specifically for companies whose operations depend on managing large volumes of freight communication.',
      cases: [
        { icon: 'web_page_Freight Forwarding Companies', title: 'Freight Forwarding Companies', desc: 'Automate inbox processing and respond faster to quote requests.' },
        { icon: 'web_page_Operations Teams', title: 'Operations Teams', desc: 'Reduce time spent sorting emails and extracting shipment data.' },
        { icon: 'web_page_Sales Teams', title: 'Sales Teams', desc: 'Never miss a potential shipment opportunity hidden in your inbox.' },
        { icon: 'web_page_Small Forwarders', title: 'Small Forwarders', desc: 'Scale operations without hiring additional staff.' },
      ],
    },
    integrations: {
      title: 'Works with the tools you already use',
      desc: 'FreightWizard integrates with major email platforms and can be extended to connect with freight management systems.',
      supported: 'Supported integrations',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      future: 'Future integrations',
      coming: ['CargoWise', 'Descartes', 'Freight tracking APIs'],
    },
    pricing: {
      title: 'Simple, transparent pricing',
      plans: [
        { name: 'Starter', price: 'Free', period: 'forever', desc: 'For individuals getting started', features: ['50 emails/month', '1 inbox', 'Basic AI analysis', 'Email support'], cta: 'Start Free' },
        { name: 'Professional', price: '$49', period: '/month', desc: 'For small teams', features: ['1,000 emails/month', '3 inboxes', 'Full AI features', 'Priority support', 'Analytics dashboard'], cta: 'Start Trial', popular: true },
        { name: 'Business', price: '$149', period: '/month', desc: 'For growing companies', features: ['10,000 emails/month', '10 inboxes', 'Advanced analytics', 'API access', 'Dedicated support'], cta: 'Contact Sales' },
        { name: 'Enterprise', price: 'Custom', period: '', desc: 'For large operations', features: ['Unlimited emails', 'Unlimited inboxes', 'Custom integrations', 'SLA guarantee', 'On-premise option'], cta: 'Contact Sales' },
      ],
    },
    about: {
      title: 'Built for the logistics industry',
      p1: 'FreightWizard was created to solve a common challenge in freight forwarding: managing complex shipment communication through email.',
      p2: 'Our goal is to bring modern AI automation to logistics teams while maintaining the reliability and control required for operational workflows.',
      p3: 'We focus on building tools that help freight professionals work faster, reduce manual tasks, and deliver better service to their customers.',
    },
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        { q: 'How does FreightWizard access my emails?', a: 'We use secure OAuth connections provided by Google and Microsoft. We never store your email password and you can revoke access at any time.' },
        { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit and at rest. We do not train AI models on your emails. Your operational data remains private.' },
        { q: 'Can I edit AI-generated replies?', a: 'Absolutely. Every AI suggestion can be reviewed, edited, or rejected before sending. You maintain full control.' },
        { q: 'What email providers do you support?', a: 'Currently we support Gmail, Google Workspace, Outlook, and Microsoft 365. More integrations are coming soon.' },
        { q: 'How accurate is the AI analysis?', a: 'Our AI correctly identifies email intent and extracts shipment data with over 95% accuracy for standard freight communications.' },
        { q: 'Can I try before buying?', a: 'Yes! Our Starter plan is free forever, and Professional plans come with a 14-day free trial.' },
      ],
    },
    security: {
      title: 'Security & Data Protection',
      desc: 'FreightWizard is designed with security and data protection as a priority.',
      items: ['Secure OAuth connections', 'Encrypted data storage', 'No AI training on your emails', 'Strict access controls', 'GDPR compliant'],
    },
    cta: {
      title: 'Ready to transform your freight inbox?',
      desc: 'Join hundreds of freight forwarding companies already using FreightWizard to save time and win more business.',
      button: 'Start Free Trial',
    },
    footer: {
      desc: 'AI-powered email management for freight forwarding.',
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
      links: { features: 'Features', pricing: 'Pricing', integrations: 'Integrations', about: 'About', blog: 'Blog', careers: 'Careers', privacy: 'Privacy', terms: 'Terms' },
      copy: '© 2026 FreightWizard. All rights reserved.',
    },
  },
  pt: {
    nav: { whatWeDo: 'O que fazemos', howItWorks: 'Como Funciona', useCases: 'Casos de Uso', pricing: 'Preços', aboutUs: 'Sobre Nós', signIn: 'Entrar', signUp: 'Cadastrar' },
    hero: {
      badge: 'POTENCIALIZE SEU FRETE',
      title1: 'Seu Copiloto IA',
      title2: 'para ',
      title3: 'Freight Forwarding.',
      subtitle: 'Gerenciando consultas, cotações, follow-ups e classificação de embarques automaticamente.',
      desc: 'Reduza a carga de e-mails e responda a consultas de frete em minutos, não horas.',
      cta: 'Teste grátis',
    },
    product: {
      title: 'Tudo que sua caixa de entrada de frete precisa — automatizado por IA',
      desc: 'Operações de freight forwarding dependem muito da comunicação por e-mail. Pedidos de cotação, atualizações de embarque e follow-ups chegam continuamente.',
      desc2: 'O FreightWizard usa inteligência artificial para analisar e-mails, extrair informações de embarque e sugerir ações automaticamente.',
      features: [
        { icon: 'web_page_AI Email Understanding', title: 'Compreensão de E-mail por IA', desc: 'Lê automaticamente e-mails de frete e extrai detalhes como portos, tipos de container e datas.' },
        { icon: 'web_page_Smart_Workflow_Suggestions', title: 'Sugestões Inteligentes', desc: 'Identifica se o e-mail é pedido de cotação, atualização de booking ou consulta de status.' },
        { icon: 'web_page_AI Drafted Responses', title: 'Respostas com IA', desc: 'Gera rascunhos profissionais que sua equipe pode revisar e enviar em segundos.' },
        { icon: 'web_page_Inbox Prioritization', title: 'Priorização de Inbox', desc: 'Destaca pedidos urgentes e oportunidades de alto valor.' },
      ],
    },
    features: {
      title: 'Recursos Principais',
      items: [
        { icon: 'web_page_Shipment Data Extraction', title: 'Extração de Dados', desc: 'Detecta portos, tipos de container, detalhes de carga e referências automaticamente.' },
        { icon: 'web_page_Email Intent Detection', title: 'Detecção de Intenção', desc: 'Classifica e-mails como cotações, atualizações ou consultas de rastreamento.' },
        { icon: 'web_page_Reply Assistant', title: 'Assistente de Resposta', desc: 'IA gera respostas precisas e profissionais baseadas no contexto.' },
        { icon: 'web_page_Activity Timeline', title: 'Linha do Tempo', desc: 'Acompanhe o histórico de comunicação de cada conversa.' },
        { icon: 'web_page_Smart Notifications', title: 'Notificações', desc: 'Seja alertado quando e-mails urgentes chegarem.' },
        { icon: 'web_page_Analytics Dashboard', title: 'Painel Analytics', desc: 'Monitore volume de e-mails e produtividade da equipe.' },
      ],
    },
    howItWorks: {
      title: 'Do caos do inbox para fluxos estruturados',
      steps: [
        { num: '1', title: 'Conecte sua Caixa', desc: 'Conecte seu Gmail ou Outlook de forma segura. O FreightWizard começa a monitorar mensagens em tempo real.' },
        { num: '2', title: 'IA Analisa Cada E-mail', desc: 'O sistema lê mensagens e identifica detalhes: portos, tipo de container, datas e intenção do cliente.' },
        { num: '3', title: 'Dados Estruturados', desc: 'Informações extraídas são exibidas de forma estruturada com sugestões de próximas ações.' },
        { num: '4', title: 'Revise & Envie', desc: 'Sua equipe pode revisar a resposta gerada pela IA e enviar imediatamente.' },
      ],
    },
    useCases: {
      title: 'Feito para equipes de freight forwarding',
      desc: 'FreightWizard é projetado para empresas que dependem de grandes volumes de comunicação de frete.',
      cases: [
        { icon: 'web_page_Freight Forwarding Companies', title: 'Freight Forwarders', desc: 'Automatize o processamento de inbox e responda mais rápido.' },
        { icon: 'web_page_Operations Teams', title: 'Equipes de Operações', desc: 'Reduza tempo gasto classificando e-mails.' },
        { icon: 'web_page_Sales Teams', title: 'Equipes de Vendas', desc: 'Nunca perca uma oportunidade escondida no inbox.' },
        { icon: 'web_page_Small Forwarders', title: 'Pequenos Forwarders', desc: 'Escale operações sem contratar mais funcionários.' },
      ],
    },
    integrations: {
      title: 'Funciona com suas ferramentas',
      desc: 'FreightWizard integra com principais plataformas de e-mail.',
      supported: 'Integrações suportadas',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      future: 'Integrações futuras',
      coming: ['CargoWise', 'Descartes', 'APIs de Frete'],
    },
    pricing: {
      title: 'Preços simples e transparentes',
      plans: [
        { name: 'Starter', price: 'Grátis', period: 'para sempre', desc: 'Para começar', features: ['50 emails/mês', '1 inbox', 'Análise básica', 'Suporte por email'], cta: 'Começar Grátis' },
        { name: 'Professional', price: 'R$199', period: '/mês', desc: 'Para pequenas equipes', features: ['1.000 emails/mês', '3 inboxes', 'IA completa', 'Suporte prioritário'], cta: 'Teste Grátis', popular: true },
        { name: 'Business', price: 'R$599', period: '/mês', desc: 'Para empresas', features: ['10.000 emails/mês', '10 inboxes', 'Analytics avançado', 'Acesso à API'], cta: 'Fale Conosco' },
        { name: 'Enterprise', price: 'Sob Consulta', period: '', desc: 'Para grandes operações', features: ['Emails ilimitados', 'Inboxes ilimitados', 'Integrações custom', 'SLA garantido'], cta: 'Fale Conosco' },
      ],
    },
    about: {
      title: 'Construído para a indústria logística',
      p1: 'FreightWizard foi criado para resolver um desafio comum no freight forwarding: gerenciar comunicação complexa de embarques por e-mail.',
      p2: 'Nosso objetivo é trazer automação moderna de IA para equipes de logística, mantendo a confiabilidade e controle necessários para fluxos operacionais.',
      p3: 'Focamos em construir ferramentas que ajudam profissionais de frete a trabalhar mais rápido, reduzir tarefas manuais e entregar melhor serviço aos seus clientes.',
    },
    faq: {
      title: 'Perguntas Frequentes',
      items: [
        { q: 'Como o FreightWizard acessa meus e-mails?', a: 'Usamos conexões OAuth seguras. Nunca armazenamos sua senha e você pode revogar acesso a qualquer momento.' },
        { q: 'Meus dados estão seguros?', a: 'Sim. Todos os dados são criptografados. Não treinamos modelos de IA com seus e-mails.' },
        { q: 'Posso editar respostas da IA?', a: 'Absolutamente. Toda sugestão pode ser revisada e editada antes de enviar.' },
        { q: 'Quais provedores de email suportam?', a: 'Gmail, Google Workspace, Outlook e Microsoft 365.' },
        { q: 'Quão precisa é a análise?', a: 'Nossa IA identifica intenção e extrai dados com mais de 95% de precisão.' },
        { q: 'Posso testar antes de comprar?', a: 'Sim! O plano Starter é grátis e planos Professional têm 14 dias de teste.' },
      ],
    },
    security: {
      title: 'Segurança & Proteção de Dados',
      desc: 'FreightWizard foi projetado com segurança como prioridade.',
      items: ['Conexões OAuth seguras', 'Dados criptografados', 'Sem treinamento de IA', 'Controles de acesso', 'Compatível com LGPD'],
    },
    cta: { title: 'Pronto para transformar seu inbox?', desc: 'Junte-se a centenas de empresas já usando FreightWizard.', button: 'Começar Grátis' },
    footer: { desc: 'Gestão de e-mails com IA para freight forwarding.', product: 'Produto', company: 'Empresa', legal: 'Legal', links: { features: 'Recursos', pricing: 'Preços', integrations: 'Integrações', about: 'Sobre', blog: 'Blog', careers: 'Carreiras', privacy: 'Privacidade', terms: 'Termos' }, copy: '© 2026 FreightWizard. Todos os direitos reservados.' },
  },
  nl: {
    nav: { whatWeDo: 'Wat we doen', howItWorks: 'Hoe Het Werkt', useCases: 'Use Cases', pricing: 'Prijzen', aboutUs: 'Over Ons', signIn: 'Inloggen', signUp: 'Aanmelden' },
    hero: {
      badge: 'SUPERCHARGE JE VRACHT',
      title1: 'Jouw AI Copiloot',
      title2: 'voor ',
      title3: 'Freight Forwarding.',
      subtitle: 'Behandel vragen, offertes, follow-ups en zendingsclassificatie automatisch.',
      desc: 'Verminder e-mailwerklast en reageer op vrachtvragen in minuten, niet uren.',
      cta: 'Probeer gratis',
    },
    product: {
      title: 'Alles wat je vracht-inbox nodig heeft — geautomatiseerd door AI',
      desc: 'Freight forwarding operaties zijn sterk afhankelijk van e-mailcommunicatie. Offerteaanvragen, updates en follow-ups komen continu binnen.',
      desc2: 'FreightWizard gebruikt AI om e-mails te analyseren, zendingsinformatie te extraheren en acties automatisch voor te stellen.',
      features: [
        { icon: 'web_page_AI Email Understanding', title: 'AI E-mail Begrip', desc: 'Leest automatisch vracht-e-mails en extraheert details zoals havens, containertypes en data.' },
        { icon: 'web_page_Smart_Workflow_Suggestions', title: 'Slimme Suggesties', desc: 'Identificeert of een e-mail een offerteaanvraag, boeking of statusvraag is.' },
        { icon: 'web_page_AI Drafted Responses', title: 'AI Antwoorden', desc: 'Genereert professionele concepten die je team in seconden kan versturen.' },
        { icon: 'web_page_Inbox Prioritization', title: 'Inbox Prioritering', desc: 'Markeert urgente verzoeken en waardevolle kansen.' },
      ],
    },
    features: {
      title: 'Belangrijkste Functies',
      items: [
        { icon: 'web_page_Shipment Data Extraction', title: 'Zendingsdata Extractie', desc: 'Detecteert havens, containertypes, lading en referenties automatisch.' },
        { icon: 'web_page_Email Intent Detection', title: 'Intentie Detectie', desc: 'Classificeert e-mails als offertes, updates of tracking vragen.' },
        { icon: 'web_page_Reply Assistant', title: 'Antwoord Assistent', desc: 'AI genereert accurate en professionele antwoorden.' },
        { icon: 'web_page_Activity Timeline', title: 'Activiteit Tijdlijn', desc: 'Volg communicatiegeschiedenis voor elk gesprek.' },
        { icon: 'web_page_Smart Notifications', title: 'Notificaties', desc: 'Ontvang alerts bij urgente e-mails.' },
        { icon: 'web_page_Analytics Dashboard', title: 'Analytics Dashboard', desc: 'Monitor e-mailvolume en teamproductiviteit.' },
      ],
    },
    howItWorks: {
      title: 'Van inbox-chaos naar gestructureerde workflows',
      steps: [
        { num: '1', title: 'Verbind Je Inbox', desc: 'Verbind Gmail of Outlook veilig. FreightWizard begint berichten in realtime te monitoren.' },
        { num: '2', title: 'AI Analyseert E-mails', desc: 'Het systeem leest berichten en identificeert zendingsdetails: havens, containertype, data.' },
        { num: '3', title: 'Gestructureerde Data', desc: 'Geëxtraheerde informatie wordt gestructureerd weergegeven met actie-suggesties.' },
        { num: '4', title: 'Review & Verstuur', desc: 'Je team kan het AI-antwoord reviewen, aanpassen en direct versturen.' },
      ],
    },
    useCases: {
      title: 'Gebouwd voor freight forwarding teams',
      desc: 'FreightWizard is ontworpen voor bedrijven die afhankelijk zijn van grote volumes vrachtcommunicatie.',
      cases: [
        { icon: 'web_page_Freight Forwarding Companies', title: 'Freight Forwarders', desc: 'Automatiseer inbox-verwerking en reageer sneller.' },
        { icon: 'web_page_Operations Teams', title: 'Operations Teams', desc: 'Verminder tijd besteed aan e-mail sorteren.' },
        { icon: 'web_page_Sales Teams', title: 'Sales Teams', desc: 'Mis nooit een kans verborgen in je inbox.' },
        { icon: 'web_page_Small Forwarders', title: 'Kleine Forwarders', desc: 'Schaal operaties zonder extra personeel.' },
      ],
    },
    integrations: {
      title: 'Werkt met je bestaande tools',
      desc: 'FreightWizard integreert met grote e-mailplatforms.',
      supported: 'Ondersteunde integraties',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      future: 'Toekomstige integraties',
      coming: ['CargoWise', 'Descartes', 'Vracht APIs'],
    },
    pricing: {
      title: 'Eenvoudige, transparante prijzen',
      plans: [
        { name: 'Starter', price: 'Gratis', period: 'voor altijd', desc: 'Om te starten', features: ['50 emails/maand', '1 inbox', 'Basis AI', 'E-mail support'], cta: 'Start Gratis' },
        { name: 'Professional', price: '€49', period: '/maand', desc: 'Voor kleine teams', features: ['1.000 emails/maand', '3 inboxen', 'Volledige AI', 'Priority support'], cta: 'Probeer Gratis', popular: true },
        { name: 'Business', price: '€149', period: '/maand', desc: 'Voor groeiende bedrijven', features: ['10.000 emails/maand', '10 inboxen', 'Geavanceerde analytics', 'API toegang'], cta: 'Neem Contact Op' },
        { name: 'Enterprise', price: 'Op Maat', period: '', desc: 'Voor grote operaties', features: ['Onbeperkte emails', 'Onbeperkte inboxen', 'Custom integraties', 'SLA garantie'], cta: 'Neem Contact Op' },
      ],
    },
    about: {
      title: 'Gebouwd voor de logistieke industrie',
      p1: 'FreightWizard is gemaakt om een veelvoorkomende uitdaging in freight forwarding op te lossen: het beheren van complexe zendingscommunicatie via e-mail.',
      p2: 'Ons doel is om moderne AI-automatisering naar logistieke teams te brengen, met behoud van de betrouwbaarheid en controle die nodig is voor operationele workflows.',
      p3: 'We richten ons op het bouwen van tools die vrachtprofessionals helpen sneller te werken, handmatige taken te verminderen en betere service aan hun klanten te leveren.',
    },
    faq: {
      title: 'Veelgestelde Vragen',
      items: [
        { q: 'Hoe krijgt FreightWizard toegang tot mijn e-mails?', a: 'We gebruiken veilige OAuth-verbindingen. We slaan je wachtwoord nooit op.' },
        { q: 'Zijn mijn gegevens veilig?', a: 'Ja. Alle data is versleuteld. We trainen geen AI-modellen op je e-mails.' },
        { q: 'Kan ik AI-antwoorden bewerken?', a: 'Absoluut. Elke suggestie kan worden gereviewd en bewerkt voor verzending.' },
        { q: 'Welke e-mailproviders ondersteunen jullie?', a: 'Gmail, Google Workspace, Outlook en Microsoft 365.' },
        { q: 'Hoe accuraat is de AI-analyse?', a: 'Onze AI identificeert intentie en extraheert data met meer dan 95% nauwkeurigheid.' },
        { q: 'Kan ik uitproberen voor aankoop?', a: 'Ja! Starter is altijd gratis, Professional heeft 14 dagen proefperiode.' },
      ],
    },
    security: {
      title: 'Beveiliging & Gegevensbescherming',
      desc: 'FreightWizard is ontworpen met beveiliging als prioriteit.',
      items: ['Veilige OAuth verbindingen', 'Versleutelde opslag', 'Geen AI training op je data', 'Strikte toegangscontroles', 'AVG compliant'],
    },
    cta: { title: 'Klaar om je inbox te transformeren?', desc: 'Sluit je aan bij honderden bedrijven die FreightWizard al gebruiken.', button: 'Start Gratis' },
    footer: { desc: 'AI-gestuurd e-mailbeheer voor freight forwarding.', product: 'Product', company: 'Bedrijf', legal: 'Juridisch', links: { features: 'Functies', pricing: 'Prijzen', integrations: 'Integraties', about: 'Over Ons', blog: 'Blog', careers: 'Vacatures', privacy: 'Privacy', terms: 'Voorwaarden' }, copy: '© 2026 FreightWizard. Alle rechten voorbehouden.' },
  },
};

type Language = 'en' | 'pt' | 'nl';

export default function HomePage() {
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const t = translations[language];
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#050510]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className="h-7 w-7 object-contain" />
            <span className="text-xl font-bold">FreightWizard</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#product" className="text-gray-400 hover:text-white transition text-sm">{t.nav.whatWeDo}</a>
            <a href="#how-it-works" className="text-gray-400 hover:text-white transition text-sm">{t.nav.howItWorks}</a>
            <a href="#use-cases" className="text-gray-400 hover:text-white transition text-sm">{t.nav.useCases}</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition text-sm">{t.nav.pricing}</a>
            <a href="#about" className="text-gray-400 hover:text-white transition text-sm">{t.nav.aboutUs}</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {/* Language Selector */}
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg border border-white/10">
                {langLabels[language]} <span className="text-xs">▼</span>
              </button>
              {langMenuOpen && (
                <div className="absolute top-full right-0 mt-2 bg-[#0a0a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {(['en', 'pt', 'nl'] as Language[]).map((l) => (
                    <button key={l} onClick={() => { setLanguage(l); setLangMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm hover:bg-white/10">
                      {langLabels[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">{t.nav.signIn}</Link>
            <Link href="/dashboard" className="px-5 py-2.5 bg-white text-black rounded-full font-medium text-sm hover:opacity-90 transition">
              {t.nav.signUp}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl">☰</button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a1a] border-t border-white/10 px-6 py-4 space-y-4">
            <a href="#product" className="block text-gray-300">{t.nav.whatWeDo}</a>
            <a href="#how-it-works" className="block text-gray-300">{t.nav.howItWorks}</a>
            <a href="#use-cases" className="block text-gray-300">{t.nav.useCases}</a>
            <a href="#pricing" className="block text-gray-300">{t.nav.pricing}</a>
            <a href="#about" className="block text-gray-300">{t.nav.aboutUs}</a>
            <Link href="/dashboard" className="block w-full text-center py-3 bg-white text-black rounded-full font-medium">
              {t.nav.signUp}
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section with Real Globe */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden min-h-screen flex items-center">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#9E14FB]/5 via-[#050510] to-[#1BA1FF]/5"></div>
        
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-block px-4 py-2 bg-gradient-to-r from-[#9E14FB]/20 to-[#5200FF]/20 rounded-full text-sm mb-6 border border-[#9E14FB]/30">
                <span className="bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] bg-clip-text text-transparent font-medium">
                  {t.hero.badge}
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                <span className="text-white">{t.hero.title1}</span>
                <br />
                <span className="text-white">{t.hero.title2}</span>
                <span className="bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] bg-clip-text text-transparent">{t.hero.title3}</span>
              </h1>
              
              <p className="text-gray-300 text-lg mb-4">
                {t.hero.subtitle}
              </p>
              <p className="text-gray-500 mb-8">
                {t.hero.desc}
              </p>
              
              <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium text-lg hover:opacity-90 transition shadow-lg shadow-[#5200FF]/25">
                {t.hero.cta} <span>→</span>
              </Link>
            </div>

            {/* Right Content - Real Globe with Floating Icons */}
            <div className="relative">
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                {/* Subtle glow effect behind globe */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#9E14FB]/20 via-[#5200FF]/15 to-[#1BA1FF]/20 rounded-full blur-3xl scale-90 opacity-60"></div>
                
                {/* Real Globe Image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img 
                    src="/globe.png" 
                    alt="Global Freight Network" 
                    className="w-full h-full object-contain"
                    style={{ mixBlendMode: 'lighten' }}
                  />
                </div>
                
                {/* Floating icons around the globe - white icons */}
                <div className="absolute top-[8%] left-[12%] w-12 h-12 bg-gradient-to-r from-[#9E14FB] to-[#5200FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#9E14FB]/40 animate-bounce p-2.5" style={{ animationDuration: '3s' }}>
                  <Icon name="web_page_Email Intent Detection" className="w-full h-full brightness-0 invert" />
                </div>
                <div className="absolute top-[15%] right-[8%] w-12 h-12 bg-gradient-to-r from-[#5200FF] to-[#1BA1FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#5200FF]/40 animate-bounce p-2.5" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
                  <Icon name="web_page_Shipment Data Extraction" className="w-full h-full brightness-0 invert" />
                </div>
                <div className="absolute bottom-[18%] left-[8%] w-12 h-12 bg-gradient-to-r from-[#1BA1FF] to-[#9E14FB] rounded-xl flex items-center justify-center shadow-lg shadow-[#1BA1FF]/40 animate-bounce p-2.5" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                  <Icon name="web_page_Freight Forwarding Companies" className="w-full h-full brightness-0 invert" />
                </div>
                <div className="absolute bottom-[10%] right-[12%] w-12 h-12 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#9E14FB]/40 animate-bounce p-2.5" style={{ animationDuration: '3.2s', animationDelay: '1.5s' }}>
                  <Icon name="web_page_Analytics Dashboard" className="w-full h-full brightness-0 invert" />
                </div>
                
                {/* Small floating dots */}
                <div className="absolute top-[35%] left-[5%] w-2 h-2 bg-[#9E14FB] rounded-full animate-pulse"></div>
                <div className="absolute top-[25%] right-[20%] w-2 h-2 bg-[#1BA1FF] rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-[30%] right-[5%] w-2 h-2 bg-[#5200FF] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute bottom-[40%] left-[18%] w-2 h-2 bg-[#1BA1FF] rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Section */}
      <section id="product" className="py-20 px-6 bg-[#050510]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.product.title}</h2>
            <p className="text-gray-400 max-w-3xl mx-auto mb-4">{t.product.desc}</p>
            <p className="text-gray-400 max-w-3xl mx-auto">{t.product.desc2}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.product.features.map((feature, i) => (
              <div key={i} className="bg-gradient-to-br from-[#0a0a1a] to-[#0f0f1f] rounded-2xl p-6 border border-white/5 hover:border-[#5200FF]/50 transition group">
                <div className="w-12 h-12 mb-4 p-2 rounded-xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                  <Icon name={feature.icon} className="w-full h-full" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:bg-gradient-to-r group-hover:from-[#9E14FB] group-hover:to-[#1BA1FF] group-hover:bg-clip-text group-hover:text-transparent transition">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#050510] to-[#0a0a1a]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t.features.title}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.features.items.map((feature, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 flex-shrink-0 p-2 rounded-lg bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                  <Icon name={feature.icon} className="w-full h-full" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 bg-[#050510]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t.howItWorks.title}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
                {i < 3 && <div className="hidden lg:block absolute top-6 left-14 w-full h-0.5 bg-gradient-to-r from-[#5200FF]/50 to-transparent"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-6 bg-gradient-to-b from-[#050510] to-[#0a0a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.useCases.title}</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">{t.useCases.desc}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.useCases.cases.map((useCase, i) => (
              <div key={i} className="bg-[#0a0a1a] rounded-2xl p-6 border border-white/5 text-center hover:border-[#1BA1FF]/30 transition">
                <div className="w-16 h-16 mx-auto mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                  <Icon name={useCase.icon} className="w-full h-full" />
                </div>
                <h3 className="font-semibold mb-2">{useCase.title}</h3>
                <p className="text-gray-500 text-sm">{useCase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-20 px-6 bg-[#050510]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.integrations.title}</h2>
            <p className="text-gray-400">{t.integrations.desc}</p>
          </div>
          
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-center mb-4 text-[#1BA1FF]">{t.integrations.supported}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {t.integrations.current.map((int, i) => (
                <div key={i} className="px-6 py-3 bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10 rounded-full border border-[#5200FF]/30 hover:border-[#5200FF]/50 transition">
                  {int}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-center mb-4 text-gray-500">{t.integrations.future}</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {t.integrations.coming.map((int, i) => (
                <div key={i} className="px-6 py-3 bg-[#0a0a1a] rounded-full border border-white/10 text-gray-500">
                  {int}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-gradient-to-b from-[#050510] to-[#0a0a1a]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t.pricing.title}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {t.pricing.plans.map((plan, i) => (
              <div key={i} className={`rounded-2xl p-6 border flex flex-col ${plan.popular ? 'bg-gradient-to-br from-[#9E14FB]/10 via-[#5200FF]/10 to-[#1BA1FF]/10 border-[#5200FF]/50' : 'bg-[#0a0a1a] border-white/5'}`}>
                {plan.popular && <div className="text-xs bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] bg-clip-text text-transparent font-medium mb-2">MOST POPULAR</div>}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-gray-500 text-sm mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-6 flex-grow">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <span className="text-[#1BA1FF]">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard" className={`block w-full text-center py-3 rounded-full font-medium mt-auto ${plan.popular ? 'bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] text-white' : 'border border-white/20 hover:bg-white/5'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-6 bg-[#050510]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">{t.about.title}</h2>
          <div className="space-y-6 text-gray-400 text-lg leading-relaxed">
            <p>{t.about.p1}</p>
            <p>{t.about.p2}</p>
            <p>{t.about.p3}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#050510] to-[#0a0a1a]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t.faq.title}</h2>
          <div className="space-y-4">
            {t.faq.items.map((faq, i) => (
              <div key={i} className="border border-white/10 rounded-xl overflow-hidden bg-[#0a0a1a]/50">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5">
                  <span className="font-medium">{faq.q}</span>
                  <span className="text-xl text-[#1BA1FF]">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-400">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-6 bg-[#050510]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.security.title}</h2>
          <p className="text-gray-400 mb-8">{t.security.desc}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {t.security.items.map((item, i) => (
              <div key={i} className="px-4 py-2 bg-[#1BA1FF]/10 text-[#1BA1FF] rounded-full text-sm border border-[#1BA1FF]/20">
                ✓ {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#050510] to-[#0a0a1a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.cta.title}</h2>
          <p className="text-gray-400 mb-8">{t.cta.desc}</p>
          <Link href="/dashboard" className="inline-block px-10 py-4 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full font-medium text-lg hover:opacity-90 shadow-lg shadow-[#5200FF]/25">
            {t.cta.button}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 bg-[#050510]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className="h-6 w-6 object-contain" />
                <span className="font-bold">FreightWizard</span>
              </div>
              <p className="text-gray-500 text-sm">{t.footer.desc}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t.footer.product}</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#product" className="hover:text-white">{t.footer.links.features}</a></li>
                <li><a href="#pricing" className="hover:text-white">{t.footer.links.pricing}</a></li>
                <li><a href="#integrations" className="hover:text-white">{t.footer.links.integrations}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t.footer.company}</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#about" className="hover:text-white">{t.footer.links.about}</a></li>
                <li><a href="#" className="hover:text-white">{t.footer.links.blog}</a></li>
                <li><a href="#" className="hover:text-white">{t.footer.links.careers}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t.footer.legal}</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#" className="hover:text-white">{t.footer.links.privacy}</a></li>
                <li><a href="#" className="hover:text-white">{t.footer.links.terms}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-gray-600 text-sm">
            {t.footer.copy}
          </div>
        </div>
      </footer>
    </div>
  );
}
