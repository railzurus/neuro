import { Link } from 'react-router-dom'

/** Shared layout + building blocks for the legal pages (privacy / terms / consent). */

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-10">
      <h1 className="font-serif text-4xl leading-tight text-ink-900">{title}</h1>
      {subtitle && <p className="mt-3 text-sm text-ink-400">{subtitle}</p>}
      {children}
    </div>
  )
}

export function LegalHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-2xl text-ink-900 border-t border-black/[0.06] pt-8">
      {children}
    </h2>
  )
}

export function LegalTerm({
  term,
  children,
}: {
  term: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 rounded-2xl glass p-4 sm:grid-cols-[minmax(9rem,12rem)_1fr] sm:gap-4">
      <dt className="font-medium text-ink-900">{term}</dt>
      <dd className="text-ink-600">{children}</dd>
    </div>
  )
}

/**
 * Consent line shown right before the "Начать" / "Начните прямо сейчас" buttons.
 * Wording provided by the lawyer; links to the policy and the data-processing consent.
 */
export function StartConsentNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-ink-400 ${className}`}>
      Нажимая кнопку, вы соглашаетесь с условиями{' '}
      <Link to="/privacy" className="text-brand hover:underline">
        Политики в области обработки персональных данных
      </Link>{' '}
      и даёте{' '}
      <Link to="/consent" className="text-brand hover:underline">
        Согласие на обработку персональных данных
      </Link>
      .
    </p>
  )
}

/**
 * Consent line shown right before the payment (currently the MP3 download) action.
 * Links to the user agreement and the privacy policy.
 */
export function PaymentConsentNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-ink-400 ${className}`}>
      Осуществляя оплату, вы принимаете условия{' '}
      <Link to="/terms" className="text-brand hover:underline">
        Пользовательского соглашения
      </Link>{' '}
      и подтверждаете, что ознакомились с условиями{' '}
      <Link to="/privacy" className="text-brand hover:underline">
        обработки персональных данных
      </Link>
      .
    </p>
  )
}
