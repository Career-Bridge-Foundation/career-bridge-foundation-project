import React from 'react'
import { Button } from './Button'

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center space-y-3">
      {icon && (
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
          style={{
            backgroundColor: 'rgba(0,51,89,0.04)',
            border: '1px solid rgba(0,51,89,0.1)',
          }}
        >
          {icon}
        </div>
      )}
      {!icon && (
        <div
          className="w-1 h-5 rounded-full mb-1"
          style={{ backgroundColor: 'rgba(0,51,89,0.15)' }}
        />
      )}
      <h3 className="text-sm font-medium text-[#003359]/70">{title}</h3>
      {description && <p className="text-sm text-[#003359]/50 leading-relaxed max-w-xs">{description}</p>}
      {action && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
