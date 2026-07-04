// lib/milestones.js
// Milestone taxonomy from WORK_FLOW_TRACHER_DASH_BOAD.xlsx. Every new unit gets these seeded in
// order. Each entry also carries a `department` (controlled enum, for exec grouping) and a
// `category` (drives which extra fields the edit drawer shows).

// Controlled department list — used as the drawer <select> options.
export const DEPARTMENTS = ['Design', 'Procurement', 'Production', 'QC', 'Dispatch', 'Installation'];

// Why a milestone slipped — controlled, powers the exec "Delayed because" view + project delay hero.
export const DELAY_CATEGORIES = ['Vendor', 'Material', 'Design', 'Customer', 'Other'];

// category: design | procurement | production | qc | packing | site
export const MILESTONE_TEMPLATE = [
  { key: 'design',            label: 'Design',                                   department: 'Design',       category: 'design' },
  { key: 'design_approval',   label: 'Submit Design Approval',                   department: 'Design',       category: 'design' },
  { key: 'release_bom',       label: 'Release BOM / PR',                         department: 'Design',       category: 'design' },
  { key: 'release_drawings',  label: 'Release All Drawings',                     department: 'Design',       category: 'design' },
  { key: 'order_tubes',       label: 'Order BQ / Tubes',                         department: 'Procurement',  category: 'procurement' },
  { key: 'procure_tubes',     label: 'Procure Tubes',                            department: 'Procurement',  category: 'procurement' },
  { key: 'order_ms',          label: 'Order MS as per PR',                       department: 'Procurement',  category: 'procurement' },
  { key: 'order_valves',      label: 'Order Pumps / Valves / SV / Motors',       department: 'Procurement',  category: 'procurement' },
  { key: 'order_panel',       label: 'Order WLG / Casting / Panel',              department: 'Procurement',  category: 'procurement' },
  { key: 'marking_cutting',   label: 'Marking, Cutting, Rolling Shell',          department: 'Production',   category: 'production' },
  { key: 'drilling',          label: 'Drilling',                                 department: 'Production',   category: 'production' },
  { key: 'shell_welding',     label: 'Shell Welding',                            department: 'Production',   category: 'production' },
  { key: 'site_marking',      label: 'Site Marking',                             department: 'Production',   category: 'production' },
  { key: 'welding_fura',      label: 'Welding (FURA-B / RC / AR)',               department: 'Production',   category: 'production' },
  { key: 'box_up',            label: 'Box Up',                                   department: 'Production',   category: 'production' },
  { key: 'box_up_welding',    label: 'Box Up Welding (OS / IS / G)',             department: 'Production',   category: 'production' },
  { key: 'tube_stay_welding', label: 'Tubes & Stay Rods — Insert & Welding',     department: 'Production',   category: 'production' },
  { key: 'pad_plates',        label: 'Pad Plates / Saddles / Nozzles / LH',      department: 'Production',   category: 'production' },
  { key: 'smoke_box',         label: 'Smoke Box / Feed Line / Ladder / Platform',department: 'Production',   category: 'production' },
  { key: 'hydro_test',        label: 'Hydro Test (HT)',                          department: 'QC',           category: 'qc' },
  { key: 'refractory',        label: 'Refractory',                               department: 'Production',   category: 'production' },
  { key: 'painting',          label: 'Painting',                                 department: 'Production',   category: 'production' },
  { key: 'packing',           label: 'Packing & Labeling',                       department: 'Dispatch',     category: 'packing' },
  { key: 'site_installation', label: 'Site Installation',                        department: 'Installation', category: 'site' },
  { key: 'commissioning',     label: 'Commissioning & Handover',                 department: 'Installation', category: 'site' },
];

const BY_KEY = Object.fromEntries(MILESTONE_TEMPLATE.map(m => [m.key, m]));
export function categoryOf(key) { return BY_KEY[key]?.category || 'production'; }
export function departmentOf(key) { return BY_KEY[key]?.department || 'Production'; }

// The last milestone that must be reached before a packing list can be marked ready.
export const PACKING_MILESTONE_KEY = 'packing';

// Customer-facing phases — business language, NOT internal milestone names. Each phase's status is
// rolled up from its member milestones for the read-only portal stepper.
export const CUSTOMER_PHASES = [
  { key: 'order',        label: 'Order Received',       keys: [] }, // implicit — project exists
  { key: 'design',       label: 'Design & Engineering', keys: ['design', 'design_approval', 'release_bom', 'release_drawings'] },
  { key: 'procurement',  label: 'Material Procurement', keys: ['order_tubes', 'procure_tubes', 'order_ms', 'order_valves', 'order_panel'] },
  { key: 'manufacturing',label: 'Manufacturing',        keys: ['marking_cutting', 'drilling', 'shell_welding', 'site_marking', 'welding_fura', 'box_up', 'box_up_welding', 'tube_stay_welding', 'pad_plates', 'smoke_box'] },
  { key: 'testing',      label: 'Quality Testing',      keys: ['hydro_test'] },
  { key: 'finishing',    label: 'Finishing',            keys: ['refractory', 'painting'] },
  { key: 'packing',      label: 'Packing',              keys: ['packing'] },
  { key: 'installation', label: 'Site Installation',    keys: ['site_installation'] },
  { key: 'commissioning',label: 'Commissioning',        keys: ['commissioning'] },
];
