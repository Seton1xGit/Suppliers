import { normalizeDesign } from "./designs.js";
export function createSavedStore(storageProvider = () => localStorage) {
  const key = "suppliers:v1";
  let available = true,
    state = {
      saved: [],
      notes: {},
      compare: [],
      design: "table",
      tourSeen: false,
    },
    storage;
  try {
    storage = storageProvider();
    storage.setItem(key + ":check", "1");
    storage.removeItem(key + ":check");
    const raw = JSON.parse(storage.getItem(key) || "null");
    if (
      raw &&
      Array.isArray(raw.saved) &&
      raw.notes &&
      typeof raw.notes === "object" &&
      Array.isArray(raw.compare)
    ) {
      state = {
        priceFilters:
          raw.priceFilters && typeof raw.priceFilters === "object"
            ? {
                offerGroup:
                  typeof raw.priceFilters.offerGroup === "string"
                    ? raw.priceFilters.offerGroup
                    : "auto",
                priceSort: ["asc", "desc", "priced"].includes(
                  raw.priceFilters.priceSort,
                )
                  ? raw.priceFilters.priceSort
                  : "asc",
                priceOnly: raw.priceFilters.priceOnly === true,
                offerIds: Array.isArray(raw.priceFilters.offerIds)
                  ? raw.priceFilters.offerIds
                      .filter((x) => typeof x === "string")
                      .slice(0, 32)
                  : [],
              }
            : undefined,
        tourSeen: raw.tourSeen === true,
        design: normalizeDesign(raw.design),
        saved: raw.saved.filter((x) => typeof x === "string"),
        notes: Object.fromEntries(
          Object.entries(raw.notes).filter(([k, v]) => typeof v === "string"),
        ),
        compare: raw.compare.filter((x) => typeof x === "string").slice(0, 4),
      };
    }
  } catch {
    available = false;
  }
  return {
    get available() {
      return available;
    },
    get state() {
      return state;
    },
    save(next) {
      state = next;
      if (available)
        try {
          storage.setItem(key, JSON.stringify(state));
        } catch {
          available = false;
        }
    },
  };
}
