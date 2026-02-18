import { useState, useEffect } from 'react';
import { getSettings } from '../services/api';

// Cache loaded sizes so we don't re-fetch every time a form mounts
const cache = {};

export function useSectionSizes(key, defaults) {
  const [sizes, setSizes] = useState(cache[key] || defaults);

  useEffect(() => {
    if (cache[key]) { setSizes(cache[key]); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await getSettings(`section_sizes_${key}`);
        if (!cancelled && resp.data.data?.value) {
          cache[key] = resp.data.data.value;
          setSizes(resp.data.data.value);
        }
      } catch {
        // Use defaults — already set
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  return sizes;
}

// Clear cache (call after admin saves)
export function clearSectionSizeCache(key) {
  if (key) delete cache[key];
  else Object.keys(cache).forEach(k => delete cache[k]);
}
