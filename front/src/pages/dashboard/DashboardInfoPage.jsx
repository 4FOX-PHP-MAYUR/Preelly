import { Link } from 'react-router-dom'
import { ArrowLeft, HelpCircle, LifeBuoy, Mail, MessageCircle, Phone } from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'

const PAGES = {
  support: {
    title: 'Support',
    description: 'Get help with your Preelly account, listings, and orders.',
    icon: LifeBuoy,
    body: [
      'Our support team can help with account access, verification, payments, and listing issues.',
      'For fastest help, include your registered email and a short description of the problem.',
    ],
    actions: [
      { label: 'Email Support', href: 'mailto:support@preelly.com', icon: Mail },
      { label: 'Open Chat', href: '/chat', icon: MessageCircle, internal: true },
    ],
  },
  faq: {
    title: 'FAQ',
    description: 'Answers to common questions about buying and selling on Preelly.',
    icon: HelpCircle,
    faqs: [
      {
        q: 'How do I verify my account?',
        a: 'Go to My Profile or Privacy & Security and complete OTP verification, then submit your Emirates ID for identity verification.',
      },
      {
        q: 'How do I post an ad?',
        a: 'Use the Post Your Ad button in the sidebar, choose a category, add photos/details, and publish.',
      },
      {
        q: 'How do I manage my addresses and bank details?',
        a: 'Open My Profile to add, edit, or set a primary address, bank account, or saved card.',
      },
      {
        q: 'How do I block someone?',
        a: 'Open a chat, tap More, then Block. You can unblock them later from Blocked Users.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    description: 'Reach the Preelly team directly.',
    icon: Phone,
    body: [
      'We typically respond within 1 business day.',
      'Prefer chat for active order or listing questions, and email for account or legal requests.',
    ],
    actions: [
      { label: 'support@preelly.com', href: 'mailto:support@preelly.com', icon: Mail },
      { label: 'Chat with us', href: '/chat', icon: MessageCircle, internal: true },
    ],
  },
}

export default function DashboardInfoPage({ pageKey }) {
  const page = PAGES[pageKey] || PAGES.support
  const Icon = page.icon

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{page.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{page.description}</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
            <Icon className="h-6 w-6" />
          </div>

          {page.body?.map((paragraph) => (
            <p key={paragraph} className="mb-3 text-sm leading-relaxed text-slate-600">
              {paragraph}
            </p>
          ))}

          {page.faqs ? (
            <div className="mt-2 space-y-4">
              {page.faqs.map((item) => (
                <div key={item.q} className="border-t border-[#E5E7EB] pt-4 first:border-t-0 first:pt-0">
                  <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </div>
              ))}
            </div>
          ) : null}

          {page.actions ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {page.actions.map((action) => {
                const ActionIcon = action.icon
                const className =
                  'inline-flex items-center gap-2 rounded-[12px] border border-brand/20 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand transition duration-200 hover:bg-brand-100'
                if (action.internal) {
                  return (
                    <Link key={action.label} to={action.href} className={className}>
                      <ActionIcon className="h-4 w-4" />
                      {action.label}
                    </Link>
                  )
                }
                return (
                  <a key={action.label} href={action.href} className={className}>
                    <ActionIcon className="h-4 w-4" />
                    {action.label}
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </SettingsPageShell>
  )
}
