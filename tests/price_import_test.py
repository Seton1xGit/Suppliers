import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from import_prices import amount, parse_food_star, parse_sibprod, parse_packtochka, parse_cake_me, parse_packtochka_catalog, parse_leopak


class PriceImportTest(unittest.TestCase):
    def setUp(self):
        self.supplier = dict(id="sample", delivery=[dict(region="Новосибирск")])

    def test_decimal_and_invalid_amount(self):
        self.assertEqual(amount("1\u00a0218,50"), 1218.5)
        for value in ["NaN", "", "-1", "цена по запросу"]:
            with self.assertRaises(ValueError):
                amount(value)

    def test_price_table_and_stable_id(self):
        html = "<table><tr><td>Бананы</td><td>Эквадор</td><td>В наличии</td><td>190 ₽ / кг</td></tr></table>"
        first, _ = parse_food_star(html, self.supplier, "2026-11-02")
        second, _ = parse_food_star(html.replace("190", "200"), self.supplier, "2026-11-02")
        self.assertEqual(first[0]["id"], second[0]["id"])
        self.assertEqual(first[0]["price"]["min"], 190)
        self.assertEqual(first[0]["price"]["unit"], "kg")

    def test_active_price_not_crossed_out_or_inactive(self):
        html = '<div class="catalog-grid__item"><div class="catalog-grid__item-name" data-product="1">Масло 150 г</div><div class="catalog-grid__item-price"><div class="offers-item is-active"><div class="price-old">133</div><div class="price-retail"><span class="val">120</span><span class="label">1 шт</span></div></div><div class="offers-item"><div class="price-retail"><span class="val">133</span><span class="label">1 шт</span></div></div></div></div>'
        offers, _ = parse_sibprod(html, self.supplier, "2026-11-02")
        self.assertEqual(offers[0]["price"]["min"], 120)
        self.assertEqual(offers[0]["price"]["weightPerUnitKg"], 0.15)
        self.assertEqual(offers[0]["market"], "retail")

    def test_empty_sku_does_not_merge_packaging_products(self):
        def card(name, price):
            return f'<div itemtype="https://schema.org/Product"><meta itemprop="name" content="{name}"><meta itemprop="sku" content=""><meta itemprop="price" content="{price}"><meta itemprop="priceCurrency" content="RUB"></div>'
        offers, _ = parse_packtochka(card("Коробка 1", 16)+card("Коробка 2", 22), self.supplier, "2026-11-02")
        self.assertEqual(len(offers), 2)
        self.assertEqual(len({o["id"] for o in offers}), 2)
        self.assertTrue(all(o["price"]["unit"]=="unknown" for o in offers))

    def test_initial_tier_does_not_use_volume_discount(self):
        html = '<form data-product-id="10"><div class="product-preview__title">Коробка</div></form><div data-catalog-tier-product data-product-id="10"><span data-catalog-tier-price data-min="1" data-value="16"></span><span data-catalog-tier-price data-min="1000" data-value="9"></span></div>'
        offers, _ = parse_packtochka_catalog(json.dumps([html]), self.supplier, "2026-11-02")
        self.assertEqual(offers[0]["price"]["min"], 16)
        self.assertEqual(offers[0]["price"]["unit"], "unknown")
        self.assertIn("1000", offers[0]["notes"][1])
        missing, _ = parse_packtochka_catalog(json.dumps([html.replace('data-min="1"', 'data-min="5"')]), self.supplier, "2026-11-02")
        self.assertEqual(missing, [])

    def test_leopak_current_pack_price_is_not_old_or_per_piece(self):
        html = '<div class="products-view-item"><a class="products-view-name-link" href="https://market.leopak.ru/products/test">Пакеты 100 шт.</a><div class="price-old"><div class="price-number">784</div></div><div class="price-new"><div class="price-number">639</div><div class="price-currency">руб./уп.</div></div></div>'
        offers, _ = parse_leopak(html, self.supplier, "2026-11-02")
        self.assertEqual(offers[0]["price"]["min"], 639)
        self.assertEqual(offers[0]["price"]["unit"], "pack")
        self.assertIsNone(offers[0]["price"]["weightPerUnitKg"])
        self.assertEqual(offers[0]["fulfillment"]["deliveryRegions"], [])


    def test_portion_weight_and_missing_price(self):
        payload=json.dumps(dict(total=2,products=[dict(uid=1,title="Десерт",price="240",url="https://cake-me.ru/tproduct/1",portion=110,unit="GRM",editions=[]),dict(uid=2,title="Без цены",price="",url="https://cake-me.ru/tproduct/2")]))
        offers, report=parse_cake_me(payload,self.supplier,"2026-11-02")
        self.assertEqual(len(offers),1)
        self.assertEqual(offers[0]["price"]["weightPerUnitKg"],0.11)
        self.assertEqual(report["skipped"],1)


if __name__ == "__main__":
    unittest.main()
