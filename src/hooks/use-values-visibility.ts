import { useSyncExternalStore } from "react";
import { isValuesHidden, subscribeValuesHidden, toggleValuesHidden, setValuesHidden } from "@/lib/format";

export function useValuesVisibility() {
  const hidden = useSyncExternalStore(subscribeValuesHidden, isValuesHidden, () => false);
  return { hidden, toggle: toggleValuesHidden, setHidden: setValuesHidden };
}
