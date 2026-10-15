"""Clasificacion final caso 2 - ordenes entregadas en el marketplace no facturadas en NetSuite.

Uso: python -I clasificacion_caso2.py <data_dir> [out_csv]

Unidad: orden del marketplace (mp_order_id) con status=delivered. Las SO duplicadas se
reportan aparte (son demanda fantasma, NO ordenes a facturar).

Regla de prioridad (una causa por orden, la mas "aguas arriba" gana):
  1 SIN_SO_SKU_SIN_MAPEO      no hay SO; ultimo intento iPaaS = ITEM_NOT_FOUND
  2 BO_ITEM_SIN_STOCK_NS      SKU mapeado a un item con 2 SKUs, sin stock ni TO (mapeo dudoso)
  3 BO_STOCK_DISPONIBLE       BO, pero hay disponible hoy en la location (no se re-comprometio)
  4 BO_TO_EN_TRANSITO         BO cubierto por in_transit de TO parcialmente recibida
  5 BO_SIN_COBERTURA          BO sin disponible ni transito (descuadre fisico vs NS)
  6 COMPROMETIDA_NO_DESPACHADA committed y entregada, sin fulfillment
  7 PENDIENTE_FACTURAR        fulfilled, sin factura (rezago normal de facturacion)
  Asignacion 3/4/5: FIFO por fecha de SO dentro de cada item+location; la orden va al
  bucket que cubre su ULTIMA unidad (criterio conservador).
"""
import csv, sys, os
from collections import Counter, defaultdict

d = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None
def load(n):
    with open(os.path.join(d, n), encoding='utf-8') as f:
        return list(csv.DictReader(f))
mo = {r['mp_order_id']: r for r in load('marketplace_orders.csv')}
so = load('sales_orders.csv'); sl = {r['so_id']: r for r in load('so_lines.csv')}
im = load('item_mapping.csv'); inv = {(r['item_id'], r['location']): r for r in load('inventory_snapshot.csv')}
log = load('ipaas_log.csv')
I = int
skus_per_item = Counter(r['item_id'] for r in im)
lg = defaultdict(list)
for r in log: lg[r['mp_order_id']].append(r)
for v in lg.values(): v.sort(key=lambda r: I(r['attempt']))

so_by_mp = defaultdict(list)
for r in so:
    r['l'] = sl[r['so_id']]; so_by_mp[r['mp_order_id']].append(r)
for v in so_by_mp.values(): v.sort(key=lambda r: (r['created_at'], r['so_id']))

res = {}   # mp_order_id -> (cause, units, so_id, item)
bo_queue = defaultdict(list)
dups = []
for k, m in mo.items():
    if m['status'] != 'delivered': continue
    sos = so_by_mp.get(k, [])
    if not sos:
        last = lg[k][-1]['error_code'] if k in lg else 'NO_LOG'
        res[k] = ('1_SIN_SO_SKU_SIN_MAPEO' if last == 'ITEM_NOT_FOUND' else '1_SIN_SO_' + last, I(m['qty']), '', '')
        continue
    orig, extra = sos[0], sos[1:]
    dups.extend(extra)
    if any(s['status'] == 'Billed' for s in sos):
        res[k] = ('0_FACTURADA', I(m['qty']), orig['so_id'], orig['l']['item_id']); continue
    l = orig['l']
    if I(l['qty_backordered']) > 0:
        if skus_per_item[l['item_id']] > 1 and I(inv[(l['item_id'], orig['location'])]['on_hand']) == 0:
            res[k] = ('2_BO_ITEM_SIN_STOCK_NS', I(l['qty_backordered']), orig['so_id'], l['item_id'])
        else:
            bo_queue[(l['item_id'], orig['location'])].append(orig)
    elif I(l['qty_committed']) > 0:
        res[k] = ('6_COMPROMETIDA_NO_DESPACHADA', I(l['qty_committed']), orig['so_id'], l['item_id'])
    elif I(l['qty_fulfilled']) > I(l['qty_billed']):
        res[k] = ('7_PENDIENTE_FACTURAR', I(l['qty_fulfilled']) - I(l['qty_billed']), orig['so_id'], l['item_id'])
    else:
        res[k] = ('9_OTRO_' + orig['status'], I(m['qty']), orig['so_id'], l['item_id'])

for key, q in bo_queue.items():
    iv = inv[key]; avail = I(iv['available']); trans = I(iv['in_transit'])
    used = 0
    for s in sorted(q, key=lambda r: (r['created_at'], r['so_id'])):
        u = I(s['l']['qty_backordered']); used += u
        c = '3_BO_STOCK_DISPONIBLE' if used <= avail else '4_BO_TO_EN_TRANSITO' if used <= avail + trans else '5_BO_SIN_COBERTURA'
        res[s['mp_order_id']] = (c, u, s['so_id'], key[0])

