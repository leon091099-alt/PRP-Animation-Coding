// Lokaler Ersatz für @revyme/runtime (nur Prototyp). ?static=1 simuliert den Editor-Canvas.
import type { ComponentType } from 'react';

export function withResponsiveProps<T>(C: ComponentType<T>): ComponentType<T> {
  return C;
}
export function useStaticCanvas(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('static');
}
