import Image from 'next/image'
import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="w-full border-b border-border bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/cb-logo-primary.png"
              alt="Career Bridge Foundation"
              width={160}
              height={40}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>
      </div>
    </nav>
  )
}
