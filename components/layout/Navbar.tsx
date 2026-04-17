import Image from 'next/image'
import Link from 'next/link'
import { FaArrowLeft } from 'react-icons/fa'

type NavbarProps = {
  showBack?: boolean
  backHref?: string
  backLabel?: string
}

export default function Navbar({ showBack = false, backHref = '/', backLabel = 'Back' }: NavbarProps) {
  return (
    <nav className="w-full border-b border-[rgba(250,250,249,0.05)] bg-ink fixed top-0 left-0 z-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Link href={backHref} className="cb-btn cb-btn-primary text-xs py-2 px-5">
                <span className="mr-2 inline-flex items-center">
                  <FaArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {backLabel}
              </Link>
            )}

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/cb-logo-white.png"
                alt="Career Bridge Foundation"
                width={160}
                height={40}
                priority
                className="h-9 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Apply CTA */}
          <Link
            href="#simulations"
            className="cb-btn cb-btn-primary text-xs py-2 px-5"
          >
            Apply Now
          </Link>
        </div>
      </div>
    </nav>
  )
}
