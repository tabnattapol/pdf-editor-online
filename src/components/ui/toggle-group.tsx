import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

export const ToggleGroup = ToggleGroupPrimitive.Root

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm data-[state=on]:bg-black data-[state=on]:text-white hover:bg-gray-100',
      className,
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = 'ToggleGroupItem'

