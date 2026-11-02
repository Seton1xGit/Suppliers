import { normalizeDesign } from "/designs.js";
const url = new URL("/", location.origin),
  params = new URLSearchParams(location.search);
for (const key of ["q", "category", "region", "view"])
  if (params.has(key)) url.searchParams.set(key, params.get(key));
if (!params.has("region")) url.searchParams.set("region", "Новосибирск");
url.searchParams.set("design", normalizeDesign(document.body.dataset.variant));
location.replace(url);
