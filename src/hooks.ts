import { useCallback } from 'react';
import { useStore } from './store';
import { collectSelections, generateGroceryList } from './lib/grocery';
import type { ListSource } from './types';

/** Generate (or regenerate) the shopping list from current selections. */
export function useGenerateList() {
  const { data, update, toast } = useStore();
  return useCallback((sourceOverride?: ListSource) => {
    const source = sourceOverride ?? data.settings.listSource;
    const selections = collectSelections(data.quick, data.week, source);
    if (selections.length === 0) {
      toast(source === 'quick' ? 'Add meals to your quick selection first.' : source === 'week' ? 'Plan some meals for the week first.' : 'Choose some meals first.');
      return null;
    }
    const result = generateGroceryList({
      selections, recipes: data.recipes, foods: data.foods, pantry: data.pantry, existing: data.grocery,
      subtractPantry: data.settings.subtractPantry, keepManual: data.settings.keepManualItems,
    });
    update((d) => ({ ...d, grocery: result.items, lastGeneratedAt: new Date().toISOString(), settings: { ...d.settings, listSource: source } }));
    const n = result.items.filter((i) => i.source === 'generated').length;
    toast(`Shopping list generated: ${n} item${n === 1 ? '' : 's'} from ${selections.length} meal${selections.length === 1 ? '' : 's'}.`);
    return result;
  }, [data, update, toast]);
}
