// Real generated packing-list PDF (redesign §8) — matches the SB-IBR-1018 sample layout:
// company header, buyer/invoice/DC block, item table, 7-day declaration, sign-off row.
// Uses @react-pdf/renderer (pure Node, no headless browser). renderToBuffer streams a real file.
import React from 'react';
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica', color: '#111' },
  center: { textAlign: 'center' },
  company: { fontSize: 13, fontWeight: 'bold' },
  sub: { fontSize: 7, color: '#555', marginTop: 2 },
  title: { fontSize: 10, fontWeight: 'bold', marginTop: 6, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  metaCell: { width: '50%', paddingVertical: 2, flexDirection: 'row' },
  metaLabel: { color: '#666', width: 80 },
  metaVal: { fontWeight: 'bold', flex: 1 },
  tHead: { flexDirection: 'row', backgroundColor: '#eee', borderTop: 1, borderBottom: 1, borderColor: '#999' },
  tRow: { flexDirection: 'row', borderBottom: 1, borderColor: '#ddd', minHeight: 14 },
  cell: { paddingVertical: 3, paddingHorizontal: 3, borderRight: 1, borderColor: '#ddd' },
  section: { fontWeight: 'bold', backgroundColor: '#f4f4f4', paddingVertical: 3, paddingHorizontal: 3, borderBottom: 1, borderColor: '#ddd' },
  decl: { marginTop: 14, fontSize: 7, lineHeight: 1.4 },
  signRow: { flexDirection: 'row', marginTop: 26, justifyContent: 'space-between' },
  signBox: { width: '22%', borderTop: 1, borderColor: '#333', paddingTop: 4, textAlign: 'center', fontSize: 7 },
});

// Column widths (sum ≈ 100).
const COLS = [
  ['#', 4], ['Description', 26], ['MOC', 8], ['Size / Spec', 22],
  ['IBR No', 10], ['Item Code', 12], ['Box', 8], ['Qty', 6], ['Make', 8],
];

function Meta({ label, value }) {
  return (
    <View style={s.metaCell}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaVal}>{value || '—'}</Text>
    </View>
  );
}

function Row({ it }) {
  const vals = [it.s_no, it.material_description, it.moc, it.size_spec, it.ibr_no, it.item_code, it.box_no, `${it.qty} ${it.unit || ''}`.trim(), it.make];
  return (
    <View style={s.tRow} wrap={false}>
      {COLS.map(([, w], i) => (
        <Text key={i} style={[s.cell, { width: `${w}%` }]}>{vals[i] ?? '—'}</Text>
      ))}
    </View>
  );
}

// Group items by their free-text section (Boiler / Chimney / Ducting), if any (§8).
function grouped(items) {
  const groups = {};
  for (const it of items) (groups[it.section || ''] ||= []).push(it);
  return groups;
}

function PackingDoc({ list, items, title = 'MASTER PACKING LIST' }) {
  const groups = grouped(items);
  const sections = Object.keys(groups);
  const single = sections.length === 1 && sections[0] === '';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.center}>
          <Text style={s.company}>SHANTI BOILERS &amp; PRESSURE VESSELS PVT LTD</Text>
          <Text style={s.sub}>P-10-10, I.D.A, Nacharam, Hyderabad - 500 056 · Stores@shantiboilers.com</Text>
          <Text style={s.title}>{title}</Text>
        </View>

        <View style={s.metaRow}>
          <Meta label="Buyer" value={list.customer_name} />
          <Meta label="Packing No" value={list.packing_no} />
          <Meta label="Address" value={list.customer_address} />
          <Meta label="Package Type" value={list.package_type} />
          <Meta label="Invoice No" value={list.invoice_no} />
          <Meta label="Invoice Date" value={list.invoice_date} />
          <Meta label="D.C. No" value={list.dc_no} />
          <Meta label="D.C. Date" value={list.dc_date} />
          <Meta label="Dispatch Through" value={list.dispatch_through} />
          <Meta label="Vehicle No" value={list.vehicle_no} />
        </View>

        <View style={s.tHead}>
          {COLS.map(([label, w], i) => (
            <Text key={i} style={[s.cell, { width: `${w}%`, fontWeight: 'bold' }]}>{label}</Text>
          ))}
        </View>
        {single
          ? groups[''].map(it => <Row key={it.id} it={it} />)
          : sections.map(sec => (
              <View key={sec || 'ungrouped'}>
                <Text style={s.section}>{sec || 'Other'}</Text>
                {groups[sec].map(it => <Row key={it.id} it={it} />)}
              </View>
            ))}

        <Text style={s.decl}>
          Declaration: Dear Sir, kindly check all the above materials as per the packing list,
          item-wise, and confirm within 7 days if there are any discrepancies or missing items
          mentioned in the packing list but not received at your end.
        </Text>

        <View style={s.signRow}>
          {['Stores', 'Production', 'QC', 'Management'].map(r => (
            <Text key={r} style={s.signBox}>{r}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderPackingPdf(list, items) {
  return renderToBuffer(<PackingDoc list={list} items={items} />);
}

// Pending-list PDF — the still-unpacked BOM lines for a project (§8).
export async function renderPendingPdf(project, pending) {
  const items = pending.map((b, i) => ({
    id: b.id, s_no: i + 1, material_description: b.material_description,
    moc: b.moc, size_spec: b.size_spec, qty: '', unit: '',
  }));
  const list = { customer_name: project.customer_name, packing_no: `PENDING / ${project.project_no}` };
  return renderToBuffer(<PackingDoc list={list} items={items} title="PENDING PACKING LIST" />);
}
