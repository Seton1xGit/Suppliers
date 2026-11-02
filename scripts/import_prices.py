import argparse
import hashlib
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"


class Node:
    def __init__(self, tag="root", attrs=None, parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs or []), parent
        self.children = []

    def text(self):
        return " ".join(c.text() if isinstance(c, Node) else c for c in self.children).strip()

    def nodes(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.nodes()

    def find(self, predicate):
        return next((n for n in self.nodes() if predicate(n)), None)

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.current = node

    def handle_endtag(self, tag):
        cursor = self.current
        while cursor.parent:
            if cursor.tag == tag:
                self.current = cursor.parent
                return
            cursor = cursor.parent

    def handle_data(self, value):
        if value.strip() and self.current.tag not in {"script", "style"}:
            self.current.children.append(value.strip())


def key(value):
    return re.sub(r"\s+", " ", value.lower().replace("ё", "е")).strip()


def amount(value):
    value = re.sub(r"[\s\u00a0]", "", str(value)).replace(",", ".")
    if not re.fullmatch(r"\d+(?:\.\d+)?", value):
        raise ValueError("Некорректная сумма")
    return float(value)


def make_offer(supplier, source_id, native_id, name, value, unit, source_url, market, verified_at, **extra):
    product_key = key(name)
    group = "sku-" + hashlib.sha256(product_key.encode()).hexdigest()[:16]
    family, form = "catalog-item", "as-listed"
    if re.search(r"помидор|томат", product_key) and not re.search(r"сок|паст|соус|солен|сушен|вялен|заморож|маринов|кетчуп|семен", product_key):
        family, form = "fresh-tomato", "fresh"
        group = "cherry" if "черри" in product_key else "pink" if re.search(r"розов|пинк", product_key) else "plum" if re.search(r"сливк|сливовид", product_key) else "yellow" if "желт" in product_key else "vine" if "ветк" in product_key else "regular" if "красн" in product_key else "unspecified"
    pack = extra.pop("pack", "Фасовка не опубликована")
    offer = dict(
        id="import-" + source_id + "-" + re.sub(r"[^a-zA-Z0-9-]", "-", str(native_id)).lower(),
        supplierId=supplier["id"], sourceId=source_id, name=name, family=family, form=form, group=group,
        pack=dict(label=pack), price=dict(type=extra.pop("price_type", "exact"), min=value, max=None, currency="RUB", unit=unit, unitConfirmed=unit in {"kg", "piece"}, weightPerUnitKg=None),
        market=market, vat=dict(status="unknown", text="НДС в указанной цене не уточнен"),
        minimum=dict(text=extra.pop("minimum", supplier.get("minimumOrder", {}).get("value", "Минимальная партия не опубликована"))),
        fulfillment=dict(deliveryRegions=[d["region"] for d in supplier["delivery"]], pickupRegions=extra.pop("pickup", []), text="Цена товара без доставки. Маршрут, итоговую цену и наличие подтверди у поставщика.", sourceUrl=source_url),
        availability=extra.pop("availability", "unknown"), sourceUrl=source_url, verifiedAt=verified_at,
        notes=extra.pop("notes", ["Снимок открытого каталога. Это не обещание текущего наличия и не окончательный расчет заказа."]), **extra,
    )
    return offer


def parse_food_star(html, supplier, verified_at):
    url = "https://www.food-star.ru/price/"
    root = Document(html).root
    result, skipped = [], 0
    for row in root.nodes():
        if row.tag != "tr":
            continue
        cells = [n.text() for n in row.children if isinstance(n, Node) and n.tag == "td"]
        if len(cells) != 4:
            continue
        name, country, availability, text = cells
        match = re.fullmatch(r"\s*(от\s+)?([\d\s\u00a0]+(?:[.,]\d+)?)\s*₽\s*/\s*(.+?)\s*", text)
        if not match:
            skipped += 1
            continue
        raw_unit = match[3].strip()
        unit = {"кг": "kg", "шт": "piece", "шт.": "piece", "ящик": "pack", "уп": "pack", "уп.": "pack"}.get(raw_unit, "unknown")
        native = hashlib.sha256((key(name) + ":" + raw_unit).encode()).hexdigest()[:16]
        offer = make_offer(supplier, "food-star-price", native, name, amount(match[2]), unit, url, "b2b", verified_at,
            pack="Единица прайса: " + raw_unit + ". Фасовку уточни у поставщика.",
            price_type="from" if match[1] else "exact", availability="in_stock" if key(availability) == "в наличии" else "unknown",
            origin=country if country != "—" else "Не указано")
        result.append(offer)
    return result, {"rowsWithPrice": len(result), "skipped": skipped, "format": "HTML table"}


ADAPTERS = {"food-star": dict(supplierId="food-star", sourceId="food-star-price", url="https://www.food-star.ru/price/", parse=parse_food_star)}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "SuppliersCatalog/1.0", "Accept": "text/html,application/json"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return response.read(4_000_000).decode("utf-8", "replace")


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=list(ADAPTERS), action="append")
    parser.add_argument("--input", type=Path, help="Проверка парсера на сохраненной странице без обращения к сайту")
    args = parser.parse_args()
    catalog = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
    manual = json.loads((DATA / "offers.json").read_text(encoding="utf-8"))
    imported = json.loads((DATA / "imported-offers.json").read_text(encoding="utf-8")) if (DATA / "imported-offers.json").exists() else []
    metadata = json.loads((DATA / "price-sources.json").read_text(encoding="utf-8")) if (DATA / "price-sources.json").exists() else []
    for name in args.source or ADAPTERS:
        config = ADAPTERS[name]
        supplier = next(s for s in catalog if s["id"] == config["supplierId"])
        started = time.monotonic()
        html = args.input.read_text(encoding="utf-8") if args.input else fetch(config["url"])
        verified_at = datetime.fromtimestamp(args.input.stat().st_mtime, timezone.utc).date().isoformat() if args.input else datetime.now(timezone.utc).date().isoformat()
        offers, report = config["parse"](html, supplier, verified_at)
        if not offers:
            raise ValueError("Источник не вернул подтвержденных цен, предыдущая партия сохранена")
        manual_keys = {(o["supplierId"], key(o["name"])) for o in manual}
        unique = {o["id"]: o for o in offers if (o["supplierId"], key(o["name"])) not in manual_keys}
        imported = [o for o in imported if o.get("sourceId") != config["sourceId"]] + list(unique.values())
        if not any(s["url"] == config["url"] for s in supplier["sources"]):
            supplier["sources"].append(dict(url=config["url"], label="Открытый прайс"))
        record = dict(id=config["sourceId"], supplierId=supplier["id"], url=config["url"], verifiedAt=verified_at,
            imported=len(unique), manualPreserved=len(offers)-len(unique), seconds=round(time.monotonic()-started,2), **report)
        metadata = [m for m in metadata if m["id"] != record["id"]] + [record]
        print(json.dumps(record, ensure_ascii=False))
    for name, value in [("catalog",catalog),("imported-offers",imported),("price-sources",metadata)]:
        target = DATA / (name + ".json")
        temporary = target.with_suffix(".json.tmp")
        payload = json.dumps(value, ensure_ascii=False, indent=2) if name in {"catalog", "price-sources"} else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        temporary.write_text(payload + "\n", encoding="utf-8")
        temporary.replace(target)


if __name__ == "__main__":
    run()
