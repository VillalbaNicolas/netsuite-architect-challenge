"""Caso 1 - Inbound MX: por que los controles de recepcion no frenaron.

Uso:  python analisis_caso1.py <ruta a caso-1-inbound-mx/data>
Solo libreria estandar (csv). Imprime un resumen por causa con evidencia.
"""
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

FX_USD_MXN = 18.0  # supuesto para expresar montos en MXN


def load(data, name):
    with open(Path(data) / name, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main(data):
    ships = {r["shipment_id"]: r for r in load(data, "inbound_shipments.csv")}
    lcs = load(data, "landed_costs.csv")
    receipts = {r["receipt_id"]: r for r in load(data, "item_receipts.csv")}
    lines = load(data, "receipt_lines.csv")
    master = load(data, "pedimento_master.csv")
    invoices = load(data, "invoices_mx.csv")

    lc_by_ship = defaultdict(list)
    for r in lcs:
        lc_by_ship[r["shipment_id"]].append(r)

    print("== Universo")
    print(f"embarques={len(ships)} recepciones={len(receipts)} lineas={len(lines)} "
          f"maestro={len(master)} facturas={len(invoices)}")
    print("por source:", dict(Counter(r["source"] for r in receipts.values())))
    print("por flujo :", dict(Counter(r["receiving_flow"] for r in receipts.values())))

    # --- Causa A: recepcion sin landed cost confirmado al momento de recibir -------------
    print("\n== A. Recibido sin landed cost completo/confirmado al recibir")
    cost_issues = []
    for rid, r in receipts.items():
        s = ships[r["shipment_id"]]
        recv = r["received_date"]
        rows_at_recv = [x for x in lc_by_ship[s["shipment_id"]] if x["loaded_date"] <= recv]
        confirmed_at_recv = s["lc_status"] == "Confirmed" and s["lc_confirmed_date"] and s["lc_confirmed_date"] <= recv
        if not rows_at_recv or not confirmed_at_recv:
            total = sum(float(x["amount"]) * (FX_USD_MXN if x["currency"] == "USD" else 1)
                        for x in lc_by_ship[s["shipment_id"]])
            cost_issues.append((rid, s["shipment_id"], r["source"], r["receiving_flow"], recv,
                                s["lc_status"], s["lc_confirmed_date"] or "-", len(rows_at_recv),
                                len(lc_by_ship[s["shipment_id"]]), round(total)))
    for c in cost_issues:
        print("  IR %s ship %s | %s | %s | recibido %s | lc_status=%s confirmado=%s | "
              "filas LC al recibir=%d hoy=%d | LC total hoy=%s MXN" % c)
    print("  por source:", dict(Counter(c[2] for c in cost_issues)))
    qty_by_receipt = defaultdict(int)
    for l in lines:
        qty_by_receipt[l["receipt_id"]] += int(l["qty"])
    print("  unidades afectadas:", sum(qty_by_receipt[c[0]] for c in cost_issues))

    # unidades vendidas de esos embarques antes de confirmar el LC
    lots_of = defaultdict(set)
    for l in lines:
        lots_of[receipts[l["receipt_id"]]["shipment_id"]].add(l["lot"])
    sold_before = 0
    for c in cost_issues:
        s = ships[c[1]]
        conf = s["lc_confirmed_date"] if s["lc_status"] == "Confirmed" else "9999-12-31"
        sold_before += sum(int(i["qty"]) for i in invoices
                           if i["lot"] in lots_of[c[1]] and i["invoice_date"] < conf)
    print("  unidades vendidas antes de confirmar el LC:", sold_before)

    # Estimacion del LC que falta en los embarques que hoy no tienen ninguna fila (rango por dos metodos)
    lc_mxn = {sid: sum(float(x["amount"]) * (FX_USD_MXN if x["currency"] == "USD" else 1) for x in rows)
              for sid, rows in lc_by_ship.items()}
    units_by_ship = defaultdict(int)
    for rid, r in receipts.items():
        units_by_ship[r["shipment_id"]] += qty_by_receipt[rid]
    with_lc = [sid for sid in lc_mxn if lc_mxn[sid] > 0 and units_by_ship[sid]]
    weighted = sum(lc_mxn[s] for s in with_lc) / sum(units_by_ship[s] for s in with_lc)
    simple = sum(lc_mxn[s] / units_by_ship[s] for s in with_lc) / len(with_lc)
    no_lc = [c[1] for c in cost_issues if c[8] == 0]
    no_lc_units = sum(units_by_ship[s] for s in no_lc)
    print(f"  LC cargado tarde (hoy cargado): {round(sum(lc_mxn[c[1]] for c in cost_issues if c[8] > 0))} MXN")
    print(f"  embarques sin ninguna fila de LC: {no_lc} unidades={no_lc_units}")
    print(f"  LC faltante estimado: {round(weighted * no_lc_units)} MXN (promedio ponderado {weighted:.1f} MXN/u) "
          f"a {round(simple * no_lc_units)} MXN (promedio simple {simple:.1f} MXN/u); "
          f"rango de MXN/u entre embarques: {min(lc_mxn[s] / units_by_ship[s] for s in with_lc):.0f}-"
          f"{max(lc_mxn[s] / units_by_ship[s] for s in with_lc):.0f}")

    # --- Causa B: maestro de pedimentos faltante -> CFDI sin pedimento --------------------
    print("\n== B. Maestro de pedimentos y CFDI sin pedimento")
    master_keys = {(m["item_id"], m["location"], m["lot"]) for m in master}
    missing = defaultdict(lambda: [0, 0])
    for l in lines:
        r = receipts[l["receipt_id"]]
        if (l["item_id"], r["location"], l["lot"]) not in master_keys:
            missing[(l["receipt_id"], r["receiving_flow"], r["source"])][0] += 1
            missing[(l["receipt_id"], r["receiving_flow"], r["source"])][1] += int(l["qty"])
    for k, v in sorted(missing.items()):
        print(f"  IR {k[0]} | {k[1]} | {k[2]} | lineas sin maestro={v[0]} unidades={v[1]}")
    print("  recepciones por flujo con lineas sin maestro:", dict(Counter(k[1] for k in missing)))

    no_ped = [i for i in invoices if not i["numero_pedimento"].strip()]
    lot_flow = {}
    for l in lines:
        lot_flow[l["lot"]] = receipts[l["receipt_id"]]["receiving_flow"]
    print(f"  CFDI sin pedimento={len(no_ped)} unidades={sum(int(i['qty']) for i in no_ped)}")
    print("  por flujo del lote :", dict(Counter(lot_flow.get(i["lot"], "?") for i in no_ped)))
    print("  por mes            :", dict(sorted(Counter(i["invoice_date"][:7] for i in no_ped).items())))
    direct_by_month = Counter(r["received_date"][:7] for r in receipts.values() if r["receiving_flow"] == "direct")
    print("  recepciones directas por mes:", dict(sorted(direct_by_month.items())))

    # --- Causa C: segmento de aduana --------------------------------------------------------
    print("\n== C. Segmento de aduana (cabecera vs linea vs pedimento del embarque)")
    hdr_bad = [rid for rid, r in receipts.items() if r["customs_segment"] != ships[r["shipment_id"]]["customs_number"]]
    print("  cabeceras distintas al pedimento:", len(hdr_bad))
    empty = [l for l in lines if not l["customs_segment"].strip()]
    wrong = [l for l in lines if l["customs_segment"].strip()
             and l["customs_segment"] != ships[receipts[l["receipt_id"]]["shipment_id"]]["customs_number"]]
    print(f"  lineas con segmento vacio={len(empty)} unidades={sum(int(l['qty']) for l in empty)} "
          f"recepciones={sorted({l['receipt_id'] for l in empty})}")
    print("  source de esas recepciones:", dict(Counter(receipts[l['receipt_id']]['source'] for l in empty)))
    print("  lineas con segmento distinto al pedimento:", len(wrong))
    lot_bad = [l for l in lines if l["lot"] != ships[receipts[l["receipt_id"]]["shipment_id"]]["customs_number"]]
    print("  lineas con lote distinto al pedimento:", len(lot_bad))

    # --- Controles complementarios ----------------------------------------------------------
    print("\n== D. Otros chequeos")
    early_customs = [rid for rid, r in receipts.items()
                     if r["received_date"] < ships[r["shipment_id"]]["customs_cleared_date"]]
    print("  recibidos antes del despacho aduanero:", len(early_customs))
    cats = Counter(x["cost_category"] for x in lcs)
    print("  categorias de LC (embarques con cada una):",
          {c: len({x["shipment_id"] for x in lcs if x["cost_category"] == c}) for c in cats})
    reg = [l for l in lines if l["regulated"] == "Y"]
    reg_bad = [l for l in reg if not l["mfg_lot"] or not l["expiry_date"]]
    print(f"  lineas reguladas={len(reg)} sin lote de fabricacion o vencimiento={len(reg_bad)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python analisis_caso1.py <ruta a data>")
    main(sys.argv[1])
