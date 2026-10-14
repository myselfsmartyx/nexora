import { LEGAL_INFO, LEGAL_READY } from '../lib/legalInfo.js'
import { TRIAL_DAYS } from '../lib/billing/plans.js'

const { product: P, operator, email, jurisdiction, updated } = LEGAL_INFO

// Plain data: [heading, [paragraphs or { list: [...] }]]
const TERMS = [
  ['About these terms', [
    `${P} is a personal operating system app that helps you capture what you learn, organise it, journal, train your brain and build better habits. ${P} is operated by ${operator} ("we", "us"). By creating an account or using ${P} you agree to these terms. If you do not agree, please do not use it.`,
  ]],
  ['Your account', [
    'You must be at least 18 years old to use Nexora. Give us accurate information, keep your login private, and tell us if you think someone else has accessed your account. You are responsible for what happens under your account.',
  ]],
  ['Using Nexora', [
    'You agree not to:',
    { list: [
      'break the law or use Nexora to store or share unlawful content',
      'try to access other people\'s data, or probe, attack or disrupt our systems',
      'scrape, resell or automate Nexora in ways it was not designed for',
      'work around usage limits or plan restrictions',
      'reverse engineer or copy the app',
    ] },
  ]],
  ['Your content', [
    'You own what you save and write in Nexora. You give us a limited licence to store and process it only to run the service for you, including sending it to our AI provider when you use an AI feature.',
    'Private journal entries are end-to-end encrypted on your device, so we cannot read them. If you lose the means to unlock them, we may not be able to recover them.',
  ]],
  ['AI features', [
    'Nexora uses AI to analyse your saved content, answer questions and write suggestions. AI can be wrong or incomplete. Check anything important before you rely on it. AI output is not professional, legal, financial or medical advice.',
  ]],
  ['Health information', [
    'The Physical section helps you track and understand your own patterns. It is for information only. It does not diagnose, treat or prevent any condition and is not a substitute for a doctor. In an emergency, contact your local emergency number.',
  ]],
  ['Plans, trials and billing', [
    'Nexora has a Free plan and a paid Pro plan. Free and Pro have different usage limits, shown on the pricing page. Prices are listed in US dollars; at checkout you will see the amount in your local currency, and any tax that applies.',
    'Payments are processed by Dodo Payments, which acts as the merchant of record. We never see or store your card details.',
    TRIAL_DAYS > 0
      ? `Free trial: new Pro subscribers may get a ${TRIAL_DAYS}-day free trial. You must add a payment method to start it. If you do not cancel before the trial ends, your plan starts and you are charged the price shown at checkout.`
      : 'Pro subscriptions start when you complete checkout.',
    'Renewal and cancellation: Pro renews automatically each month or year until you cancel. You can cancel at any time in Settings, under Account. Cancelling stops future renewals, and you keep Pro until the end of the period you have already paid for.',
    'If a payment fails, we may give a short grace period before Pro ends. If we change the price, we will tell you in advance, and the new price applies from your next renewal.',
    'Refunds are covered in our Refund Policy.',
  ]],
  ['Changes to the service', [
    'We may improve, change or remove features, and may suspend the service for maintenance. If we make a change that significantly affects paying customers, we will give notice where we reasonably can.',
  ]],
  ['Ending your account', [
    'You can delete your account in Settings at any time. We may suspend or end an account that breaks these terms or puts others or the service at risk.',
  ]],
  ['Disclaimers and liability', [
    'Nexora is provided "as is" and "as available". We work hard to keep it reliable, but we do not promise it will be uninterrupted or error-free.',
    'To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability to you for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under law that cannot be limited.',
  ]],
  ['Governing law', [
    `These terms are governed by the laws of ${jurisdiction}. Courts in ${jurisdiction} have jurisdiction over disputes, unless the law of your country gives you the right to bring a claim elsewhere.`,
  ]],
  ['Changes to these terms and contact', [
    `We may update these terms. If the changes matter, we will tell you in the app or by email. Questions: ${email}.`,
  ]],
]

