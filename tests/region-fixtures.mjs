export const nationalIds = [
  "7-verst",
  "a-gross",
  "grandresurs",
  "dikiy-sbor",
  "ingerman",
  "leimu",
  "propak66",
  "sibirskiy-produkt-nsk",
  "superlife",
  "megaopt-nsk",
  "flexaprint",
];
export const regionalIds = {
  Москва: [
    "dinas-msk",
    "komus-opt",
    "milktrading",
    "opticom",
    "potex",
    "ekor",
    "geovita",
  ],
  "Санкт-Петербург": [
    "agropark-spb",
    "arisan-spb",
    "komus-opt",
    "superlife",
    "potex",
    "food-factory-spb",
    "ekor",
    "geovita",
  ],
  Новосибирск: [
    "dikiy-sbor",
    "zernov-nsk",
    "lavka-konditera-nsk",
    "pelmeni-eco-nsk",
    "sibirskiy-produkt-nsk",
  ],
  Екатеринбург: ["packtochka", "tk-dip", "korrex-td", "food-fiction"],
};
export function expectedIds(region) {
  const local = regionalIds[region] || [];
  return [...local, ...nationalIds.filter((id) => !local.includes(id))];
}
