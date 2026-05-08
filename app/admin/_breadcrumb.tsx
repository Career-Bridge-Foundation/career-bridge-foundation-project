'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: '#d5dce8', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.replace('/admin', '').split('/').filter(Boolean)

  return (
    <div className="flex items-center gap-2 text-sm flex-wrap">
      <Link
        href="/admin"
        className="font-semibold transition-colors"
        style={{ color: segments.length === 0 ? '#003359' : 'rgba(0,51,89,0.4)' }}
        onMouseEnter={e => {
          if (segments.length > 0) (e.currentTarget as HTMLElement).style.color = '#003359'
        }}
        onMouseLeave={e => {
          if (segments.length > 0) (e.currentTarget as HTMLElement).style.color = 'rgba(0,51,89,0.4)'
        }}
      >
        Admin
      </Link>
      {segments.map((seg, i) => {
        const href = '/admin/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = seg.charAt(0).toUpperCase() + seg.slice(1)
        return (
          <React.Fragment key={href}>
            <ChevronRight />
            {isLast ? (
              <span style={{ color: '#003359' }} className="font-medium max-w-[160px] truncate">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="transition-colors max-w-[120px] truncate"
                style={{ color: 'rgba(0,51,89,0.4)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#003359')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(0,51,89,0.4)')}
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
