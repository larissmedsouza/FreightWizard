'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SALES_CONTACT } from '@/app/lib/plans';
import Logo from '@/app/components/ui/Logo';
import FreightGlobe from '@/app/components/FreightGlobe';
import RevealObserver from '@/app/components/marketing/RevealObserver';
import CountUp from '@/app/components/marketing/CountUp';
import { ButtonLink } from '@/app/components/marketing/Button';
import { Eyebrow, Section, SectionHeader } from '@/app/components/marketing/Section';
import FeatureCard, { IconFrame, revealDelay, titleHover } from '@/app/components/marketing/FeatureCard';
import FwIcon, { type IconName as FwIconName } from '@/app/components/ui/Icon';

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
      desc: 'Reduce email workload and respond to freight inquiries faster.',
      cta: 'Try it free',
    },
    product: {
      title: 'Everything your freight inbox needs, automated by AI',
      desc: 'Freight forwarding operations rely heavily on email communication. Quote requests, shipment updates, documentation questions, and follow-ups arrive continuously throughout the day. Managing this inbox manually slows teams down and increases the risk of missed opportunities.',
      desc2: 'Freightwizard uses artificial intelligence to analyze incoming freight emails, extract key shipment information, and suggest the appropriate actions automatically.',
      features: [
        { icon: 'email' as FwIconName, title: 'AI Email Understanding', desc: 'Automatically reads freight emails and extracts shipment details such as ports, container types, cargo information, and delivery dates.' },
        { icon: 'workflow' as FwIconName, title: 'Smart Workflow Suggestions', desc: 'Identifies whether an email is a quote request, booking update, documentation request, or status inquiry and suggests the correct next step.' },
        { icon: 'reply' as FwIconName, title: 'AI Drafted Responses', desc: 'Generates professional reply drafts that your team can review, edit and send.' },
        { icon: 'priority' as FwIconName, title: 'Inbox Prioritization', desc: 'Highlights urgent emails and new quote requests so nothing slips through.' },
      ],
    },
    features: {
      title: 'Key Features',
      items: [
        { icon: 'extract' as FwIconName, title: 'Shipment Data Extraction', desc: 'Detects ports, container types, cargo details, vessel names, and shipment references automatically.' },
        { icon: 'intent' as FwIconName, title: 'Email Intent Detection', desc: 'Classifies incoming emails as quotes, updates, documentation requests, or tracking inquiries.' },
        { icon: 'assistant' as FwIconName, title: 'Reply Assistant', desc: 'AI generates accurate and professional responses based on the email context.' },
        { icon: 'timeline' as FwIconName, title: 'Activity Timeline', desc: 'Activity timeline for each email thread: received, analyzed, replied, notes.' },
        { icon: 'analytics' as FwIconName, title: 'Analytics Dashboard', desc: 'Monitor email volume, response times, and team productivity.' },
        { icon: 'quote' as FwIconName, title: 'Quote Builder', desc: 'Pre-fills quotes from extracted email data so you can review and send them directly.' },
        { icon: 'tracking' as FwIconName, title: 'Shipment Tracker', desc: 'Kanban board that auto-detects shipments from your emails and keeps their status current.' },
        { icon: 'portal' as FwIconName, title: 'Customer Portal', desc: 'Shareable tracking link your customer can open with no login required.' },
        { icon: 'rates' as FwIconName, title: 'Rate Card Storage', desc: 'Save carrier rates per lane and have them auto-suggested inside the quote builder.' },
        { icon: 'compliance' as FwIconName, title: 'Country Compliance', desc: 'Brazil MAPA compliance alerts built in. SERPRO / CE Mercante (Brazil) and Portbase (Netherlands) coming soon.' },
        { icon: 'docs' as FwIconName, title: 'Document Intelligence', desc: 'Upload a BL, AWB, or invoice and AI extracts the fields and flags risks.' },
      ],
    },
    howItWorks: {
      title: 'From inbox chaos to structured freight workflows',
      steps: [
        { num: '1', title: 'Connect Your Inbox', desc: 'Connect your Gmail or Outlook inbox securely. New messages load every time you open or refresh your inbox, and you analyze them with one click, without changing how customers contact you.' },
        { num: '2', title: 'AI Analyzes Each Email', desc: 'The system reads incoming messages and identifies shipment details: origin/destination ports, container type, shipment dates, and customer intent.' },
        { num: '3', title: 'Structured Data & Suggestions', desc: 'Extracted information is displayed in a structured format. Freightwizard suggests the next action: prepare a quote, request missing info, or forward to operations.' },
        { num: '4', title: 'Review & Send', desc: 'Your team can review the AI-generated reply, make adjustments if needed, and send the response immediately.' },
      ],
    },
    useCases: {
      title: 'Built for freight forwarding teams',
      desc: 'Freightwizard is designed specifically for companies whose operations depend on managing large volumes of freight communication.',
      cases: [
        { icon: 'forwarder' as FwIconName, title: 'Freight Forwarding Companies', desc: 'Automate inbox processing and respond faster to quote requests.' },
        { icon: 'operations' as FwIconName, title: 'Operations Teams', desc: 'Reduce time spent sorting emails and extracting shipment data.' },
        { icon: 'sales' as FwIconName, title: 'Sales Teams', desc: 'Never miss a potential shipment opportunity hidden in your inbox.' },
        { icon: 'small' as FwIconName, title: 'Small Forwarders', desc: 'Scale operations without hiring additional staff.' },
      ],
    },
    integrations: {
      title: 'Works with the tools you already use',
      desc: 'Freightwizard integrates with major email platforms.',
      supported: 'Supported integrations',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      complianceTitle: 'Compliance',
      compliance: ['MAPA compliance alerts (BR)'],
      future: 'Coming soon',
      coming: ['SERPRO Integra Comex (BR)', 'CE Mercante (BR)', 'Portbase (NL)', 'Terminal49 live tracking', 'CargoWise', 'Descartes'],
    },
    pricing: {
      title: 'Simple, transparent pricing',
      monthly: 'Monthly',
      annual: 'Annual',
      annualNote: '2 months free',
      perMonth: '/month',
      perYear: '/year',
      plans: [
        { name: 'Trial', price: 'Free', monthly: null, period: '', desc: '14 days free: 30 analyses, 5 shipments, 5 quotes. No credit card.', features: ['30 analyses total', '5 shipments', '5 quotes'], cta: 'Start Free Trial' },
        { name: 'Starter', price: '$79', monthly: 79, period: '/month', desc: '1 user', features: ['200 analyses/month', '10 shipments', '20 quotes', 'Quote builder', 'Customer portal', 'Rate cards', 'Email support'], cta: 'Get Started' },
        { name: 'Professional', price: '$179', monthly: 179, period: '/month', desc: 'Up to 5 users', features: ['Unlimited analyses', 'Unlimited shipments', 'Unlimited quotes', 'Document intelligence', 'Team leaderboard', 'Brazil MAPA compliance alerts', 'Priority support'], cta: 'Get Started', popular: true },
        { name: 'Enterprise', price: 'From $399', monthly: null, period: '/month', desc: '10 users included, extra seats by contract', contactSales: true, features: ['Everything in Professional', 'Container tracking (coming soon)', 'Dedicated support'], cta: 'Contact Sales' },
      ],
    },
    about: {
      title: 'Built for the logistics industry',
      p1: 'Freightwizard was created to solve a common challenge in freight forwarding: managing complex shipment communication through email.',
      p2: 'Our goal is to bring modern AI automation to logistics teams while maintaining the reliability and control required for operational workflows.',
      p3: 'We focus on building tools that help freight professionals work faster, reduce manual tasks, and deliver better service to their customers.',
    },
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        { q: 'How does Freightwizard access my emails?', a: 'We use secure OAuth connections provided by Google and Microsoft. We never store your email password and you can revoke access at any time.' },
        { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit and at rest. We don\'t use your emails to train AI models. Your operational data remains private.' },
        { q: 'Can I edit AI-generated replies?', a: 'Absolutely. Every AI suggestion can be reviewed, edited, or rejected before sending. You maintain full control.' },
        { q: 'What email providers do you support?', a: 'Currently we support Gmail, Google Workspace, Outlook, and Microsoft 365. More integrations are coming soon.' },
        { q: 'Do you have a plan for larger teams?', a: 'Yes. Enterprise starts from $399/month with 10 users included; extra seats are arranged by contract. Contact sales to set it up.' },
        { q: 'Can I try before buying?', a: 'Yes. Start with a 14-day free trial: 30 analyses, 5 shipments and 5 quotes, no credit card. After that, Starter is $79/month.' },
      ],
    },
    security: {
      title: 'Security & Data Protection',
      desc: 'Freightwizard is designed with security and data protection as a priority.',
      items: ['Secure OAuth connections', 'Encrypted in transit and at rest', 'We don\'t use your emails to train AI models', 'Every request is authenticated, and your data is visible only to your account and your team'],
    },
    cta: {
      title: 'Ready to transform your freight inbox?',
      desc: 'Built for freight forwarding teams who want to save time and win more business.',
      button: 'Start Free Trial',
    },
    footer: {
      desc: 'AI-powered email management for freight forwarding.',
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
      links: { features: 'Features', pricing: 'Pricing', integrations: 'Integrations', about: 'About', blog: 'Blog', careers: 'Careers', privacy: 'Privacy', terms: 'Terms' },
      copy: '© 2026 Freightwizard. All rights reserved.',
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
      desc: 'Reduza a carga de e-mails e responda a consultas de frete mais rápido.',
      cta: 'Teste grátis',
    },
    product: {
      title: 'Tudo que sua caixa de entrada de frete precisa, automatizado por IA',
      desc: 'Operações de freight forwarding dependem muito da comunicação por e-mail. Pedidos de cotação, atualizações de embarque e follow-ups chegam continuamente.',
      desc2: 'O Freightwizard usa inteligência artificial para analisar e-mails, extrair informações de embarque e sugerir ações automaticamente.',
      features: [
        { icon: 'email' as FwIconName, title: 'Compreensão de E-mail por IA', desc: 'Lê automaticamente e-mails de frete e extrai detalhes como portos, tipos de container e datas.' },
        { icon: 'workflow' as FwIconName, title: 'Sugestões Inteligentes', desc: 'Identifica se o e-mail é pedido de cotação, atualização de booking ou consulta de status.' },
        { icon: 'reply' as FwIconName, title: 'Respostas com IA', desc: 'Gera rascunhos profissionais que sua equipe pode revisar, editar e enviar.' },
        { icon: 'priority' as FwIconName, title: 'Priorização de Inbox', desc: 'Destaca e-mails urgentes e novos pedidos de cotação para que nada passe despercebido.' },
      ],
    },
    features: {
      title: 'Recursos Principais',
      items: [
        { icon: 'extract' as FwIconName, title: 'Extração de Dados', desc: 'Detecta portos, tipos de container, detalhes de carga e referências automaticamente.' },
        { icon: 'intent' as FwIconName, title: 'Detecção de Intenção', desc: 'Classifica e-mails como cotações, atualizações ou consultas de rastreamento.' },
        { icon: 'assistant' as FwIconName, title: 'Assistente de Resposta', desc: 'IA gera respostas precisas e profissionais baseadas no contexto.' },
        { icon: 'timeline' as FwIconName, title: 'Linha do Tempo', desc: 'Linha do tempo de cada conversa de e-mail: recebido, analisado, respondido, notas.' },
        { icon: 'analytics' as FwIconName, title: 'Painel Analytics', desc: 'Monitore volume de e-mails e produtividade da equipe.' },
        { icon: 'quote' as FwIconName, title: 'Construtor de Cotações', desc: 'Pré-preenche cotações com os dados extraídos do e-mail para revisar e enviar direto.' },
        { icon: 'tracking' as FwIconName, title: 'Rastreador de Embarques', desc: 'Quadro Kanban que detecta embarques nos seus e-mails e mantém o status atualizado.' },
        { icon: 'portal' as FwIconName, title: 'Portal do Cliente', desc: 'Link de rastreamento compartilhável que o cliente abre sem precisar de login.' },
        { icon: 'rates' as FwIconName, title: 'Tabela de Tarifas', desc: 'Salve tarifas de transportadoras por rota e receba sugestões no construtor de cotações.' },
        { icon: 'compliance' as FwIconName, title: 'Compliance por País', desc: 'Alertas de compliance MAPA (Brasil) integrados. SERPRO / CE Mercante (Brasil) e Portbase (Holanda) em breve.' },
        { icon: 'docs' as FwIconName, title: 'Inteligência de Documentos', desc: 'Envie um BL, AWB ou fatura e a IA extrai os campos e sinaliza riscos.' },
      ],
    },
    howItWorks: {
      title: 'Do caos do inbox para fluxos estruturados',
      steps: [
        { num: '1', title: 'Conecte sua Caixa', desc: 'Conecte seu Gmail ou Outlook de forma segura. Novas mensagens carregam sempre que você abre ou atualiza a caixa, e você as analisa com um clique.' },
        { num: '2', title: 'IA Analisa Cada E-mail', desc: 'O sistema lê mensagens e identifica detalhes: portos, tipo de container, datas e intenção do cliente.' },
        { num: '3', title: 'Dados Estruturados', desc: 'Informações extraídas são exibidas de forma estruturada com sugestões de próximas ações.' },
        { num: '4', title: 'Revise & Envie', desc: 'Sua equipe pode revisar a resposta gerada pela IA e enviar imediatamente.' },
      ],
    },
    useCases: {
      title: 'Feito para equipes de freight forwarding',
      desc: 'Freightwizard é projetado para empresas que dependem de grandes volumes de comunicação de frete.',
      cases: [
        { icon: 'forwarder' as FwIconName, title: 'Freight Forwarders', desc: 'Automatize o processamento de inbox e responda mais rápido.' },
        { icon: 'operations' as FwIconName, title: 'Equipes de Operações', desc: 'Reduza tempo gasto classificando e-mails.' },
        { icon: 'sales' as FwIconName, title: 'Equipes de Vendas', desc: 'Nunca perca uma oportunidade escondida no inbox.' },
        { icon: 'small' as FwIconName, title: 'Pequenos Forwarders', desc: 'Escale operações sem contratar mais funcionários.' },
      ],
    },
    integrations: {
      title: 'Funciona com suas ferramentas',
      desc: 'Freightwizard integra com principais plataformas de e-mail.',
      supported: 'Integrações suportadas',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      complianceTitle: 'Compliance',
      compliance: ['Alertas de compliance MAPA (BR)'],
      future: 'Em breve',
      coming: ['SERPRO Integra Comex (BR)', 'CE Mercante (BR)', 'Portbase (NL)', 'Rastreamento ao vivo Terminal49', 'CargoWise', 'Descartes'],
    },
    pricing: {
      title: 'Preços simples e transparentes',
      monthly: 'Mensal',
      annual: 'Anual',
      annualNote: '2 meses grátis',
      perMonth: '/mês',
      perYear: '/ano',
      plans: [
        { name: 'Trial', price: 'Grátis', monthly: null, period: '', desc: '14 dias grátis: 30 análises, 5 embarques, 5 cotações. Sem cartão de crédito.', features: ['30 análises no total', '5 embarques', '5 cotações'], cta: 'Começar Teste Grátis' },
        { name: 'Starter', price: '$79', monthly: 79, period: '/mês', desc: '1 usuário', features: ['200 análises/mês', '10 embarques', '20 cotações', 'Construtor de cotações', 'Portal do cliente', 'Tabelas de tarifas', 'Suporte por email'], cta: 'Começar' },
        { name: 'Professional', price: '$179', monthly: 179, period: '/mês', desc: 'Até 5 usuários', features: ['Análises ilimitadas', 'Embarques ilimitados', 'Cotações ilimitadas', 'Inteligência de documentos', 'Ranking da equipe', 'Alertas de compliance MAPA (Brasil)', 'Suporte prioritário'], cta: 'Começar', popular: true },
        { name: 'Enterprise', price: 'A partir de $399', monthly: null, period: '/mês', desc: '10 usuários incluídos, usuários extras por contrato', contactSales: true, features: ['Tudo do Professional', 'Rastreamento de container (em breve)', 'Suporte dedicado'], cta: 'Fale Conosco' },
      ],
    },
    about: {
      title: 'Construído para a indústria logística',
      p1: 'Freightwizard foi criado para resolver um desafio comum no freight forwarding: gerenciar comunicação complexa de embarques por e-mail.',
      p2: 'Nosso objetivo é trazer automação moderna de IA para equipes de logística, mantendo a confiabilidade e controle necessários para fluxos operacionais.',
      p3: 'Focamos em construir ferramentas que ajudam profissionais de frete a trabalhar mais rápido, reduzir tarefas manuais e entregar melhor serviço aos seus clientes.',
    },
    faq: {
      title: 'Perguntas Frequentes',
      items: [
        { q: 'Como o Freightwizard acessa meus e-mails?', a: 'Usamos conexões OAuth seguras. Nunca armazenamos sua senha e você pode revogar acesso a qualquer momento.' },
        { q: 'Meus dados estão seguros?', a: 'Sim. Todos os dados são criptografados em trânsito e em repouso. Não usamos seus e-mails para treinar modelos de IA.' },
        { q: 'Posso editar respostas da IA?', a: 'Absolutamente. Toda sugestão pode ser revisada e editada antes de enviar.' },
        { q: 'Quais provedores de email suportam?', a: 'Gmail, Google Workspace, Outlook e Microsoft 365.' },
        { q: 'Vocês têm um plano para equipes maiores?', a: 'Sim. O Enterprise começa em $399/mês com 10 usuários incluídos; usuários extras são definidos por contrato. Fale com vendas para contratar.' },
        { q: 'Posso testar antes de comprar?', a: 'Sim. Comece com um teste grátis de 14 dias: 30 análises, 5 embarques e 5 cotações, sem cartão de crédito. Depois, o Starter custa $79/mês.' },
      ],
    },
    security: {
      title: 'Segurança & Proteção de Dados',
      desc: 'Freightwizard foi projetado com segurança como prioridade.',
      items: ['Conexões OAuth seguras', 'Criptografia em trânsito e em repouso', 'Não usamos seus e-mails para treinar modelos de IA', 'Toda requisição é autenticada, e seus dados são visíveis apenas para sua conta e sua equipe'],
    },
    cta: { title: 'Pronto para transformar seu inbox?', desc: 'Feito para equipes de freight forwarding que querem economizar tempo e ganhar mais negócios.', button: 'Começar Grátis' },
    footer: { desc: 'Gestão de e-mails com IA para freight forwarding.', product: 'Produto', company: 'Empresa', legal: 'Legal', links: { features: 'Recursos', pricing: 'Preços', integrations: 'Integrações', about: 'Sobre', blog: 'Blog', careers: 'Carreiras', privacy: 'Privacidade', terms: 'Termos' }, copy: '© 2026 Freightwizard. Todos os direitos reservados.' },
  },
  nl: {
    nav: { whatWeDo: 'Wat we doen', howItWorks: 'Hoe Het Werkt', useCases: 'Use Cases', pricing: 'Prijzen', aboutUs: 'Over Ons', signIn: 'Inloggen', signUp: 'Aanmelden' },
    hero: {
      badge: 'SUPERCHARGE JE VRACHT',
      title1: 'Jouw AI Copiloot',
      title2: 'voor ',
      title3: 'Freight Forwarding.',
      subtitle: 'Behandel vragen, offertes, follow-ups en zendingsclassificatie automatisch.',
      desc: 'Verminder e-mailwerklast en reageer sneller op vrachtvragen.',
      cta: 'Probeer gratis',
    },
    product: {
      title: 'Alles wat je vracht-inbox nodig heeft, geautomatiseerd door AI',
      desc: 'Freight forwarding operaties zijn sterk afhankelijk van e-mailcommunicatie. Offerteaanvragen, updates en follow-ups komen continu binnen.',
      desc2: 'Freightwizard gebruikt AI om e-mails te analyseren, zendingsinformatie te extraheren en acties automatisch voor te stellen.',
      features: [
        { icon: 'email' as FwIconName, title: 'AI E-mail Begrip', desc: 'Leest automatisch vracht-e-mails en extraheert details zoals havens, containertypes en data.' },
        { icon: 'workflow' as FwIconName, title: 'Slimme Suggesties', desc: 'Identificeert of een e-mail een offerteaanvraag, boeking of statusvraag is.' },
        { icon: 'reply' as FwIconName, title: 'AI Antwoorden', desc: 'Genereert professionele concepten die je team kan reviewen, aanpassen en versturen.' },
        { icon: 'priority' as FwIconName, title: 'Inbox Prioritering', desc: 'Markeert urgente e-mails en nieuwe offerteaanvragen, zodat er niets tussendoor glipt.' },
      ],
    },
    features: {
      title: 'Belangrijkste Functies',
      items: [
        { icon: 'extract' as FwIconName, title: 'Zendingsdata Extractie', desc: 'Detecteert havens, containertypes, lading en referenties automatisch.' },
        { icon: 'intent' as FwIconName, title: 'Intentie Detectie', desc: 'Classificeert e-mails als offertes, updates of tracking vragen.' },
        { icon: 'assistant' as FwIconName, title: 'Antwoord Assistent', desc: 'AI genereert accurate en professionele antwoorden.' },
        { icon: 'timeline' as FwIconName, title: 'Activiteit Tijdlijn', desc: 'Activiteitentijdlijn per e-mailthread: ontvangen, geanalyseerd, beantwoord, notities.' },
        { icon: 'analytics' as FwIconName, title: 'Analytics Dashboard', desc: 'Monitor e-mailvolume en teamproductiviteit.' },
        { icon: 'quote' as FwIconName, title: 'Offerte Bouwer', desc: 'Vult offertes vooraf in met data uit de e-mail zodat je ze direct kunt versturen.' },
        { icon: 'tracking' as FwIconName, title: 'Zending Tracker', desc: 'Kanban-bord dat zendingen uit je e-mails detecteert en de status actueel houdt.' },
        { icon: 'portal' as FwIconName, title: 'Klantportaal', desc: 'Deelbare tracking-link die je klant zonder login kan openen.' },
        { icon: 'rates' as FwIconName, title: 'Tarievenkaart Opslag', desc: 'Sla vervoerderstarieven per traject op en krijg ze voorgesteld in de offerte bouwer.' },
        { icon: 'compliance' as FwIconName, title: 'Land Compliance', desc: 'MAPA-compliancewaarschuwingen (Brazilië) ingebouwd. SERPRO / CE Mercante (Brazilië) en Portbase (Nederland) binnenkort.' },
        { icon: 'docs' as FwIconName, title: 'Document Intelligentie', desc: 'Upload een BL, AWB of factuur en AI extraheert de velden en markeert risico\'s.' },
      ],
    },
    howItWorks: {
      title: 'Van inbox-chaos naar gestructureerde workflows',
      steps: [
        { num: '1', title: 'Verbind Je Inbox', desc: 'Verbind Gmail of Outlook veilig. Nieuwe berichten laden elke keer dat je je inbox opent of vernieuwt, en je analyseert ze met één klik.' },
        { num: '2', title: 'AI Analyseert E-mails', desc: 'Het systeem leest berichten en identificeert zendingsdetails: havens, containertype, data.' },
        { num: '3', title: 'Gestructureerde Data', desc: 'Geëxtraheerde informatie wordt gestructureerd weergegeven met actie-suggesties.' },
        { num: '4', title: 'Review & Verstuur', desc: 'Je team kan het AI-antwoord reviewen, aanpassen en direct versturen.' },
      ],
    },
    useCases: {
      title: 'Gebouwd voor freight forwarding teams',
      desc: 'Freightwizard is ontworpen voor bedrijven die afhankelijk zijn van grote volumes vrachtcommunicatie.',
      cases: [
        { icon: 'forwarder' as FwIconName, title: 'Freight Forwarders', desc: 'Automatiseer inbox-verwerking en reageer sneller.' },
        { icon: 'operations' as FwIconName, title: 'Operations Teams', desc: 'Verminder tijd besteed aan e-mail sorteren.' },
        { icon: 'sales' as FwIconName, title: 'Sales Teams', desc: 'Mis nooit een kans verborgen in je inbox.' },
        { icon: 'small' as FwIconName, title: 'Kleine Forwarders', desc: 'Schaal operaties zonder extra personeel.' },
      ],
    },
    integrations: {
      title: 'Werkt met je bestaande tools',
      desc: 'Freightwizard integreert met grote e-mailplatforms.',
      supported: 'Ondersteunde integraties',
      current: ['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'],
      complianceTitle: 'Compliance',
      compliance: ['MAPA-compliancewaarschuwingen (BR)'],
      future: 'Binnenkort',
      coming: ['SERPRO Integra Comex (BR)', 'CE Mercante (BR)', 'Portbase (NL)', 'Terminal49 live tracking', 'CargoWise', 'Descartes'],
    },
    pricing: {
      title: 'Eenvoudige, transparante prijzen',
      monthly: 'Maandelijks',
      annual: 'Jaarlijks',
      annualNote: '2 maanden gratis',
      perMonth: '/maand',
      perYear: '/jaar',
      plans: [
        { name: 'Trial', price: 'Gratis', monthly: null, period: '', desc: '14 dagen gratis: 30 analyses, 5 zendingen, 5 offertes. Geen creditcard.', features: ['30 analyses totaal', '5 zendingen', '5 offertes'], cta: 'Start Gratis Proef' },
        { name: 'Starter', price: '$79', monthly: 79, period: '/maand', desc: '1 gebruiker', features: ['200 analyses/maand', '10 zendingen', '20 offertes', 'Offerte bouwer', 'Klantportaal', 'Tarievenkaarten', 'E-mail support'], cta: 'Aan de slag' },
        { name: 'Professional', price: '$179', monthly: 179, period: '/maand', desc: 'Tot 5 gebruikers', features: ['Onbeperkte analyses', 'Onbeperkte zendingen', 'Onbeperkte offertes', 'Document intelligentie', 'Team leaderboard', 'MAPA-compliancewaarschuwingen (Brazilië)', 'Priority support'], cta: 'Aan de slag', popular: true },
        { name: 'Enterprise', price: 'Vanaf $399', monthly: null, period: '/maand', desc: '10 gebruikers inbegrepen, extra gebruikers per contract', contactSales: true, features: ['Alles uit Professional', 'Container tracking (binnenkort)', 'Toegewijde support'], cta: 'Neem Contact Op' },
      ],
    },
    about: {
      title: 'Gebouwd voor de logistieke industrie',
      p1: 'Freightwizard is gemaakt om een veelvoorkomende uitdaging in freight forwarding op te lossen: het beheren van complexe zendingscommunicatie via e-mail.',
      p2: 'Ons doel is om moderne AI-automatisering naar logistieke teams te brengen, met behoud van de betrouwbaarheid en controle die nodig is voor operationele workflows.',
      p3: 'We richten ons op het bouwen van tools die vrachtprofessionals helpen sneller te werken, handmatige taken te verminderen en betere service aan hun klanten te leveren.',
    },
    faq: {
      title: 'Veelgestelde Vragen',
      items: [
        { q: 'Hoe krijgt Freightwizard toegang tot mijn e-mails?', a: 'We gebruiken veilige OAuth-verbindingen. We slaan je wachtwoord nooit op.' },
        { q: 'Zijn mijn gegevens veilig?', a: 'Ja. Alle data is versleuteld tijdens verzending en opslag. We gebruiken je e-mails niet om AI-modellen te trainen.' },
        { q: 'Kan ik AI-antwoorden bewerken?', a: 'Absoluut. Elke suggestie kan worden gereviewd en bewerkt voor verzending.' },
        { q: 'Welke e-mailproviders ondersteunen jullie?', a: 'Gmail, Google Workspace, Outlook en Microsoft 365.' },
        { q: 'Hebben jullie een plan voor grotere teams?', a: 'Ja. Enterprise begint vanaf $399/maand met 10 gebruikers inbegrepen; extra gebruikers worden per contract geregeld. Neem contact op met sales.' },
        { q: 'Kan ik uitproberen voor aankoop?', a: 'Ja. Begin met een gratis proefperiode van 14 dagen: 30 analyses, 5 zendingen en 5 offertes, geen creditcard. Daarna kost Starter $79/maand.' },
      ],
    },
    security: {
      title: 'Beveiliging & Gegevensbescherming',
      desc: 'Freightwizard is ontworpen met beveiliging als prioriteit.',
      items: ['Veilige OAuth verbindingen', 'Versleuteld tijdens verzending en opslag', 'We gebruiken je e-mails niet om AI-modellen te trainen', 'Elk verzoek wordt geauthenticeerd en je gegevens zijn alleen zichtbaar voor je account en je team'],
    },
    cta: { title: 'Klaar om je inbox te transformeren?', desc: 'Gebouwd voor freight forwarding teams die tijd willen besparen en meer business willen winnen.', button: 'Start Gratis' },
    footer: { desc: 'AI-gestuurd e-mailbeheer voor freight forwarding.', product: 'Product', company: 'Bedrijf', legal: 'Juridisch', links: { features: 'Functies', pricing: 'Prijzen', integrations: 'Integraties', about: 'Over Ons', blog: 'Blog', careers: 'Vacatures', privacy: 'Privacy', terms: 'Voorwaarden' }, copy: '© 2026 Freightwizard. Alle rechten voorbehouden.' },
  },
};

