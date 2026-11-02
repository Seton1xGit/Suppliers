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


def parse_sibprod(html, supplier, verified_at):
    result, skipped = {}, 0
    for card in Document(html).root.nodes():
        if not card.has_class("catalog-grid__item"):
            continue
        title = card.find(lambda n: n.has_class("catalog-grid__item-name"))
        prices = card.find(lambda n: n.has_class("catalog-grid__item-price"))
        if not title or not prices:
            continue
        active = prices.find(lambda n: n.has_class("offers-item") and n.has_class("is-active"))
        retail = (active or prices).find(lambda n: n.has_class("price-retail"))
        value = retail.find(lambda n: n.has_class("val")) if retail else None
        label = retail.find(lambda n: n.has_class("label")) if retail else None
        if not value or not label:
            skipped += 1
            continue
        try:
            price = amount(value.text())
        except ValueError:
            skipped += 1
            continue
        unit_text = key(label.text())
        unit = "piece" if re.fullmatch(r"1\s*шт\.?", unit_text) else "kg" if re.fullmatch(r"1\s*кг", unit_text) else "unknown"
        name = title.text()
        native = title.attrs.get("data-product") or hashlib.sha256(key(name).encode()).hexdigest()[:16]
        offer = make_offer(supplier, "sibprod-public", native, name, price, unit, "https://sibprod.info/", "retail", verified_at,
            pack="Единица цены: " + label.text() + ". Фасовка указана в названии товара.",
            notes=["Публичная розничная цена. Использована активная позиция, старая зачеркнутая цена не загружена.", "Варианты упаковки и минимальную партию уточни у продавца."])
        offer["fulfillment"]["deliveryRegions"] = ["Новосибирск"]
        offer["fulfillment"]["text"] = "Розничный каталог Новосибирска. Стоимость доставки отдельно. Для других регионов запроси цену и условия."
        masses = re.findall(r"(\d+(?:[.,]\d+)?)\s*(кг|г)\b", name)
        if unit == "piece" and len(masses) == 1:
            weight = amount(masses[0][0]) / (1000 if masses[0][1] == "г" else 1)
            if weight > 0:
                offer["price"].update(weightPerUnitKg=weight, weightEvidence="Наименование товара: " + name + "; цена за 1 шт.")
        result[offer["id"]] = offer
    return list(result.values()), {"rowsWithPrice":len(result),"skipped":skipped,"format":"HTML product cards, active retail price"}


def parse_packtochka(html, supplier, verified_at):
    result, skipped = {}, 0
    for card in Document(html).root.nodes():
        if not card.attrs.get("itemtype", "").endswith("/Product"):
            continue
        name_node = card.find(lambda n:n.attrs.get("itemprop")=="name")
        value = card.find(lambda n:n.attrs.get("itemprop")=="price")
        currency = card.find(lambda n:n.attrs.get("itemprop")=="priceCurrency")
        native = card.find(lambda n:n.attrs.get("itemprop")=="sku")
        if not name_node or not value or not currency or currency.attrs.get("content")!="RUB":
            skipped += 1
            continue
        name = name_node.attrs.get("content") or name_node.text()
        try:
            price=amount(value.attrs.get("content", ""))
        except ValueError:
            skipped+=1
            continue
        code = (native.attrs.get("content") if native else None) or hashlib.sha256(key(name).encode()).hexdigest()[:16]
        unit = "piece" if name == "Коробка картонная 150х120х100 мм" else "unknown"
        offer=make_offer(supplier,"packtochka-public",code,name,price,unit,"https://packtochka.ru/","unknown",verified_at,
            pack="Размер и комплектация указаны в названии. Единицу и оптовую ступень уточни у поставщика.",
            notes=["Открытая цена витрины. Оптовые скидки не применены автоматически."])
        if unit=="piece":offer["notes"].append("В товарной карточке этой коробки прямо указана поштучная продажа.")
        result[offer["id"]]=offer
    return list(result.values()), {"rowsWithPrice":len(result),"skipped":skipped,"format":"HTML Schema.org Product/Offer"}


def fetch_cake_me(url):
    products, total = {}, None
    for page in range(1, 26):
        endpoint = f"https://store.tildaapi.com/api/getproductslist/?storepartuid=233807705292&recid=2127305591&getallparts=true&getoptions=true&slice={page}&size=6"
        data = json.loads(fetch(endpoint))
        total = data.get("total", 0)
        new = data.get("products", [])
        before = len(products)
        for product in new:
            products[str(product["uid"])] = product
        if len(products) >= total or not new or len(products)==before:
            break
        time.sleep(0.4)
    return json.dumps(dict(products=list(products.values()), total=total), ensure_ascii=False)


