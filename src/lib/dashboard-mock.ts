export type Kpi = {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  sub: string;
};

export type FunnelStage = {
  stage: string;
  count: number;
  value: number;
  color: string;
};

export type RevenuePoint = {
  m: string;
  bids: number;
  won: number;
  value: number;
};

export type AiInsight = {
  tone: 'hot' | 'warn' | 'info';
  icon: 'Zap' | 'AlertTriangle' | 'Mail';
  title: string;
  body: string;
};

export type ActivityTone = 'blue' | 'navy' | 'green' | 'amber';
export type Activity = {
  tone: ActivityTone;
  who: string;
  what: string;
  when: string;
};

export type Task = {
  id: number;
  text: string;
  due: string;
  priority: 'high' | 'med' | 'low';
  done: boolean;
  assignee: string;
};

export type MapNodeStatus = 'active' | 'bid' | 'hot' | 'done';
export type MapNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  status: MapNodeStatus;
  dist: string;
  val: string;
  anchor: 'start' | 'end';
  below?: boolean;
};

export const KPIS: Kpi[] = [
  { label: 'Active Bids', value: '24', delta: '+12%', up: true, sub: 'vs. last month' },
  { label: 'Win Rate', value: '34%', delta: '+4.2pt', up: true, sub: 'last 90 days' },
  { label: 'Pipeline Value', value: '$4.82M', delta: '+$612k', up: true, sub: 'estimated' },
  { label: 'Avg. Distance', value: '42 mi', delta: '-6%', up: true, sub: 'from Boston base' },
];

export const BID_FUNNEL: FunnelStage[] = [
  { stage: 'New', count: 8, value: 980_000, color: 'var(--color-ink-400)' },
  { stage: 'Reviewing', count: 6, value: 1_420_000, color: 'var(--color-blue-500)' },
  { stage: 'Qualified', count: 5, value: 1_180_000, color: 'var(--color-navy-800)' },
  { stage: 'Sent to Takeoff', count: 5, value: 1_240_000, color: 'var(--color-success-500)' },
];

export const REVENUE_SERIES: RevenuePoint[] = [
  { m: 'Nov', bids: 18, won: 5, value: 420 },
  { m: 'Dec', bids: 22, won: 7, value: 580 },
  { m: 'Jan', bids: 19, won: 6, value: 510 },
  { m: 'Feb', bids: 27, won: 9, value: 720 },
  { m: 'Mar', bids: 31, won: 11, value: 890 },
  { m: 'Apr', bids: 24, won: 8, value: 680 },
];

export const AI_INSIGHTS: AiInsight[] = [
  {
    tone: 'hot',
    icon: 'Zap',
    title: 'Hot bid flagged',
    body: 'Charlestown Mixed-Use (Turner) — AI score 92. Matches your siding specialty and is 8mi from base. Prior 4 bids with Turner won.',
  },
  {
    tone: 'warn',
    icon: 'AlertTriangle',
    title: 'Distance exceeds 100mi',
    body: 'Worcester Plaza (Gilbane) is 118mi from Boston base — auto-rejected per your rule.',
  },
  {
    tone: 'info',
    icon: 'Mail',
    title: '3 new bids from Gmail',
    body: 'Captured from inbox this morning. All awaiting triage.',
  },
];

export const RECENT_ACTIVITY: Activity[] = [
  { tone: 'blue', who: 'Marco Ribeiro', what: 'moved BID-2026-0184 to Sent to Takeoff', when: '12m' },
  { tone: 'navy', who: 'AI Assistant', what: 'generated pre-analysis for BID-2026-0187 (score 87)', when: '38m' },
  { tone: 'green', who: 'Jessica Cole', what: 'uploaded 6 drawings to Seaport Tower', when: '1h' },
  { tone: 'amber', who: 'System', what: 'auto-rejected BID-2026-0182 (distance > 100mi)', when: '3h' },
  { tone: 'blue', who: 'Andre Tremura', what: 'qualified Cambridge Biotech bid', when: 'yesterday' },
];

export const TASKS: Task[] = [
  { id: 1, text: 'Review Seaport Tower specs by Thu', due: 'Apr 23', priority: 'high', done: false, assignee: 'AT' },
  { id: 2, text: 'Call Turner PM re: Charlestown scope', due: 'Apr 22', priority: 'med', done: false, assignee: 'AT' },
  { id: 3, text: 'Upload measured drawings — Back Bay HVAC', due: 'Apr 24', priority: 'med', done: false, assignee: 'MR' },
  { id: 4, text: 'Confirm site visit — Somerville Lab', due: 'Apr 21', priority: 'high', done: true, assignee: 'JC' },
  { id: 5, text: 'Send revised estimate — Cambridge Biotech', due: 'Apr 25', priority: 'low', done: false, assignee: 'MR' },
];

export const MAP_NODES: MapNode[] = [
  { id: 'BID-0421', name: 'Seaport Tower', x: 770, y: 345, status: 'hot', dist: '2.1mi', val: '$840k', anchor: 'start' },
  { id: 'PRJ-0318', name: 'Cambridge Labs', x: 730, y: 300, status: 'active', dist: '4.8mi', val: '$1.2M', anchor: 'end' },
  { id: 'PRJ-0334', name: 'Newton Schoolhouse', x: 710, y: 315, status: 'active', dist: '9mi', val: '$920k', anchor: 'end', below: true },
  { id: 'BID-0419', name: 'Lowell Mill Loft', x: 685, y: 225, status: 'bid', dist: '28mi', val: '$1.1M', anchor: 'end' },
  { id: 'PRJ-0292', name: 'Plymouth Waterfront', x: 805, y: 475, status: 'active', dist: '38mi', val: '$1.8M', anchor: 'start' },
  { id: 'BID-0417', name: 'Worcester Medical', x: 500, y: 305, status: 'bid', dist: '47mi', val: '$2.1M', anchor: 'end' },
  { id: 'PRJ-0251', name: 'Provincetown Estate', x: 895, y: 485, status: 'done', dist: '62mi', val: 'completed', anchor: 'end' },
  { id: 'BID-0402', name: 'Springfield Residence', x: 280, y: 335, status: 'bid', dist: '89mi', val: '$640k', anchor: 'start' },
];