type Language = 'en' | 'pt' | 'nl';

export default function HomePage() {
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);

  const t = translations[language];
  const langLabels: Record<Language, string> = { en: 'EN', pt: 'PT', nl: 'NL' };

  const navLink = 'text-fw-small text-fw-ink-2 transition-colors hover:text-fw-ink';
  const langButton = 'flex min-h-[2.75rem] items-center gap-1.5 rounded-fw-btn border border-fw-line px-3 font-fw-mono text-fw-data text-fw-ink-2 transition-colors hover:border-fw-line-strong hover:text-fw-ink';
  const tag = 'rounded-fw-btn border border-fw-line bg-fw-panel px-3 py-1.5 font-fw-mono text-fw-data';
  const statusTag = 'rounded-fw-btn bg-fw-indigo-tint px-2 py-0.5 font-fw-mono text-fw-data-xs uppercase text-fw-indigo-200';

  const langMenu = langMenuOpen && (
    <div className="absolute right-0 top-full mt-2 overflow-hidden rounded-fw-card border border-fw-line bg-fw-raised shadow-fw-frame">
      {(['en', 'pt', 'nl'] as Language[]).map((l) => (
        <button key={l} onClick={() => { setLanguage(l); setLangMenuOpen(false); }} className="w-full px-4 py-2 text-left font-fw-mono text-fw-data text-fw-ink-2 hover:bg-fw-panel hover:text-fw-ink">
          {langLabels[l]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-fw-canvas font-fw-sans text-fw-body text-fw-ink antialiased selection:bg-fw-indigo-500 selection:text-fw-white [&_:focus-visible]:rounded-[2px] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-fw-indigo-300">
      <RevealObserver />

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-fw-line bg-fw-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-10">
          <Link href="/" className="flex items-center">
            <Logo tone="white" height={22} />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-8 lg:flex">
            <a href="#product" className={navLink}>{t.nav.whatWeDo}</a>
            <a href="#how-it-works" className={navLink}>{t.nav.howItWorks}</a>
            <a href="#use-cases" className={navLink}>{t.nav.useCases}</a>
            <a href="#pricing" className={navLink}>{t.nav.pricing}</a>
            <a href="#about" className={navLink}>{t.nav.aboutUs}</a>
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            {/* Language Selector */}
            <div className="relative">
              <button onClick={() => setLangMenuOpen(!langMenuOpen)} aria-expanded={langMenuOpen} className={langButton}>
                {langLabels[language]} <FwIcon name="chevron" size={14} />
              </button>
              {langMenu}
            </div>

            <Link href="/dashboard" className={navLink}>{t.nav.signIn}</Link>
            <ButtonLink href="/dashboard">{t.nav.signUp}</ButtonLink>
          </div>

          {/* Mobile: Language Selector + Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="relative">
              <button onClick={() => { setLangMenuOpen(!langMenuOpen); setMobileMenuOpen(false); }} aria-expanded={langMenuOpen} className={langButton}>
                {langLabels[language]} <FwIcon name="chevron" size={14} />
              </button>
              {langMenu}
            </div>
            <button onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setLangMenuOpen(false); }} aria-expanded={mobileMenuOpen} aria-label="Menu" className="flex size-11 items-center justify-center text-2xl text-fw-ink">☰</button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="space-y-4 border-t border-fw-line bg-fw-panel px-4 py-4 lg:hidden">
            <a href="#product" className="block text-fw-ink-2">{t.nav.whatWeDo}</a>
            <a href="#how-it-works" className="block text-fw-ink-2">{t.nav.howItWorks}</a>
            <a href="#use-cases" className="block text-fw-ink-2">{t.nav.useCases}</a>
            <a href="#pricing" className="block text-fw-ink-2">{t.nav.pricing}</a>
            <a href="#about" className="block text-fw-ink-2">{t.nav.aboutUs}</a>
            <ButtonLink href="/dashboard" className="w-full">{t.nav.signUp}</ButtonLink>
          </div>
        )}
      </nav>

      {/* Hero Section with Immersive Globe */}
      <section className="relative min-h-screen overflow-hidden bg-fw-canvas">
        {/* Layer 1: globe */}
        <div className="absolute inset-0 z-0 flex items-start justify-center pt-16">
          <div className="w-[320px] max-w-[85vw] shrink-0 md:w-[560px] md:max-w-[75vw]">
            <FreightGlobe />
          </div>
        </div>

        {/* Layer 2: contrast gradients */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-fw-canvas via-fw-canvas/40 to-transparent"></div>
          <div className="absolute bottom-0 left-1/2 h-[50%] w-[60%] -translate-x-1/2 rounded-full bg-fw-canvas/40 blur-3xl"></div>
        </div>

        {/* Layer 3: content */}
        <div className="pointer-events-none relative z-20 flex min-h-screen flex-col items-center justify-start px-4 pb-8 pt-56 text-center md:justify-end md:px-6 md:pb-16 md:pt-[40vh]">
          <div className="mb-6 rounded-fw-btn bg-fw-canvas/80 px-3 py-2 backdrop-blur-sm">
            <Eyebrow>{t.hero.badge}</Eyebrow>
          </div>

          <h1 className="mb-6 max-w-4xl font-fw-display text-fw-h1 font-light text-fw-ink">
            {t.hero.title1}
            <br />
            {t.hero.title2}
            <span className="font-semibold text-fw-indigo-300">{t.hero.title3}</span>
          </h1>

          <p className="mb-3 max-w-2xl px-4 text-fw-lead text-fw-ink-2">
            {t.hero.subtitle}
          </p>
          <p className="mb-8 max-w-2xl px-4 text-fw-small text-fw-ink-3">
            {t.hero.desc}
          </p>

          <ButtonLink href="/dashboard" className="pointer-events-auto px-8">
            {t.hero.cta}
          </ButtonLink>
        </div>
      </section>

      {/* Product Section */}
      <Section id="product" labelledBy="product-title">
        <SectionHeader
          id="product-title"
          eyebrow={t.nav.whatWeDo}
          title={t.product.title}
          intro={<><p>{t.product.desc}</p><p>{t.product.desc2}</p></>}
          className="mb-12 md:mb-16"
        />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {t.product.features.map((feature, i) => (
            <FeatureCard key={i} icon={feature.icon} title={feature.title} text={feature.desc} index={i} />
          ))}
        </div>
      </Section>

      {/* Features Grid */}
      <Section labelledBy="features-title">
        <SectionHeader id="features-title" eyebrow={t.footer.links.features} title={t.features.title} className="mb-12 md:mb-16" />
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((feature, i) => (
            <div key={i} data-reveal style={revealDelay(i % 3)} className="group flex gap-4">
              <IconFrame name={feature.icon} />
              <div>
                <h3 className={`mb-1 font-fw-display text-fw-h3 font-semibold text-fw-ink ${titleHover}`}>{feature.title}</h3>
                <p className="text-fw-small text-fw-ink-2">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* How It Works */}
      <Section id="how-it-works" labelledBy="how-title">
        <SectionHeader id="how-title" eyebrow={t.nav.howItWorks} title={t.howItWorks.title} className="mb-12 md:mb-16" />
        <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {t.howItWorks.steps.map((step, i) => (
            <li key={i} data-reveal style={revealDelay(i, 90)} className="border-t border-fw-line-strong pt-5">
              <span className="font-fw-mono text-fw-data text-fw-indigo-300">{step.num.padStart(2, '0')}</span>
              <h3 className="mb-2 mt-3 font-fw-display text-fw-h3 font-semibold text-fw-ink">{step.title}</h3>
              <p className="text-fw-small text-fw-ink-2">{step.desc}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Use Cases */}
      <Section id="use-cases" labelledBy="use-cases-title">
        <SectionHeader id="use-cases-title" eyebrow={t.nav.useCases} title={t.useCases.title} intro={<p>{t.useCases.desc}</p>} className="mb-12 md:mb-16" />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {t.useCases.cases.map((useCase, i) => (
            <FeatureCard key={i} icon={useCase.icon} title={useCase.title} text={useCase.desc} index={i} align="center" />
          ))}
        </div>
      </Section>

      {/* Integrations */}
      <Section id="integrations" labelledBy="integrations-title" width="max-w-4xl">
        <SectionHeader id="integrations-title" eyebrow={t.footer.links.integrations} title={t.integrations.title} intro={<p>{t.integrations.desc}</p>} className="mb-12" />

        {[
          { title: t.integrations.supported, items: t.integrations.current, soon: false },
          { title: t.integrations.complianceTitle, items: t.integrations.compliance, soon: false },
          { title: t.integrations.future, items: t.integrations.coming, soon: true },
        ].map((group, g) => (
          <div key={g} data-reveal style={revealDelay(g, 90)} className="mb-8 last:mb-0">
            <h3 className={`mb-4 text-center font-fw-mono text-fw-eyebrow uppercase ${group.soon ? 'text-fw-ink-3' : 'text-fw-indigo-300'}`}>{group.title}</h3>
            <ul className="flex flex-wrap justify-center gap-3">
              {group.items.map((int, i) => (
                <li key={i} className={group.soon ? `${tag} border-dashed bg-transparent text-fw-ink-3` : `${tag} text-fw-ink`}>
                  {int}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {/* Pricing */}
      <Section id="pricing" labelledBy="pricing-title">
        <SectionHeader id="pricing-title" eyebrow={t.nav.pricing} title={t.pricing.title} className="mb-8" />
        <div data-reveal className="mb-12 flex flex-wrap items-center justify-center gap-3 md:mb-14">
          <div role="group" aria-label="Billing period" className="inline-flex rounded-fw-btn border border-fw-line bg-fw-panel p-1">
            {[{ label: t.pricing.monthly, value: false }, { label: t.pricing.annual, value: true }].map((opt) => (
              <button
                key={opt.label}
                type="button"
                aria-pressed={annual === opt.value}
                onClick={() => setAnnual(opt.value)}
                className={`min-h-[2.25rem] rounded-[2px] px-4 text-fw-small transition-colors ${annual === opt.value ? 'bg-fw-raised text-fw-ink' : 'text-fw-ink-3 hover:text-fw-ink'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className={statusTag}>{t.pricing.annualNote}</span>
        </div>
        <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {t.pricing.plans.map((plan, i) => (
            <div
              key={i}
              data-reveal
              style={revealDelay(i)}
              className={`flex flex-col rounded-fw-card border bg-fw-panel p-6 ${plan.popular ? 'border-fw-indigo-500 shadow-fw-frame' : 'border-fw-line'}`}
            >
              {/* Tag row: reserved on every card from lg up so prices line up across the row */}
              <div className={`mb-3 h-5 ${plan.popular ? "" : "hidden lg:block"}`}>
                {plan.popular && <span className={statusTag}>MOST POPULAR</span>}
              </div>
              <h3 className="font-fw-display text-fw-h3 font-semibold text-fw-ink">{plan.name}</h3>
              <div className="mb-2 mt-4 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-fw-display text-fw-price font-semibold text-fw-ink">
                  {plan.monthly == null ? plan.price : <CountUp value={annual ? plan.monthly * 10 : plan.monthly} prefix="$" />}
                </span>
                <span className={`font-fw-mono text-fw-data text-fw-ink-3 ${plan.monthly == null ? "basis-full [text-wrap:balance]" : ""}`}>{plan.monthly == null ? plan.period : (annual ? t.pricing.perYear : t.pricing.perMonth)}</span>
              </div>
              <p className="mb-6 text-fw-small text-fw-ink-2">{plan.desc}</p>
              <ul className="mb-6 flex-grow space-y-3 border-t border-fw-line pt-5">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5 font-fw-mono text-fw-data text-fw-ink-2">
                    <FwIcon name="check" size={16} className="mt-[3px] text-fw-indigo-300" /> {f}
                  </li>
                ))}
              </ul>
              <ButtonLink href={(plan as { contactSales?: boolean }).contactSales ? SALES_CONTACT : '/dashboard'} variant={plan.popular ? 'primary' : 'secondary'} className="mt-auto w-full">
                {plan.cta}
              </ButtonLink>
            </div>
          ))}
        </div>
      </Section>

      {/* About Section */}
      <Section id="about" labelledBy="about-title" width="max-w-4xl">
        <SectionHeader id="about-title" eyebrow={t.nav.aboutUs} title={t.about.title} className="mb-8" />
        <div data-reveal className="mx-auto max-w-3xl space-y-6 text-fw-lead text-fw-ink-2">
          <p>{t.about.p1}</p>
          <p>{t.about.p2}</p>
          <p>{t.about.p3}</p>
        </div>
      </Section>

      {/* FAQ */}
      <Section labelledBy="faq-title" width="max-w-3xl">
        <SectionHeader id="faq-title" title={t.faq.title} className="mb-12 md:mb-16" />
        <div className="space-y-3">
          {t.faq.items.map((faq, i) => (
            <div key={i} data-reveal style={revealDelay(i, 50)} className="overflow-hidden rounded-fw-card border border-fw-line bg-fw-panel">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex min-h-[2.75rem] w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-fw-raised"
              >
                <span className="font-medium text-fw-ink">{faq.q}</span>
                <FwIcon name={openFaq === i ? 'minus' : 'plus'} size={20} className="text-fw-indigo-300" />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-fw-small text-fw-ink-2">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section labelledBy="security-title" width="max-w-4xl">
        <SectionHeader id="security-title" title={t.security.title} intro={<p>{t.security.desc}</p>} className="mb-8" />
        <ul data-reveal className="flex flex-wrap justify-center gap-3">
          {t.security.items.map((item, i) => (
            <li key={i} className={`${tag} flex items-center gap-2 text-fw-ink-2`}>
              <FwIcon name="check" size={16} className="flex-none text-fw-indigo-300" /> {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* Final CTA */}
      <Section labelledBy="cta-title" width="max-w-4xl">
        <SectionHeader id="cta-title" title={t.cta.title} intro={<p>{t.cta.desc}</p>} className="mb-8" />
        <div data-reveal className="text-center">
          <ButtonLink href="/dashboard" className="px-10">{t.cta.button}</ButtonLink>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-fw-line bg-fw-canvas px-4 py-12 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center">
                <Logo tone="white" height={20} />
              </div>
              <p className="text-fw-small text-fw-ink-3">{t.footer.desc}</p>
            </div>
            {[
              { title: t.footer.product, links: [['#product', t.footer.links.features], ['#pricing', t.footer.links.pricing], ['#integrations', t.footer.links.integrations]] },
              { title: t.footer.company, links: [['#about', t.footer.links.about], ['#', t.footer.links.blog], ['#', t.footer.links.careers]] },
              { title: t.footer.legal, links: [['#', t.footer.links.terms]] }, // Privacy link returns when a privacy page exists
            ].map((col) => (
              <div key={col.title}>
                <h4 className="mb-4 font-fw-mono text-fw-eyebrow uppercase text-fw-ink-2">{col.title}</h4>
                <ul className="space-y-2 text-fw-small text-fw-ink-3">
                  {col.links.map(([href, label]) => (
                    <li key={label}><a href={href} className="transition-colors hover:text-fw-ink">{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-fw-line pt-8 text-center font-fw-mono text-fw-data text-fw-ink-3">
            {t.footer.copy}
          </div>
        </div>
      </footer>
    </div>
  );
}
