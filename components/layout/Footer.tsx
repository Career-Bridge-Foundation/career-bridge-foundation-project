const NAV_LINKS = [
  {
    id: 1,
    name: "Home",
    url: "https://www.careerbridgefoundation.com/"
  },
  {
    id: 2,
    name: "How It Works",
    url: "https://www.careerbridgefoundation.com/how-it-works"
  },
  {
    id: 3,
    name: "Simulations",
    url: "https://career-bridge-foundation-project.vercel.app/simulations"
  },
  {
    id: 4,
    name: "For Coaches",
    url: "https://career-bridge-foundation-project.vercel.app/for-coaches"
  },
  {
    id: 5,
    name: "Contact",
    url: "https://www.careerbridgefoundation.com/contact"
  },
]
// const POLICY_LINKS = [
//   "Privacy Policy",
//   "Terms of Use",
//   "Safeguarding Policy",
//   "Data Protection",
//   "Complaints Procedure",
//   "Other Policies",
// ];

const POLICY_LINKS = [
  {
    id: 1,
    name: "Privacy Policy",
    url: "https://www.careerbridgefoundation.com/privacy-policy"
  },
  {
    id: 2,
    name: "Terms of Use",
    url: "https://www.careerbridgefoundation.com/terms-of-use"
  },
  {
    id: 3,
    name: "Safeguarding Policy",
    url: "https://www.careerbridgefoundation.com/safeguarding-policy"
  },
  {
    id: 4,
    name: "Data Protection",
    url: "https://www.careerbridgefoundation.com/data-protection"
  },
  {
    id: 5,
    name: "Complaints Procedure",
    url: "https://www.careerbridgefoundation.com/complaints-procedure"
  },
  {
    id: 6,
    name: "Other Policies",
    url: "https://www.careerbridgefoundation.com/policies"
  },
]

export function Footer() {
  return (
    <footer className="bg-navy">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:gap-8">

          {/* Col 1: Brand */}
          <div className="flex flex-col gap-4">
            <img
              src="/logo-white.png"
              alt="Career Bridge Foundation"
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Col 2: Navigation */}
          <div>
            <p className="text-xs font-semibold uppercase text-white/50 tracking-brand-md mb-6">
              Navigation
            </p>
            <div className="flex flex-col gap-3.5">
              {NAV_LINKS.map((link) => (
                <a key={link.id} href={link.url} className="footer-link text-sm text-white/[0.65]">
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          {/* Col 3: Policies */}
          <div>
            <p className="text-xs font-semibold uppercase text-white/50 tracking-brand-md mb-6">
              Policies
            </p>
            <div className="flex flex-col gap-3.5">
              {POLICY_LINKS.map((link) => (
                <a key={link.id} href={link.url} className="footer-link text-sm text-white/[0.65]">
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          {/* Col 4: Contact + Social */}
          <div>
            <p className="text-xs font-semibold uppercase text-white/50 tracking-brand-md mb-6">
              Contact
            </p>

            <p className="text-xs italic text-white/[0.55] mb-1.5">General Enquiries</p>
            <a
              href="mailto:support@careerbridgefoundation.zohodesk.eu"
              className="footer-link text-xs text-teal whitespace-nowrap"
            >
              support@careerbridgefoundation.zohodesk.eu
            </a>

            <p className="text-xs italic text-white/[0.55] mt-5 mb-1.5">Partnership Enquiries</p>
            <a
              href="mailto:outreach@careerbridgefoundation.com"
              className="footer-link text-xs text-teal"
            >
              outreach@careerbridgefoundation.com
            </a>

            <p className="text-xs text-white/50 mt-7 mb-4">Follow Us</p>
            <div className="flex gap-3">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/careerbridgefoundation"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                className="footer-link social-icon-btn w-9 h-9 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/careerbridgefoundation"
                target="_blank"
                rel="noopener noreferrer"
                title="LinkedIn"
                className="footer-link social-icon-btn w-9 h-9 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              {/* Facebook */}
              <a
                href="https://www.facebook.com/careerbridgefoundation"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook"
                className="footer-link social-icon-btn w-9 h-9 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-6 md:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/10">
        <p className="text-xs text-white/40">
          &copy; 2026 Career Bridge Foundation CIC. All rights reserved.
        </p>
        <p className="text-xs text-white/40">Registered Company Number: 16939467</p>
      </div>
    </footer>
  );
}
