/**
 * tailwind / className 合併小工具
 *
 * 例：cn('btn', isActive && 'active', isDisabled && 'opacity-50')
 */
export function cn(...classes: Array<string | boolean | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
