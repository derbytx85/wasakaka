import { useCallback, useEffect, useState } from "react";
import { PlaceRepo } from "@/services/database/db";
import type { Place } from "@/types";

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await PlaceRepo.getAll();
    setPlaces(all);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { places, loading, refresh };
}