import { colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Role kolorów dla bieżącego trybu (jasny / ciemny). */
export function useColors() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return colors[scheme];
}
