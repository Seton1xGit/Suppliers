const normalize = (value) =>
  String(value).toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
const regionKey = (value) =>
  normalize(value)
    .replace(/^г\.\s*/, "")
    .replace(/\s+/g, " ");
// Покрытие области включает город, обратное утверждение недопустимо.
const cityRegions = {
  новосибирск: "новосибирская область",
  екатеринбург: "свердловская область",
  краснодар: "краснодарский край",
  воронеж: "воронежская область",
  самара: "самарская область",
  волгоград: "волгоградская область",
  астрахань: "астраханская область",
  "нижний новгород": "нижегородская область",
  уфа: "республика башкортостан",
  казань: "республика татарстан",
};
export function deliveryMatch(supplier, region = "") {
  const key = regionKey(region);
  if (!key) return { scope: "all", entries: supplier.delivery };
  const regional = supplier.delivery.filter((d) => {
    const entry = regionKey(d.region);
    return entry !== "россия" && (entry === key || entry === cityRegions[key]);
  });
  if (regional.length) return { scope: "regional", entries: regional };
  const national = supplier.delivery.filter(
    (d) => regionKey(d.region) === "россия",
  );
  return { scope: national.length ? "national" : "none", entries: national };
}
