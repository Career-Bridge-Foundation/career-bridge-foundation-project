'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type Props = {
  simulationId: string
}

export default function CandidateGate({ simulationId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)

    // Store candidate details for use across prompt screens.
    // Replaced by Supabase attempt ID in Step 4.
    sessionStorage.setItem(
      'cb_candidate',
      JSON.stringify({ name: name.trim(), email: email.trim() })
    )

    router.push(`/simulate/${simulationId}/prompt/1`)
  }

  return (
    <>
      <Button
        size="lg"
        className="bg-brand-primary hover:bg-brand-primary/90 text-white px-8"
        onClick={() => setOpen(true)}
      >
        Start Simulation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Before you begin</DialogTitle>
            <DialogDescription>
              Enter your details. These appear on your results page and credential.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="candidate-name">Full name</Label>
              <Input
                id="candidate-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candidate-email">Email address</Label>
              <Input
                id="candidate-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-brand-danger">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Starting…' : 'Begin Simulation'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
