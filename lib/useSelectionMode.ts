import { useState } from 'react';

export interface SelectionModeHook {
  selectionMode: boolean;
  selectedIds: Set<string>;
  enter: () => void;
  exit: () => void;
  toggle: (id: string) => void;
  canStack: boolean;
}

export function useSelectionMode(): SelectionModeHook {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function enter() {
    setSelectionMode(true);
  }

  function exit() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return {
    selectionMode,
    selectedIds,
    enter,
    exit,
    toggle,
    canStack: selectedIds.size >= 2,
  };
}
