import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export function SecureAccountBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-teal/30 bg-teal/5 p-4 flex items-start gap-3 ${className}`}
    >
      <ShieldCheck size={18} className="text-teal shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-navy">Secure your account</p>
        <p className="text-slate-600 mt-0.5">
          You&rsquo;re signed in from your invite link. Set a password or connect Google
          in{' '}
          <Link href="/account/settings" className="text-teal hover:underline">
            Account Settings
          </Link>{' '}
          so you can sign back in later.
        </p>
      </div>
    </div>
  )
}
