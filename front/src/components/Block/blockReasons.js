/** Shared display helpers for block / report flows. */
export function displayNameOf(user) {
  if (!user) return 'User'
  return user.displayName || user.name || 'User'
}

export function usernameOf(user) {
  if (!user) return ''
  const raw = user.username || user.instagramUsername || user.email?.split?.('@')?.[0] || ''
  return String(raw).replace(/^@/, '')
}

export function roleLabelOf(user) {
  if (!user?.role) return 'Member'
  if (user.role === 'admin' || user.role === 'super_admin') return 'Admin'
  if (user.role === 'dealer' || user.role === 'seller') return 'Dealer'
  return 'Member'
}

/** Multi-step report reasons for reporting another user (not ads / not block). */
export const REPORT_REASON_TREE = [
  {
    id: 'scam',
    label: 'Scam, fraud or impersonation',
    prompt: 'Which best describes the problem?',
    children: [
      {
        id: 'fraud',
        label: 'Fraud or scam',
        prompt: 'What kind of fraud or scam?',
        children: [
          { id: 'financial', label: 'Financial or identity scam' },
          { id: 'fake_listing', label: 'Fake listing or goods' },
          { id: 'payment', label: 'Payment scam' },
        ],
      },
      {
        id: 'impersonation',
        label: 'Impersonation',
        prompt: 'What kind of impersonation?',
        children: [
          { id: 'fake_account', label: 'Fake or stolen identity' },
          { id: 'business_impersonation', label: 'Impersonating a business' },
        ],
      },
    ],
  },
  {
    id: 'political',
    label: 'Unauthorized political ad',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'unauthorized_political', label: 'Unauthorized political content' },
      { id: 'misleading_political', label: 'Misleading political claims' },
    ],
  },
  {
    id: 'adult',
    label: 'Adult content',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'sexual', label: 'Sexual or explicit content' },
      { id: 'solicitation', label: 'Sexual solicitation' },
    ],
  },
  {
    id: 'restricted',
    label: 'Selling or promoting restricted items',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'illegal_goods', label: 'Illegal goods or services' },
      { id: 'weapons', label: 'Weapons or dangerous items' },
      { id: 'drugs', label: 'Drugs or controlled substances' },
    ],
  },
  {
    id: 'violence',
    label: 'Violence, hate or exploitation',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'hate', label: 'Hate speech or discrimination' },
      { id: 'violence_threats', label: 'Violent threats or content' },
      { id: 'exploitation', label: 'Exploitation' },
    ],
  },
  {
    id: 'harassment',
    label: 'Bullying or unwanted contact',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'harassment', label: 'Harassment or bullying' },
      { id: 'spam_contact', label: 'Spam or unwanted messages' },
      { id: 'threats', label: 'Threats or intimidation' },
    ],
  },
  {
    id: 'ip',
    label: 'Intellectual property',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'copyright', label: 'Copyright infringement' },
      { id: 'trademark', label: 'Trademark infringement' },
      { id: 'counterfeit', label: 'Counterfeit goods' },
    ],
  },
  {
    id: 'self_harm',
    label: 'Suicide or self-harm',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'self_harm_content', label: 'Self-harm content' },
      { id: 'suicide_content', label: 'Suicide-related content' },
    ],
  },
  {
    id: 'false_info',
    label: 'False information',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'misleading', label: 'Misleading profile or ads' },
      { id: 'fake_reviews', label: 'Fake reviews or ratings' },
    ],
  },
  {
    id: 'under_18',
    label: 'Problem involving someone under 18',
    prompt: 'Which best describes the problem?',
    children: [
      { id: 'underage_account', label: 'Underage account' },
      { id: 'child_safety', label: 'Child safety concern' },
    ],
  },
]

export const REPORT_REVIEW_QUESTIONS = [
  'Why are you reporting this user?',
  'Which best describes the problem?',
  'What kind of fraud or scam?',
]