const PRIVACY = [
  ['Who we are', [
    `${P} is operated by ${operator}. This policy explains what personal information we collect, why, and what you can do about it. Contact: ${email}.`,
  ]],
  ['What we collect', [
    { list: [
      'Account details, such as your email address and display name.',
      'What you save and write: links, notes, voice-note transcripts, files, journal entries, and the analysis Nexora produces from them.',
      'Health-related information you choose to log in the Physical section. We treat this as sensitive.',
      'Brain-training results from Neuro+ (scores, session times).',
      'Usage counts, so we can apply fair daily limits to AI features.',
      'Billing status: your plan, renewal dates and the identifiers our payment provider gives us. We do not receive or store card numbers.',
      'Basic technical data our hosting providers record when you use the service, such as IP address and timestamps.',
    ] },
  ]],
  ['How we use it', [
    { list: [
      'To run Nexora: store your content, analyse it, search it and show it back to you.',
      'To provide AI features you ask for.',
      'To take payments, manage your subscription and send account and billing emails, such as a trial-ending reminder.',
      'To keep the service secure, prevent abuse and fix problems.',
      'To meet legal and tax obligations.',
    ] },
    'We do not sell your personal information, and we do not use it for advertising.',
  ]],
  ['Your journal', [
    'Entries you mark private are end-to-end encrypted on your device before they are saved. We cannot read them, and they are not sent to AI features unless you choose to unlock and use them with one.',
  ]],
  ['AI processing', [
    'When you use an AI feature, the text needed for that request is sent to our AI provider, Groq, to generate the result. We send only what the request needs. Please read Groq\'s own privacy policy to learn how it handles data.',
  ]],
  ['Who we share information with', [
    'We use a small number of service providers who process data for us:',
    { list: [
      'Supabase: database, sign-in and file storage.',
      'Groq: AI processing.',
      'Dodo Payments: payments, tax and invoices, as our merchant of record.',
      'Vercel: website hosting.',
      'An email delivery provider, for account and billing emails.',
    ] },
    'We may also share information if the law requires it, or to protect people and the service. We do not currently use advertising trackers or third-party analytics. If that changes, we will update this policy first.',
  ]],
  ['Keeping and deleting your data', [
    'We keep your data while your account is open. You can delete your account in Settings, which removes your content from our systems. Billing and tax records may be kept for as long as the law requires.',
  ]],
  ['Your choices and rights', [
    `You can access, correct, export or delete your information, and you can withdraw consent where we rely on it. Most of this is available in Settings (including exporting your data). For anything else, email ${email} and we will respond within a reasonable time. Depending on where you live, you may also have the right to complain to your local data protection authority.`,
  ]],
  ['Security', [
    'We protect data with encryption in transit, per-user access rules in our database, and end-to-end encryption for private journal entries. No system is perfectly secure, so please use a strong password and app lock.',
  ]],
  ['Children', [
    'Nexora is not intended for anyone under 18, and we do not knowingly collect their information.',
  ]],
  ['Where data is processed', [
    'Our providers may process data in countries other than your own. We choose providers that protect it appropriately.',
  ]],
  ['Changes and contact', [
    `We may update this policy and will tell you about important changes. For privacy questions or complaints, contact ${email}.`,
  ]],
]

const REFUNDS = [
  ['Free trial', [
    TRIAL_DAYS > 0
      ? `Cancel any time during your ${TRIAL_DAYS}-day trial and you are not charged. We email you before the trial ends.`
      : 'Pro starts when you complete checkout.',
  ]],
  ['Monthly plans', [
    'You can cancel at any time. Cancelling stops the next renewal, and you keep Pro until the period you paid for ends. We do not refund part-months.',
  ]],
  ['Annual plans', [
    `If you are on an annual plan and want a refund, email ${email} within 7 days of your first annual charge and we will refund it in full. After that, annual plans are not refundable, but you can cancel to stop renewal and keep Pro until the year ends.`,
  ]],
  ['When we always refund', [
    { list: [
      'You were charged twice, or charged by mistake.',
      'You were charged after you cancelled in time.',
      'A problem on our side stopped you from using Pro for a long period.',
    ] },
  ]],
  ['How to ask', [
    `Email ${email} from the address on your account and tell us what happened. We aim to reply within 5 business days. Refunds go back to the original payment method, and your bank may take several days to show them.`,
    'Please contact us before raising a dispute with your bank. We would much rather fix it directly.',
  ]],
  ['Your legal rights', [
    'This policy does not limit any rights you have under the law where you live.',
  ]],
]

const DOCS = {
  terms: { title: 'Terms of Service', sections: TERMS },
  privacy: { title: 'Privacy Policy', sections: PRIVACY },
  refunds: { title: 'Refund Policy', sections: REFUNDS },
}

const NAV = [['terms', '/terms', 'Terms'], ['privacy', '/privacy', 'Privacy'], ['refunds', '/refunds', 'Refunds']]

export default function Legal({ kind }) {
  const doc = DOCS[kind] || DOCS.terms
  return (
    <div className="min-h-screen bg-base-bg text-ink-secondary">
      <main className="max-w-2xl mx-auto px-md py-lg">
        <a href="/" className="inline-flex items-center gap-2 text-body-small text-ink-secondary hover:text-ink-primary transition">
          <span aria-hidden>&larr;</span> Back to {P}
        </a>

        {!LEGAL_READY && (
          <p role="note" className="mt-md rounded-card border border-warning/40 bg-warning/10 p-md text-body-small text-ink-primary">
            Draft: add your name and support email in src/lib/legalInfo.js before publishing this page.
          </p>
        )}

        <h1 className="text-h1 text-ink-primary mt-lg">{doc.title}</h1>
        <p className="text-caption text-ink-tertiary mt-1">Last updated {updated}</p>

        <div className="mt-lg flex flex-col gap-lg">
          {doc.sections.map(([heading, blocks]) => (
            <section key={heading}>
              <h2 className="text-h3 text-ink-primary mb-sm">{heading}</h2>
              <div className="flex flex-col gap-sm">
                {blocks.map((b, i) => (
                  typeof b === 'string'
                    ? <p key={i} className="text-body-small leading-relaxed">{b}</p>
                    : (
                      <ul key={i} className="list-disc pl-5 flex flex-col gap-1.5 text-body-small leading-relaxed">
                        {b.list.map((li) => <li key={li}>{li}</li>)}
                      </ul>
                    )
                ))}
              </div>
            </section>
          ))}
        </div>

        <nav aria-label="Other policies" className="mt-xl pt-md border-t border-base-border flex gap-md text-body-small">
          {NAV.filter(([k]) => k !== kind).map(([k, href, label]) => (
            <a key={k} href={href} className="underline text-ink-secondary hover:text-ink-primary">{label}</a>
          ))}
        </nav>
      </main>
    </div>
  )
}
