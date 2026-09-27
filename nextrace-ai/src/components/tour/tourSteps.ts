// NEXTRACE AI — Guided tour content
// Steps anchor to real elements (data-tour attributes or stable ids). Missing anchors are skipped,
// so a step never points at empty space when a panel is not rendered (e.g. no session running).

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const GLOBAL: TourStep[] = [
  { selector: '[data-tour="sidebar"]', title: 'Navigation', body: 'The workflow runs top to bottom: Dashboard for the overview, Live Monitoring and Attack Prediction for the live session, Historical and Forensic analysis for captured PCAPs, and Alerts and Reports for triage and hand-off.' },
  { selector: '[data-tour="live-indicator"]', title: 'Live session status', body: 'Always visible. Grey means no session is running. While a session runs, it shows elapsed time and packets, coloured green, amber or red by the most severe activity still ongoing. Click it to jump to Live Monitoring.' },
  { selector: '[data-tour="notifications"]', title: 'Alert notifications', body: 'One notification per grouped activity. Hundreds of packets from the same attack update a single alert instead of creating hundreds.' },
  { selector: '[data-tour="search"]', title: 'Search', body: 'Press Ctrl + K to search for an IP, alert or investigation.' },
];

const PAGES: { prefix: string; steps: TourStep[] }[] = [
  {
    prefix: '/live-monitoring',
    steps: [
      { selector: '[data-tour="live-controls"]', title: 'Start a session', body: 'Choose benign or suspicious demo traffic and a temporal window, then press Start. Figures appear within about a second.' },
      { selector: '[data-tour="live-activities"]', title: 'Detected activities', body: 'Suspicious packets are grouped by similarity into activities (scan, brute force, lateral movement…). Each row is one alert-worthy activity. Click a row for deep inspection.' },
      { selector: '[data-tour="live-timeline"]', title: 'Attack timeline', body: 'Detections, escalations and changes in chronological order. Click an entry to see what it means and which assets it affects, then jump to that activity.' },
      { selector: '[data-tour="temporal-state"]', title: 'Temporal state', body: 'Updates every second while the window fills. ▲/▼ compare each figure with the previous window. Rises that mean more risk are shown in red.' },
      { selector: '[data-tour="live-packets"]', title: 'Raw packet stream', body: 'Collapsed by default. Open it when you need the individual packets behind an activity.' },
    ],
  },
  {
    prefix: '/attack-prediction',
    steps: [
      { selector: '[data-tour="stage-map"]', title: 'Attack stage map', body: 'Each kill-chain stage is marked Observed (click an activity chip to inspect it), Predicted (the forecast) or Not seen.' },
      { selector: '#generate-live-report-btn', title: 'Generate a report', body: 'Builds an incident report from this session: summary, stage map, affected assets, recommended actions, evidence and limitations. Exportable as PDF, Markdown or JSON.' },
    ],
  },
  {
    prefix: '/historical-pcap',
    steps: [
      { selector: '[data-tour="hist-kpis"]', title: 'Capture at a glance', body: 'Grouped activities, highest severity, affected assets and capture size.' },
      { selector: '[data-tour="stage-map"]', title: 'Where the attack got to', body: 'Kill-chain stages observed in the capture, with the activities that prove each one.' },
      { selector: '[data-tour="hist-tabs"]', title: 'Tabs instead of scrolling', body: 'Overview has the plain-language explanation, affected assets and actions. The other tabs hold the activities, entities (what each host did), timeline, relationships and evidence limits.' },
      { selector: '[data-tour="explain-btn"]', title: 'Plain-language summary', body: 'Explanations appear instantly. "Summarise with AI" asks the server for a short narrative; the server uses an LLM only if one is configured, otherwise a template. Only typed facts are sent, never packet contents.' },
      { selector: '#open-forensic-analysis-btn', title: 'Forensic reasoning', body: 'Tests hypotheses against the capture. You validate each one before it goes into the report.' },
    ],
  },
  {
    prefix: '/forensic',
    steps: [
      { selector: '[data-tour="hypotheses"]', title: 'Validate hypotheses', body: 'The engine proposes a verdict with a transparent score. Use the checklist and the Wireshark filter to verify it, then mark it Confirmed, Rejected or Needs more data.' },
      { selector: '#generate-report-btn', title: 'Report', body: 'The report records both the engine verdict and your validation. Rejected hypotheses are left out of the findings.' },
    ],
  },
  {
    prefix: '/alerts',
    steps: [
      { selector: '[data-tour="alert-kpis"]', title: 'Triage overview', body: 'Click a card to filter the alerts by severity or status.' },
      { selector: '[data-tour="alert-table"]', title: 'Alert queue', body: 'Open an alert to see what it means, the affected assets, recommended actions, and how many events it aggregates.' },
    ],
  },
  {
    prefix: '/investigation',
    steps: [
      { selector: '[data-tour="entity-behaviour"]', title: 'What this host did', body: 'Every activity involving the host: repeated login attempts, scans, attacks received, with attempt counts, services and what the network can or cannot show about the outcome.' },
    ],
  },
  {
    prefix: '/reports/',
    steps: [
      { selector: '[data-tour="report-kpis"]', title: 'Headline figures', body: 'Taken from the analysed data. The same figures appear on page 1 of the PDF.' },
      { selector: '#export-pdf-btn', title: 'Export', body: 'The PDF contains exactly what this page shows and runs to as many pages as the data needs.' },
    ],
  },
  {
    prefix: '/',
    steps: [
      { selector: '#top-risk-entities', title: 'Top risk entities', body: 'Only hosts with observed suspicious behaviour appear here. Click one to open an investigation.' },
    ],
  },
];

export function stepsFor(pathname: string, includeGlobal: boolean): TourStep[] {
  const page = PAGES.find(p => (p.prefix === '/' ? pathname === '/' : pathname.startsWith(p.prefix)));
  return [...(includeGlobal ? GLOBAL : []), ...(page?.steps ?? [])];
}