def parse_cake_me(payload, supplier, verified_at):
    data=json.loads(payload)
    result,skipped=[],0
    for product in data.get("products", []):
        editions=product.get("editions", [])
        if len(editions)>1 or not product.get("price") or not product.get("url"):
            skipped+=1
            continue
        try:price=amount(product["price"])
        except ValueError:
            skipped+=1
            continue
        if price<=0:
            skipped+=1
            continue
        portion=product.get("portion")
        code=product.get("unit")
        unit="pack" if code in {"GRM","KGM"} and portion else "piece" if code=="NMP" else "unknown"
        pack=f"Порция {portion} {'г' if code=='GRM' else 'кг'}" if unit=="pack" else "Фасовку уточни у поставщика"
        offer=make_offer(supplier,"cake-me-store",product["uid"],product["title"],price,unit,product["url"],"unknown",verified_at,pack=pack,
            notes=["Публичная цена витрины Cake Me. Тип оптового или розничного тарифа отдельно не указан.","Доставка по Новосибирску и минимальный заказ от 4000 руб. согласуются с поставщиком."])
        if unit=="pack":
            offer["price"].update(weightPerUnitKg=float(portion)/(1000 if code=="GRM" else 1),weightEvidence=f"Публичный каталог показывает {price} руб. за порцию {portion} {code}.")
        result.append(offer)
    return result,{"rowsWithPrice":len(result),"skipped":skipped,"totalInSource":data.get("total"),"format":"Public storefront JSON, paginated"}


ADAPTERS = {
    "food-star": dict(supplierId="food-star", sourceId="food-star-price", url="https://www.food-star.ru/price/", parse=parse_food_star),
    "sibprod": dict(supplierId="sibirskiy-produkt-nsk",sourceId="sibprod-public",url="https://sibprod.info/",parse=parse_sibprod),
    "packtochka": dict(supplierId="packtochka",sourceId="packtochka-public",url="https://packtochka.ru/",parse=parse_packtochka),
    "cake-me":dict(supplierId="cake-me",sourceId="cake-me-store",url="https://cake-me.ru/",fetch=fetch_cake_me,parse=parse_cake_me),
}


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
    manual = json.loads((DATA / "manual-offers.json").read_text(encoding="utf-8"))
    imported = json.loads((DATA / "imported-offers.json").read_text(encoding="utf-8")) if (DATA / "imported-offers.json").exists() else []
    metadata = json.loads((DATA / "price-sources.json").read_text(encoding="utf-8")) if (DATA / "price-sources.json").exists() else []
    for name in args.source or ADAPTERS:
        config = ADAPTERS[name]
        supplier = next(s for s in catalog if s["id"] == config["supplierId"])
        started = time.monotonic()
        html = args.input.read_text(encoding="utf-8") if args.input else config.get("fetch",fetch)(config["url"])
        verified_at = datetime.fromtimestamp(args.input.stat().st_mtime, timezone.utc).date().isoformat() if args.input else datetime.now(timezone.utc).date().isoformat()
        offers, report = config["parse"](html, supplier, verified_at)
        if not offers:
            raise ValueError("Источник не вернул подтвержденных цен, предыдущая партия сохранена")
        manual_keys = {(o["supplierId"], key(o["name"])) for o in manual}
        unique = {o["id"]: o for o in offers if (o["supplierId"], key(o["name"])) not in manual_keys}
        imported = [o for o in imported if o.get("sourceId") != config["sourceId"]] + list(unique.values())
        if not any(s["url"] == config["url"] for s in supplier["sources"]):
            supplier["sources"].append(dict(url=config["url"], label="Открытый прайс"))
        known_sources={s["url"] for s in supplier["sources"]}
        for offer in unique.values():
            if offer["sourceUrl"] not in known_sources:
                supplier["sources"].append(dict(url=offer["sourceUrl"],label="Товар и цена в каталоге"))
                known_sources.add(offer["sourceUrl"])
        record = dict(id=config["sourceId"], supplierId=supplier["id"], url=config["url"], verifiedAt=verified_at,
            category=supplier["category"], imported=len(unique), manualPreserved=len(offers)-len(unique), seconds=round(time.monotonic()-started,2), **report)
        metadata = [m for m in metadata if m["id"] != record["id"]] + [record]
        print(json.dumps(record, ensure_ascii=False))
    for name, value in [("catalog",catalog),("imported-offers",imported),("price-sources",metadata),("offers",manual+imported)]:
        target = DATA / (name + ".json")
        temporary = target.with_suffix(".json.tmp")
        payload = json.dumps(value, ensure_ascii=False, indent=2) if name in {"catalog", "price-sources"} else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        temporary.write_text(payload + "\n", encoding="utf-8")
        temporary.replace(target)


if __name__ == "__main__":
    run()
