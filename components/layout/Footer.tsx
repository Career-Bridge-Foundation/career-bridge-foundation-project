'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa'

const NAV_LINKS = [
  { label: 'Home',        href: '/'           },
  { label: 'How It Works',href: '/how-it-works'},
  { label: 'Partners',    href: '/partners'    },
  { label: 'Governance',  href: '/governance'  },
  { label: 'Apply',       href: '/apply'       },
  { label: 'Contact',     href: '/contact'     },
]

const POLICY_LINKS = [
  { label: 'Privacy Policy',       href: '/privacy-policy'       },
  { label: 'Terms of Use',         href: '/terms-of-use'         },
  { label: 'Safeguarding Policy',  href: '/safeguarding-policy'  },
  { label: 'Data Protection',      href: '/data-protection'      },
  { label: 'Complaints Procedure', href: '/complaints-procedure' },
  { label: 'Other Policies',       href: '/policies'             },
]

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href:  'https://www.instagram.com/careerbridgefoundation/',
    icon:  <FaInstagram size={18} />,
  },
  {
    label: 'LinkedIn',
    href:  'https://www.linkedin.com/company/careerbridgefoundation/?viewAsMember=true',
    icon:  <FaLinkedinIn size={18} />,
  },
  {
    label: 'Facebook',
    href:  'https://www.facebook.com/careerbridgefoundation',
    icon:  <FaFacebookF size={18} />,
  },
]

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--ink-light)' }}>

      {/* ── Main grid ──────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">

          {/* Col 1 — Brand */}
          <div className="md:col-span-1">
            <div className="mb-6">
              <Image
                src="/images/cb-logo-white.png"
                alt="Career Bridge Foundation Logo"
                width={140}
                height={40}
                className="h-10 w-auto object-contain"
              />
            </div>
            <p
              className="font-bold uppercase mb-4"
              style={{
                fontSize: '11px',
                letterSpacing: '0.15em',
                color: 'rgba(148,163,184,0.6)',
              }}
            >
              Community Interest Company
            </p>
            <div
              className="space-y-1"
              style={{ fontSize: '14px', color: 'rgba(148,163,184,0.5)' }}
            >
              <p>Registered in England and Wales</p>
              <p>Company Number: 16939467</p>
            </div>
          </div>

          {/* Col 2 — Navigation */}
          <div>
            <p
              className="font-bold uppercase mb-6"
              style={{
                fontSize: '11px',
                letterSpacing: '0.15em',
                color: 'rgba(148,163,184,0.6)',
              }}
            >
              Navigation
            </p>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors duration-300"
                    style={{ color: 'var(--cool)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = 'var(--warm-white)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'var(--cool)')
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Policies */}
          <div>
            <p
              className="font-bold uppercase mb-6"
              style={{
                fontSize: '11px',
                letterSpacing: '0.15em',
                color: 'rgba(148,163,184,0.6)',
              }}
            >
              Policies
            </p>
            <ul className="space-y-3">
              {POLICY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors duration-300"
                    style={{ color: 'var(--cool)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = 'var(--warm-white)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'var(--cool)')
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <p
              className="font-bold uppercase mb-6"
              style={{
                fontSize: '11px',
                letterSpacing: '0.15em',
                color: 'rgba(148,163,184,0.6)',
              }}
            >
              Contact
            </p>
            <div className="space-y-4">

              {/* General enquiries */}
              <div>
                <p
                  className="mb-1"
                  style={{ fontSize: '12px', color: 'rgba(148,163,184,0.5)' }}
                >
                  General Enquiries
                </p>
                <a
                  href="mailto:support@careerbridgefoundation.zohodesk.eu"
                  className="text-sm transition-colors duration-300 break-all"
                  style={{ color: 'var(--warm-white)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = 'var(--cb-accent-teal)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'var(--warm-white)')
                  }
                >
                  support@careerbridgefoundation.zohodesk.eu
                </a>
              </div>

              {/* Partnership enquiries */}
              <div>
                <p
                  className="mb-1"
                  style={{ fontSize: '12px', color: 'rgba(148,163,184,0.5)' }}
                >
                  Partnership Enquiries
                </p>
                <a
                  href="mailto:outreach@careerbridgefoundation.com"
                  className="text-sm transition-colors duration-300"
                  style={{ color: 'var(--warm-white)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = 'var(--cb-accent-teal)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'var(--warm-white)')
                  }
                >
                  outreach@careerbridgefoundation.com
                </a>
              </div>

              {/* Social links */}
              <div>
                <p
                  className="mb-3"
                  style={{ fontSize: '14px', color: 'rgba(148,163,184,0.5)' }}
                >
                  Follow Us
                </p>
                <div className="flex gap-4">
                  {SOCIAL_LINKS.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="transition-colors duration-300"
                      style={{ color: 'var(--cool)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = 'var(--warm-white)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = 'var(--cool)')
                      }
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ──────────────────────────────────── */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-8"
          style={{ borderTop: '1px solid rgba(250,250,249,0.05)' }}
        >
          <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.5)' }}>
            © {new Date().getFullYear()} Career Bridge Foundation CIC. All rights reserved.
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.5)' }}>
            Registered Company Number: 16939467
          </p>
        </div>
      </div>
    </footer>
  )
}
