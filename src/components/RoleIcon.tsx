import {
  Sun,
  Heart,
  UsersRound,
  Award,
  Coins,
  House,
  Handshake,
  Landmark,
  Globe,
  type LucideIcon,
} from 'lucide-react'

/** One consistent line icon per life role — replaces the emoji glyphs. */
const ROLE_ICONS: Record<string, LucideIcon> = {
  self: Sun,
  partner: Heart,
  family: UsersRound,
  professional: Award,
  financier: Coins,
  homekeeper: House,
  friend: Handshake,
  citizen: Landmark,
  planet: Globe,
}

export function RoleIcon({
  id,
  className = 'h-5 w-5',
  strokeWidth = 1.5,
}: {
  id: string
  className?: string
  strokeWidth?: number
}) {
  const Icon = ROLE_ICONS[id] ?? Sun
  return <Icon className={className} strokeWidth={strokeWidth} />
}

/**
 * Soft circular tile wrapping a role icon — warm terracotta accent on a
 * gentle gradient. `size` controls the tile; the icon scales with it.
 */
export function RoleIconTile({
  id,
  size = 'md',
}: {
  id: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const tile =
    size === 'lg'
      ? 'h-12 w-12 rounded-2xl'
      : size === 'sm'
      ? 'h-9 w-9 rounded-xl'
      : 'h-11 w-11 rounded-full'
  const icon = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
  return (
    <span
      className={`grid ${tile} shrink-0 place-items-center bg-gradient-to-br from-blob-clay/70 to-white ring-1 ring-brand/10`}
    >
      <RoleIcon id={id} className={`${icon} text-brand`} />
    </span>
  )
}
