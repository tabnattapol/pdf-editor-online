import * as React from 'react'
import { cn } from '@/lib/utils'

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-gray-200', className)} />
}

