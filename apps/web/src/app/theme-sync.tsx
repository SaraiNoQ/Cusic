'use client';

import { useEffect } from 'react';
import { useUiStore } from '../store/ui-store';

export function ThemeInitializer() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}