export const MAP_STATUS: Record<
  MapNodeStatus,
  { color: string; grad: string; dotClass: string }
> = {
  active: { color: '#18B56A', grad: 'gradActive', dotClass: 'bg-success-500' },
  bid: { color: '#E08A00', grad: 'gradBid', dotClass: 'bg-warn-500' },
  hot: { color: '#E14545', grad: 'gradHot', dotClass: 'bg-danger-500' },
  done: { color: '#5E86A1', grad: 'gradDone', dotClass: 'bg-navy-400' },
};

/* ------------------------------------------------------------------
   BIDS
   ------------------------------------------------------------------ */
export type BidStatus =
  | 'new'
  | 'reviewing'
  | 'qualified'
  | 'sent_to_takeoff'
  | 'rejected';

export type BidFlag = 'hot' | 'ai' | 'distance' | null;

export type Bid = {
  id: string;
  project: string;
  client: string;
  workType: string;
  status: BidStatus;
  value: number;
  distance: number;
  dueDate: string;
  owner: string;
  aiScore: number | null;
  docs: number;
  createdAt: string;
  flag: BidFlag;
};

export const BIDS: Bid[] = [
  { id: 'BID-2026-0187', project: 'Seaport Tower — Interior Buildout L12-14', client: 'Suffolk Construction', workType: 'Finish Carpentry', status: 'reviewing', value: 284_500, distance: 12, dueDate: 'Apr 28', owner: 'AT', aiScore: 87, docs: 7, createdAt: '2 days ago', flag: 'ai' },
  { id: 'BID-2026-0186', project: 'Charlestown Mixed-Use — Exterior Panels', client: 'Turner Construction', workType: 'Siding', status: 'qualified', value: 512_000, distance: 8, dueDate: 'May 02', owner: 'AT', aiScore: 92, docs: 12, createdAt: '3 days ago', flag: 'hot' },
  { id: 'BID-2026-0185', project: 'Back Bay Office — HVAC Ductwork Phase 2', client: 'Shawmut Design & Construction', workType: 'Sheet Metal', status: 'new', value: 178_300, distance: 4, dueDate: 'Apr 30', owner: '—', aiScore: null, docs: 3, createdAt: '5 hours ago', flag: null },
  { id: 'BID-2026-0184', project: 'Somerville Lab — Mechanical Rooms', client: 'Consigli Construction', workType: 'Sheet Metal', status: 'sent_to_takeoff', value: 346_800, distance: 6, dueDate: 'Apr 25', owner: 'MR', aiScore: 81, docs: 9, createdAt: '6 days ago', flag: null },
  { id: 'BID-2026-0183', project: 'Quincy Residential — Trim & Millwork', client: 'Callahan Construction', workType: 'Finish Carpentry', status: 'reviewing', value: 94_200, distance: 14, dueDate: 'May 10', owner: 'AT', aiScore: 68, docs: 4, createdAt: '1 week ago', flag: null },
  { id: 'BID-2026-0182', project: 'Worcester Plaza — Facade Metal', client: 'Gilbane Building Co.', workType: 'Sheet Metal', status: 'rejected', value: 0, distance: 118, dueDate: '—', owner: 'System', aiScore: 22, docs: 2, createdAt: '1 week ago', flag: 'distance' },
  { id: 'BID-2026-0181', project: 'Cambridge Biotech — Ceiling Details', client: 'John Moriarty & Associates', workType: 'Finish Carpentry', status: 'qualified', value: 232_400, distance: 7, dueDate: 'May 06', owner: 'MR', aiScore: 89, docs: 11, createdAt: '1 week ago', flag: null },
  { id: 'BID-2026-0180', project: 'Medford Retail Fit-Out', client: 'Dellbrook JKS', workType: 'Finish Carpentry', status: 'new', value: 67_800, distance: 9, dueDate: 'May 14', owner: '—', aiScore: null, docs: 2, createdAt: 'yesterday', flag: null },
];

export const BID_STATUS_META: Record<
  BidStatus,
  { label: string; dotColor: string; textColor: string; bgColor: string }
> = {
  new: {
    label: 'New',
    dotColor: 'bg-ink-400',
    textColor: 'text-fg-muted',
    bgColor: 'bg-ink-100/60',
  },
  reviewing: {
    label: 'Reviewing',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-300',
    bgColor: 'bg-blue-500/15',
  },
  qualified: {
    label: 'Qualified',
    dotColor: 'bg-success-500',
    textColor: 'text-success-500',
    bgColor: 'bg-success-500/15',
  },
  sent_to_takeoff: {
    label: 'Sent to Takeoff',
    dotColor: 'bg-success-500',
    textColor: 'text-success-500',
    bgColor: 'bg-success-500/15',
  },
  rejected: {
    label: 'Rejected',
    dotColor: 'bg-danger-500',
    textColor: 'text-danger-500',
    bgColor: 'bg-danger-500/15',
  },
};

export function formatMoney(n: number): string {
  if (n === 0) return '—';
  const k = n / 1000;
  if (k >= 1000) return `$${(k / 1000).toFixed(2)}M`;
  if (n >= 100_000) return `$${k.toFixed(0)}k`;
  return `$${k.toFixed(1).replace('.0', '')}k`;
}
