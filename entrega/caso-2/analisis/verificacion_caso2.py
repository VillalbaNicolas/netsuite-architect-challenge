"""Caso 2 - verificaciones independientes de la clasificacion (clasificacion_caso2.py).

Uso:  python verificacion_caso2.py <ruta a caso-2-marketplace-backorder/data>
Solo libreria estandar.
"""
import csv
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def load(d, n):
    with open(Path(d) / n, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def day(s):
    return datetime.strptime(s[:10], "%Y-%m-%d")


def main(d):
    mo = {r["mp_order_id"]: r for r in load(d, "marketplace_orders.csv")}
    so = load(d, "sales_orders.csv")
    sl = {r["so_id"]: r for r in load(d, "so_lines.csv")}
    items = {r["item_id"]: r for r in load(d, "items.csv")}
    im = load(d, "item_mapping.csv")
    tos = load(d, "transfer_orders.csv")
    inv = {(r["item_id"], r["location"]): r for r in load(d, "inventory_snapshot.csv")}
    log = load(d, "ipaas_log.csv")

    sku2item = {r["sku_marketplace"]: r["item_id"] for r in im}
    item_skus = defaultdict(list)
    for r in im:
        item_skus[r["item_id"]].append(r["sku_marketplace"])

    print("== Universo")
    print("ordenes MP:", len(mo), dict(Counter(m["status"] for m in mo.values())))
    print("fulfillment_type:", dict(Counter(m["fulfillment_type"] for m in mo.values())))
    print("SO:", len(so), dict(Counter(s["status"] for s in so)))

    # 1. Location vs fulfillment_type
    want = {"marketplace": "AR-MKP-FC", "own": "AR-CD-CENTRAL"}
    bad_loc = [s for s in so if want.get(mo[s["mp_order_id"]]["fulfillment_type"]) not in (s["location"], sl[s["so_id"]]["location"])
               or s["location"] != sl[s["so_id"]]["location"]]
    print("\n== 1. SO con location distinta al fulfillment_type:", len(bad_loc))

    # 2. SKUs sin mapeo, items inactivos
    unmapped = {m["sku_marketplace"] for m in mo.values() if m["sku_marketplace"] not in sku2item}
    inactive_mapped = {i for i in sku2item.values() if items.get(i, {}).get("is_inactive") == "T"}
    print("\n== 2. SKUs vendidos sin mapeo:", len(unmapped), "| items mapeados inactivos:", len(inactive_mapped),
          "| items mapeados inexistentes:", len({i for i in sku2item.values() if i not in items}))
    multi = {i: s for i, s in item_skus.items() if len(s) > 1}
    print("   items con mas de un SKU:", len(multi))
    so_by_mp = defaultdict(list)
    for s in so:
        so_by_mp[s["mp_order_id"]].append(s)
    for i, skus in sorted(multi.items()):
        orders = [m for m in mo.values() if m["sku_marketplace"] in skus and m["status"] == "delivered"]
        bo = sum(1 for m in orders for s in so_by_mp.get(m["mp_order_id"], [])[:1] if int(sl[s["so_id"]]["qty_backordered"]) > 0)
        stock = {loc: inv.get((i, loc), {}).get("on_hand") for loc in ("AR-MKP-FC", "AR-CD-CENTRAL")}
        n_to = sum(1 for t in tos if t["item_id"] == i)
        print(f"   {i} skus={skus} entregadas={len(orders)} en_BO={bo} on_hand={stock} TOs={n_to}")

    # 3. Transferencias: demora de recepcion y parciales
    print("\n== 3. Transfer orders CENTRAL -> MKP-FC")
    lag = Counter()
    late = []
    for t in tos:
        if t["received_date"]:
            dd = (day(t["received_date"]) - day(t["created_date"])).days
            lag[dd] += 1
            if dd > 5:
                late.append((t["to_id"], t["item_id"], t["created_date"], t["received_date"], dd))
    print("   status:", dict(Counter(t["status"] for t in tos)))
    print("   dias hasta recepcion:", dict(sorted(lag.items())))
    print("   recibidas con demora > 5 dias:", len(late), "items:", len({x[1] for x in late}))
    partial = [t for t in tos if int(t["qty_received"]) < int(t["qty_shipped"])]
    print("   parciales/pendientes:", len(partial), "unidades en transito:",
          sum(int(t["qty_shipped"]) - int(t["qty_received"]) for t in partial),
          "| in_transit snapshot MKP-FC:", sum(int(r["in_transit"]) for (i, l), r in inv.items() if l == "AR-MKP-FC"))

    # 3b. Backorder con stock disponible: SO creadas antes de la recepcion tardia?
    late_items = {x[1]: x[3] for x in late}
    bo_avail = []
    for s in so:
        l = sl[s["so_id"]]
        if mo[s["mp_order_id"]]["status"] != "delivered" or int(l["qty_backordered"]) == 0:
            continue
        if so_by_mp[s["mp_order_id"]][0]["so_id"] != s["so_id"]:
            continue  # duplicadas aparte
        iv = inv[(l["item_id"], s["location"])]
        if int(iv["available"]) > 0:
            bo_avail.append((s, l["item_id"]))
    before = sum(1 for s, i in bo_avail if i in late_items and s["created_at"][:10] < late_items[i])
    print(f"   BO (entregadas, SO original) en items con disponible>0: {len(bo_avail)}; "
          f"de esas, SO creada antes de una recepcion tardia del item: {before}")

    # 4. Duplicadas
    print("\n== 4. SO duplicadas por mp_order_id")
    dup_groups = {k: sorted(v, key=lambda s: (s["created_at"], s["so_id"])) for k, v in so_by_mp.items() if len(v) > 1}
    extras = [s for v in dup_groups.values() for s in v[1:]]
    print("   ordenes con duplicados:", len(dup_groups), "| SO extra:", len(extras),
          "| status extras:", dict(Counter(s["status"] for s in extras)))
    print("   extras con backorder:", sum(1 for s in extras if int(sl[s["so_id"]]["qty_backordered"]) > 0),
          "unidades BO:", sum(int(sl[s["so_id"]]["qty_backordered"]) for s in extras),
          "| comprometidas:", sum(int(sl[s["so_id"]]["qty_committed"]) for s in extras))
    print("   extras cuyo original ya esta facturado:", sum(1 for s in extras if dup_groups[s["mp_order_id"]][0]["status"] == "Billed"))
    lg = defaultdict(list)
    for r in log:
        lg[r["mp_order_id"]].append(r)
    same = sum(1 for k, v in dup_groups.items() if len(v) == len(lg.get(k, [])))
    print(f"   grupos donde #SO == #intentos iPaaS: {same}/{len(dup_groups)}; con TIMEOUT: "
          f"{sum(1 for k in dup_groups if any(r['error_code'] == 'TIMEOUT' for r in lg.get(k, [])))}")
    print("   maximo de SO para una orden:", max(len(v) for v in dup_groups.values()))

    # 5. iPaaS
    print("\n== 5. iPaaS log")
    print("   eventos:", len(log), "ordenes:", len(lg), f"({100 * len(lg) / len(mo):.1f}% del total)")
    print("   errores por codigo:", dict(Counter(r["error_code"] for r in log if r["outcome"] == "ERROR")))
    final = Counter((sorted({r["error_code"] for r in v if r["error_code"]})[0], v[-1]["outcome"]) for v in lg.values())
    print("   resultado final por codigo:", dict(final))
    for code in ("TIMEOUT", "RATE_LIMIT"):
        hours = Counter(r["ts"][11:13] for r in log if r["error_code"] == code)
        print(f"   {code} por hora (top 5):", hours.most_common(5))
    print("   ordenes MP por hora (top 5):", Counter(m["created_at"][11:13] for m in mo.values()).most_common(5))
    inf = [v for v in lg.values() if v[0]["error_code"] == "ITEM_NOT_FOUND"]
    gaps = sorted({(day(v[-1]["ts"]) - day(v[0]["ts"])).days for v in inf})
    print("   ITEM_NOT_FOUND: intentos", Counter(len(v) for v in inf), "| sin SO:",
          sum(1 for v in inf if not so_by_mp.get(v[0]["mp_order_id"])))
    sample = next(iter(inf))
    print("   ejemplo ITEM_NOT_FOUND:", [(r["ts"], r["attempt"], r["message"][:60]) for r in sample])
    oldest = min(day(v[0]["ts"]) for v in inf)
    print("   orden sin SO mas antigua:", oldest.date(), "-> dias al corte:", (datetime(2026, 9, 30) - oldest).days)

    # 6. Comprometidas no despachadas
    cnd = [s for s in so if mo[s["mp_order_id"]]["status"] == "delivered" and int(sl[s["so_id"]]["qty_committed"]) > 0
           and int(sl[s["so_id"]]["qty_fulfilled"]) == 0 and so_by_mp[s["mp_order_id"]][0]["so_id"] == s["so_id"]]
    dl = sorted(mo[s["mp_order_id"]]["delivered_at"][:10] for s in cnd)
    print("\n== 6. Entregadas comprometidas sin despachar:", len(cnd), "entregas entre", dl[0] if dl else "-", "y", dl[-1] if dl else "-")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python verificacion_caso2.py <ruta a data>")
    main(sys.argv[1])
