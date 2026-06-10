import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AlertCircle } from 'lucide-react'

export default function NoAccessPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="solid" />
      <main className="flex-1 flex items-center justify-center px-6 py-16 pt-28">
        <div className="w-full max-w-[460px]">
          <div className="bg-white rounded-2xl border border-border-light shadow-lg p-8 md:p-10 text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle size={48} className="text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-navy mb-2">No access to this simulation</h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              You don&rsquo;t have access to this simulation yet. Please contact the
              organisation that gave you access to get set up.
            </p>
            <Link
              href="/simulations"
              className="block w-full rounded-lg bg-navy text-white text-sm font-semibold py-3 hover:opacity-90"
            >
              Back to simulations
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