tab = defaultdict(lambda: [0, 0])
for c, u, *_ in res.values():
    tab[c][0] += 1; tab[c][1] += u
print('%-32s %8s %8s' % ('causa', 'ordenes', 'unidades'))
for c in sorted(tab): print('%-32s %8d %8d' % (c, tab[c][0], tab[c][1]))
nb = {c: v for c, v in tab.items() if not c.startswith('0_')}
print('TOTAL entregadas no facturadas', sum(v[0] for v in nb.values()), sum(v[1] for v in nb.values()))
bo = {c: v for c, v in tab.items() if '_BO_' in c}
print('subtotal BO (entregadas en backorder, sin dup)', sum(v[0] for v in bo.values()), sum(v[1] for v in bo.values()))

# duplicados
print('\nSO duplicadas (extra):', len(dups), 'sobre', len({s['mp_order_id'] for s in dups}), 'ordenes;',
      'unidades', sum(I(s['l']['qty']) for s in dups), Counter(s['status'] for s in dups),
      'BO units', sum(I(s['l']['qty_backordered']) for s in dups), 'committed', sum(I(s['l']['qty_committed']) for s in dups))
print('dups cuyo original esta Billed:', sum(1 for s in dups if any(x['status'] == 'Billed' for x in so_by_mp[s['mp_order_id']])))
print('status del original de las duplicadas:', Counter(so_by_mp[s['mp_order_id']][0]['status'] for s in dups))
# overlap dup vs legit BO por item (riesgo al re-comprometer)
legit_items = {k for k in bo_queue}
ov = [s for s in dups if (s['l']['item_id'], s['location']) in legit_items and s['status'] != 'Closed']
print('dups abiertas en items con BO legitimo:', len(ov), 'unidades', sum(I(s['l']['qty_backordered']) for s in ov))
print('SO BO total (incluye dup y own/paid):', sum(1 for r in so if I(r['l']['qty_backordered']) > 0), sum(I(r['l']['qty_backordered']) for r in so))
paid = [r for r in so if mo[r['mp_order_id']]['status'] != 'delivered' and I(r['l']['qty_backordered']) > 0]
print('BO no entregadas (own/paid, quiebre real CENTRAL):', len(paid), sum(I(r['l']['qty_backordered']) for r in paid))

# iPaaS
print('\n--- iPaaS ---')
seqcls = Counter(); dup_by_first = Counter()
for k, v in lg.items():
    codes = {r['error_code'] for r in v if r['error_code']}
    fin = v[-1]['outcome']
    seqcls[(tuple(sorted(codes)), fin, len(so_by_mp.get(k, [])) > 1)] += 1
for s, n in seqcls.most_common(): print(s, n)
tm = [k for k, v in lg.items() if any(r['error_code'] == 'TIMEOUT' for r in v)]
print('ordenes con TIMEOUT', len(tm), 'duplicadas', sum(1 for k in tm if len(so_by_mp.get(k, [])) > 1),
      'SO extra', sum(len(so_by_mp.get(k, [])) - 1 for k in tm))
print('SO extra == intentos-1 en dup:', all(len(so_by_mp[k]) == len(lg[k]) for k in tm if len(so_by_mp.get(k, [])) > 1))
print('intentos por codigo', {c: Counter(len(v) for v in lg.values() if v[0]['error_code'] == c) for c in ('TIMEOUT', 'RATE_LIMIT', 'ITEM_NOT_FOUND')})
print('ordenes en log', len(lg), 'pct del total MO', round(100 * len(lg) / len(mo), 2))
print('eventos error/hora pico', sorted(Counter(r['ts'][11:13] for r in log if r['outcome'] == 'ERROR' and r['error_code'] != 'ITEM_NOT_FOUND').items(), key=lambda x: -x[1])[:6])
mo_hour = Counter(m['created_at'][11:13] for m in mo.values())
print('MO por hora top', mo_hour.most_common(6))

if out:
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['mp_order_id', 'causa', 'unidades', 'so_id', 'item_id'])
        for k, v in sorted(res.items()):
            if not v[0].startswith('0_'): w.writerow([k, *v])
    print('detalle ->', out)
    dup_out = os.path.join(os.path.dirname(out), 'duplicadas.csv')
    with open(dup_out, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['so_id_duplicada', 'mp_order_id', 'status', 'qty_backordered', 'so_id_original', 'status_original'])
        for s in sorted(dups, key=lambda r: (r['mp_order_id'], r['so_id'])):
            o = so_by_mp[s['mp_order_id']][0]
            w.writerow([s['so_id'], s['mp_order_id'], s['status'], s['l']['qty_backordered'], o['so_id'], o['status']])
    print('duplicadas ->', dup_out)
