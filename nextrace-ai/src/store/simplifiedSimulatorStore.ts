import { create } from 'zustand';
import { useLiveStore } from '@/store/liveStore';

export interface TopologyNode {
  id: string;
  ip: string;
  name: string;
  role: string;
  category: 'external' | 'gateway' | 'server' | 'workstation' | 'database' | 'suspicious' | 'internal';
  zone: string;
  os: string;
  ports: string;
  vulnerabilities: string[];
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  baseRisk: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  protocol: string;
  isObservedAttack: boolean;
}

export interface AttackStep {
  step: number;
  sourceId: string;
  targetId: string;
  techniqueId: string;
  technique: string;
  tactic: string;
  priority: number;
  confidence: number;
  timeWindow: string;
  reason: string;
  mitigation: string;
}

export interface ForecastStepInfo {
  step: number;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  targetIp: string;
  targetRole: string;
  tactic: string;
  techniqueId: string;
  techniqueName: string;
  confidence: number;
  riskScore: number;
  timeWindow: string;
  reason: string;
  mitigation: string;
  status: 'completed' | 'active' | 'projected';
}

export interface MitreTechniqueInfo {
  id: string;
  name: string;
  tactic: string;
  description: string;
  mitigation: string;
}

// ── Default Enterprise Network Topology (Always available substrate) ──
export const DEFAULT_ENTERPRISE_NODES: TopologyNode[] = [
  {
    id: '198.51.100.44',
    ip: '198.51.100.44',
    name: 'Threat Actor (C2)',
    role: 'External Adversary',
    category: 'suspicious',
    zone: 'Internet / WAN',
    os: 'Kali Linux 2024.1',
    ports: '443, 8443, 9001',
    vulnerabilities: [],
    criticality: 'Low',
    baseRisk: 15,
  },
  {
    id: '10.0.0.1',
    ip: '10.0.0.1',
    name: 'Perimeter Gateway',
    role: 'Edge Firewall / Router',
    category: 'gateway',
    zone: 'Perimeter Boundary',
    os: 'FortiOS 7.2',
    ports: '80, 443, 22',
    vulnerabilities: ['CVE-2023-27997'],
    criticality: 'Medium',
    baseRisk: 35,
  },
  {
    id: '10.0.1.10',
    ip: '10.0.1.10',
    name: 'Public Web App',
    role: 'DMZ Web Server / NGINX',
    category: 'server',
    zone: 'DMZ Public Tier',
    os: 'Ubuntu 22.04 LTS',
    ports: '80, 443, 8080',
    vulnerabilities: ['CVE-2021-44228 (Log4j RCE)'],
    criticality: 'High',
    baseRisk: 75,
  },
  {
    id: '10.0.2.15',
    ip: '10.0.2.15',
    name: 'Application Core Server',
    role: 'Internal API & Business Logic',
    category: 'server',
    zone: 'Internal Services LAN',
    os: 'RHEL 9.1 Enterprise',
    ports: '8080, 8443, 22',
    vulnerabilities: ['CVE-2022-22965 (Spring4Shell)'],
    criticality: 'High',
    baseRisk: 70,
  },
  {
    id: '10.0.2.55',
    ip: '10.0.2.55',
    name: 'Admin Workstation',
    role: 'SecOps Management Host',
    category: 'workstation',
    zone: 'Admin Management VLAN',
    os: 'Windows 11 Pro 23H2',
    ports: '135, 445, 3389, 5985',
    vulnerabilities: ['CVE-2024-21412 (SmartScreen Bypass)'],
    criticality: 'High',
    baseRisk: 65,
  },
  {
    id: '10.0.2.60',
    ip: '10.0.2.60',
    name: 'Corporate Workstation-HR',
    role: 'HR Department Client',
    category: 'workstation',
    zone: 'Corporate Staff LAN',
    os: 'Windows 11 Enterprise',
    ports: '135, 445, 3389',
    vulnerabilities: ['CVE-2023-36884 (Office RCE)'],
    criticality: 'Medium',
    baseRisk: 45,
  },
  {
    id: '10.0.3.5',
    ip: '10.0.3.5',
    name: 'Domain Controller (AD)',
    role: 'Identity & Access Manager',
    category: 'server',
    zone: 'Core Infrastructure Tier',
    os: 'Windows Server 2022',
    ports: '53 (DNS), 88 (Kerberos), 389 (LDAP), 445 (SMB)',
    vulnerabilities: ['CVE-2020-1472 (Zerologon RCE)'],
    criticality: 'Critical',
    baseRisk: 90,
  },
  {
    id: '10.0.3.20',
    ip: '10.0.3.20',
    name: 'Production SQL Database',
    role: 'Crown Jewel Customer DB',
    category: 'database',
    zone: 'Isolated Data Vault',
    os: 'Debian 12 Bookworm',
    ports: '5432 (PostgreSQL), 22 (SSH)',
    vulnerabilities: ['CVE-2023-39417 (SQL PrivEsc)'],
    criticality: 'Critical',
    baseRisk: 95,
  },
];

export const DEFAULT_ENTERPRISE_EDGES: TopologyEdge[] = [
  { id: 'e-threat-gw', source: '198.51.100.44', target: '10.0.0.1', protocol: 'HTTPS/443 (Ingress Probe)', isObservedAttack: true },
  { id: 'e-gw-web', source: '10.0.0.1', target: '10.0.1.10', protocol: 'HTTP Reverse Proxy', isObservedAttack: true },
  { id: 'e-web-app', source: '10.0.1.10', target: '10.0.2.15', protocol: 'REST API / RPC (8080)', isObservedAttack: false },
  { id: 'e-web-hr', source: '10.0.1.10', target: '10.0.2.60', protocol: 'HTTP Internal Session Pivot', isObservedAttack: false },
  { id: 'e-app-admin', source: '10.0.2.15', target: '10.0.2.55', protocol: 'SSH Management (22)', isObservedAttack: false },
  { id: 'e-hr-admin', source: '10.0.2.60', target: '10.0.2.55', protocol: 'SMB Admin Share (445)', isObservedAttack: false },
  { id: 'e-admin-dc', source: '10.0.2.55', target: '10.0.3.5', protocol: 'Kerberos / WMI / SMB (88/445)', isObservedAttack: false },
  { id: 'e-app-db', source: '10.0.2.15', target: '10.0.3.20', protocol: 'PostgreSQL Connection (5432)', isObservedAttack: false },
  { id: 'e-dc-db', source: '10.0.3.5', target: '10.0.3.20', protocol: 'Domain Admin RPC Access (135)', isObservedAttack: false },
];

export function getMitreDetails(target: TopologyNode, _source?: TopologyNode): MitreTechniqueInfo {
  if (target.category === 'gateway') {
    return {
      id: 'T1190',
      name: 'Exploit Public-Facing Application',
      tactic: 'Initial Access',
      description: 'Adversary probes and targets perimeter gateway/firewall via unauthenticated remote vulnerability.',
      mitigation: 'Upgrade gateway firmware (CVE-2023-27997), restrict admin interface to internal management network.'
    };
  }
  if (target.category === 'server' && target.zone.includes('DMZ')) {
    return {
      id: 'T1190',
      name: 'Exploit Public-Facing Application',
      tactic: 'Initial Access',
      description: `Exploitation of web server vulnerability (${target.vulnerabilities[0] || 'Log4j'}) to gain remote execution.`,
      mitigation: 'Apply CVE patch, enable Web Application Firewall (WAF) inspection rules, disallow outbound JNDI/LDAP lookups.'
    };
  }
  if (target.role.includes('Domain Controller') || target.ports.includes('88')) {
    return {
      id: 'T1003.002',
      name: 'OS Credential Dumping: SAM / Zerologon',
      tactic: 'Credential Access',
      description: 'Abuse of Netlogon/Kerberos protocol to compromise Domain Controller and extract ticket-granting tokens.',
      mitigation: 'Enforce RPC signing, apply CVE-2020-1472 patch, isolate Domain Controller on restricted VLAN, monitor Event ID 4624/4672.'
    };
  }
  if (target.category === 'database' || target.ports.includes('5432')) {
    return {
      id: 'T1048',
      name: 'Exfiltration Over Alternative Protocol',
      tactic: 'Exfiltration & Impact',
      description: 'Accessing crown jewel database via extracted credentials and staging sensitive customer tables for exfiltration.',
      mitigation: 'Enforce TLS database encryption, implement data loss prevention (DLP), restrict database port 5432 strictly to App Server IP.'
    };
  }
  if (target.ports.includes('445')) {
    return {
      id: 'T1021.002',
      name: 'Remote Services: SMB/Windows Admin Shares',
      tactic: 'Lateral Movement',
      description: 'Leveraging administrative SMB shares (C$, ADMIN$) to move laterally between Windows workstations.',
      mitigation: 'Block TCP 445 at internal firewalls, deploy Local Administrator Password Solution (LAPS), monitor SMB named pipes.'
    };
  }
  if (target.ports.includes('3389')) {
    return {
      id: 'T1021.001',
      name: 'Remote Services: Remote Desktop Protocol',
      tactic: 'Lateral Movement',
      description: 'Using harvested credentials to establish interactive RDP sessions across internal workstation subnet.',
      mitigation: 'Require MFA for RDP, enforce Network Level Authentication (NLA), restrict port 3389 to admin jump hosts.'
    };
  }
  if (target.category === 'workstation') {
    return {
      id: 'T1068',
      name: 'Exploitation for Privilege Escalation',
      tactic: 'Privilege Escalation',
      description: 'Exploiting local system vulnerabilities to elevate process privileges to NT AUTHORITY\\SYSTEM.',
      mitigation: 'Deploy endpoint detection & response (EDR), enforce Microsoft Defender SmartScreen, restrict local admin rights.'
    };
  }
  return {
    id: 'T1046',
    name: 'Network Service Discovery',
    tactic: 'Discovery',
    description: 'Scanning internal subnet for open listening ports and exploitable application services.',
    mitigation: 'Internal micro-segmentation, IDS alerting on high-volume SYN scans, enforce strict subnet routing.'
  };
}

function calculatePriority(target: TopologyNode): number {
  let score = target.baseRisk;
  if (target.criticality === 'Critical') score += 50;
  if (target.criticality === 'High') score += 30;
  if (target.vulnerabilities.length > 0) score += 40;
  return Math.min(100, score);
}

function getReason(target: TopologyNode): string {
  if (target.vulnerabilities.length > 0) return `Exploitable vulnerability: ${target.vulnerabilities[0]}`;
  if (target.criticality === 'Critical' || target.criticality === 'High') return `High value target (${target.role})`;
  return `Exposed listening ports (${target.ports})`;
}

export interface CandidateEdge {
  source: string;
  target: string;
  priority: number;
  confidence: number;
  reason: string;
  techniqueId: string;
  technique: string;
  tactic: string;
  mitigation: string;
}

function computeCandidates(
  compromised: Set<string>,
  snapshotNodes: TopologyNode[],
  snapshotEdges: TopologyEdge[],
  stepIndex: number = 0
): CandidateEdge[] {
  const candidates: CandidateEdge[] = [];
  const seenTargets = new Set<string>();

  // Check outwards from all compromised nodes across snapshot edges
  for (const compId of compromised) {
    snapshotEdges.forEach(edge => {
      let targetId: string | null = null;
      let sourceId: string | null = null;

      if (edge.source === compId && !compromised.has(edge.target)) {
        sourceId = edge.source;
        targetId = edge.target;
      } else if (edge.target === compId && !compromised.has(edge.source)) {
        // Lateral movement can traverse network paths bidirectionally
        sourceId = edge.target;
        targetId = edge.source;
      }

      if (targetId && sourceId && !seenTargets.has(targetId)) {
        const targetNode = snapshotNodes.find(n => n.id === targetId);
        const sourceNode = snapshotNodes.find(n => n.id === sourceId);
        if (targetNode && sourceNode) {
          seenTargets.add(targetId);
          const mitre = getMitreDetails(targetNode, sourceNode);
          const priority = calculatePriority(targetNode);
          const confidence = Math.max(68, 96 - stepIndex * 5);
          candidates.push({
            source: sourceId,
            target: targetId,
            priority,
            confidence,
            reason: getReason(targetNode),
            techniqueId: mitre.id,
            technique: `${mitre.id}: ${mitre.name}`,
            tactic: mitre.tactic,
            mitigation: mitre.mitigation,
          });
        }
      }
    });
  }

  // Fallback: If no direct edge candidate exists, pick reachable uncompromised target by priority
  if (candidates.length === 0) {
    const uncompromised = snapshotNodes.filter(n => !compromised.has(n.id) && n.category !== 'suspicious' && n.category !== 'external');
    if (uncompromised.length > 0) {
      uncompromised.sort((a, b) => calculatePriority(b) - calculatePriority(a));
      const targetNode = uncompromised[0];
      const latestCompId = Array.from(compromised).pop();
      const sourceNode = snapshotNodes.find(n => n.id === latestCompId) || snapshotNodes.find(n => compromised.has(n.id)) || snapshotNodes[0];
      const mitre = getMitreDetails(targetNode, sourceNode);
      const priority = calculatePriority(targetNode);
      const confidence = Math.max(65, 92 - stepIndex * 6);
      candidates.push({
        source: sourceNode.id,
        target: targetNode.id,
        priority,
        confidence,
        reason: getReason(targetNode),
        techniqueId: mitre.id,
        technique: `${mitre.id}: ${mitre.name}`,
        tactic: mitre.tactic,
        mitigation: mitre.mitigation,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}

function computeProjectedPlan(
  k: number,
  initialCompromised: Set<string>,
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): ForecastStepInfo[] {
  const plan: ForecastStepInfo[] = [];
  const tempCompromised = new Set(initialCompromised);

  for (let i = 1; i <= k; i++) {
    const candidates = computeCandidates(tempCompromised, nodes, edges, i - 1);
    if (candidates.length === 0) break;
    const best = candidates[0];
    const targetNode = nodes.find(n => n.id === best.target);
    const sourceNode = nodes.find(n => n.id === best.source);

    plan.push({
      step: i,
      sourceId: best.source,
      sourceName: sourceNode?.name || best.source,
      targetId: best.target,
      targetName: targetNode?.name || best.target,
      targetIp: targetNode?.ip || best.target,
      targetRole: targetNode?.role || 'Asset',
      tactic: best.tactic,
      techniqueId: best.techniqueId,
      techniqueName: best.technique,
      confidence: best.confidence,
      riskScore: best.priority,
      timeWindow: `T+${i * 15}s`,
      reason: best.reason,
      mitigation: best.mitigation,
      status: 'projected',
    });

    tempCompromised.add(best.target);
  }

  return plan;
}

interface SimplifiedSimulatorStore {
  k: number;
  setK: (k: number) => void;
  status: 'idle' | 'running' | 'paused' | 'completed';
  currentStep: number;
  isPlaying: boolean;

  snapshotNodes: TopologyNode[];
  snapshotEdges: TopologyEdge[];
  snapshotTime: string | null;

  compromisedNodes: Set<string>;
  latestCompromisedId: string | null;
  attackChain: AttackStep[];
  candidateEdges: CandidateEdge[];
  projectedPlan: ForecastStepInfo[];

  captureSnapshot: () => void;
  start: () => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
  jumpToStep: (step: number) => void;
  toggleAutoPlay: () => void;
}

let _autoPlayInterval: any = null;

export const useSimplifiedSimulatorStore = create<SimplifiedSimulatorStore>((set, get) => {
  return {
    k: 5,
    setK: (k: number) => {
      const state = get();
      const newPlan = computeProjectedPlan(k, state.compromisedNodes, state.snapshotNodes, state.snapshotEdges);
      set({ k, projectedPlan: newPlan });
    },
    status: 'idle',
    currentStep: 0,
    isPlaying: false,

    snapshotNodes: [],
    snapshotEdges: [],
    snapshotTime: null,

    compromisedNodes: new Set<string>(),
    latestCompromisedId: null,
    attackChain: [],
    candidateEdges: [],
    projectedPlan: [],

    captureSnapshot: () => {
      const liveNodes = useLiveStore.getState().liveNodes;
      const liveEdges = useLiveStore.getState().liveEdges;

      let snapshotNodes = [...DEFAULT_ENTERPRISE_NODES];
      let snapshotEdges = [...DEFAULT_ENTERPRISE_EDGES];

      // If live store has nodes, merge and enrich with default topology
      if (liveNodes && liveNodes.length >= 3) {
        const liveEnriched: TopologyNode[] = liveNodes.map(n => {
          const type = n.type || 'server';
          let role = n.label || 'Host';
          let ports = '80, 443';
          let os = 'Linux 5.15';
          let vulns: string[] = [];
          let criticality: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
          let baseRisk = 40;

          if (type === 'suspicious') {
            role = 'External Threat Actor';
            os = 'Kali Linux';
            baseRisk = 20;
          } else if (type === 'server') {
            role = 'Enterprise Server';
            ports = '80, 443, 8080, 22';
            vulns = ['CVE-2021-44228'];
            criticality = 'High';
            baseRisk = 75;
          } else {
            role = 'Internal Endpoint';
            ports = '135, 445, 3389';
            vulns = ['CVE-2024-21412'];
            criticality = 'Medium';
            baseRisk = 50;
          }

          return {
            id: n.id || n.ip,
            ip: n.ip,
            name: n.label || n.ip,
            role,
            category: (type === 'suspicious' ? 'suspicious' : type === 'server' ? 'server' : 'workstation') as any,
            zone: type === 'suspicious' ? 'Internet' : 'Internal LAN',
            os,
            ports,
            vulnerabilities: vulns,
            criticality,
            baseRisk,
          };
        });

        // Use only live nodes
        snapshotNodes = liveEnriched;

        // Use only live edges
        const liveEdgesEnriched: TopologyEdge[] = [];
        liveEdges.forEach(le => {
          if (!liveEdgesEnriched.some(me => (me.source === le.from && me.target === le.to))) {
            liveEdgesEnriched.push({
              id: le.id || `live-${le.from}-${le.to}`,
              source: le.from,
              target: le.to,
              protocol: le.label || 'TCP',
              isObservedAttack: le.suspicious || false,
            });
          }
        });
        snapshotEdges = liveEdgesEnriched;
      }

      const initialCompromised = new Set<string>();
      let latestVictim: string | null = null;

      // Find observed initial compromise
      snapshotEdges.forEach(e => {
        if (e.isObservedAttack) {
          initialCompromised.add(e.source);
          initialCompromised.add(e.target);
          latestVictim = e.target;
        }
      });

      if (!latestVictim && snapshotNodes.length > 0) {
        const susp = snapshotNodes.find(n => n.category === 'suspicious') || snapshotNodes[0];
        initialCompromised.add(susp.id);
        latestVictim = susp.id;
      }

      const candidates = computeCandidates(initialCompromised, snapshotNodes, snapshotEdges, 0);
      const plan = computeProjectedPlan(get().k, initialCompromised, snapshotNodes, snapshotEdges);

      const sourceNode = snapshotNodes.find(n => initialCompromised.has(n.id)) || snapshotNodes[0];
      const targetNode = snapshotNodes.find(n => n.id === latestVictim) || (snapshotNodes.length > 1 ? snapshotNodes[1] : snapshotNodes[0]);
      const mitre = (targetNode && sourceNode) ? getMitreDetails(targetNode, sourceNode) : null;

      set({
        status: 'idle',
        currentStep: 0,
        snapshotNodes,
        snapshotEdges,
        snapshotTime: new Date().toLocaleTimeString(),
        compromisedNodes: initialCompromised,
        attackChain: sourceNode && targetNode && mitre ? [
          {
            step: 0,
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            techniqueId: mitre.id,
            technique: `${mitre.id}: ${mitre.name}`,
            tactic: mitre.tactic,
            priority: calculatePriority(targetNode),
            confidence: 98,
            timeWindow: 'T+0s',
            reason: getReason(targetNode),
            mitigation: mitre.mitigation,
          }
        ] : [],
        latestCompromisedId: latestVictim,
        candidateEdges: candidates,
        projectedPlan: plan,
      });
    },

    start: () => {
      const state = get();
      state.captureSnapshot();
      set({ status: 'running' });
    },

    reset: () => {
      if (_autoPlayInterval) {
        clearInterval(_autoPlayInterval);
        _autoPlayInterval = null;
      }
      const { snapshotNodes, snapshotEdges, k } = get();
      const defaultCompromised = new Set<string>();
      let latestVictim: string | null = null;
      
      snapshotEdges.forEach(e => {
        if (e.isObservedAttack) {
          defaultCompromised.add(e.source);
          defaultCompromised.add(e.target);
          latestVictim = e.target;
        }
      });

      if (!latestVictim && snapshotNodes.length > 0) {
        const susp = snapshotNodes.find(n => n.category === 'suspicious') || snapshotNodes[0];
        defaultCompromised.add(susp.id);
        latestVictim = susp.id;
      }

      const candidates = computeCandidates(defaultCompromised, snapshotNodes, snapshotEdges, 0);
      const plan = computeProjectedPlan(k, defaultCompromised, snapshotNodes, snapshotEdges);

      const sourceNode = snapshotNodes.find(n => defaultCompromised.has(n.id)) || snapshotNodes[0];
      const targetNode = snapshotNodes.find(n => n.id === latestVictim) || (snapshotNodes.length > 1 ? snapshotNodes[1] : snapshotNodes[0]);
      const mitre = (targetNode && sourceNode) ? getMitreDetails(targetNode, sourceNode) : null;

      set({
        status: 'idle',
        currentStep: 0,
        isPlaying: false,
        compromisedNodes: defaultCompromised,
        attackChain: sourceNode && targetNode && mitre ? [
          {
            step: 0,
            sourceId: sourceNode.id,
            targetId: targetNode.id,
            techniqueId: mitre.id,
            technique: `${mitre.id}: ${mitre.name}`,
            tactic: mitre.tactic,
            priority: calculatePriority(targetNode),
            confidence: 98,
            timeWindow: 'T+0s',
            reason: getReason(targetNode),
            mitigation: mitre.mitigation,
          }
        ] : [],
        latestCompromisedId: latestVictim,
        candidateEdges: candidates,
        projectedPlan: plan,
      });
    },

    nextStep: () => {
      const state = get();
      if (state.currentStep >= state.k || state.candidateEdges.length === 0) {
        if (_autoPlayInterval) {
          clearInterval(_autoPlayInterval);
          _autoPlayInterval = null;
        }
        set({ status: 'completed', isPlaying: false });
        return;
      }

      const bestCandidate = state.candidateEdges[0];
      const newCompromised = new Set(state.compromisedNodes);
      newCompromised.add(bestCandidate.target);

      const nextStepIdx = state.currentStep + 1;
      const targetNode = state.snapshotNodes.find(n => n.id === bestCandidate.target);
      const sourceNode = state.snapshotNodes.find(n => n.id === bestCandidate.source);
      const mitre = targetNode ? getMitreDetails(targetNode, sourceNode) : null;

      const newStep: AttackStep = {
        step: nextStepIdx,
        sourceId: bestCandidate.source,
        targetId: bestCandidate.target,
        techniqueId: bestCandidate.techniqueId,
        technique: bestCandidate.technique,
        tactic: bestCandidate.tactic,
        priority: bestCandidate.priority,
        confidence: bestCandidate.confidence,
        timeWindow: `T+${nextStepIdx * 15}s`,
        reason: bestCandidate.reason,
        mitigation: mitre?.mitigation || bestCandidate.mitigation,
      };

      const newChain = [...state.attackChain, newStep];
      const newCandidates = computeCandidates(newCompromised, state.snapshotNodes, state.snapshotEdges, nextStepIdx);
      const isDone = nextStepIdx >= state.k || newCandidates.length === 0;

      // Update projected plan statuses
      const updatedPlan = state.projectedPlan.map(p => {
        if (p.step < nextStepIdx) return { ...p, status: 'completed' as const };
        if (p.step === nextStepIdx) return { ...p, status: 'active' as const };
        return { ...p, status: 'projected' as const };
      });

      if (isDone && _autoPlayInterval) {
        clearInterval(_autoPlayInterval);
        _autoPlayInterval = null;
      }

      set({
        status: isDone ? 'completed' : 'running',
        isPlaying: isDone ? false : state.isPlaying,
        currentStep: nextStepIdx,
        compromisedNodes: newCompromised,
        attackChain: newChain,
        latestCompromisedId: bestCandidate.target,
        candidateEdges: newCandidates,
        projectedPlan: updatedPlan,
      });
    },

    prevStep: () => {
      const state = get();
      if (state.currentStep <= 0) return;

      if (_autoPlayInterval) {
        clearInterval(_autoPlayInterval);
        _autoPlayInterval = null;
      }

      const prevStepIdx = state.currentStep - 1;
      const newChain = state.attackChain.slice(0, prevStepIdx + 1);

      const rebuiltCompromised = new Set<string>();
      newChain.forEach(s => {
        rebuiltCompromised.add(s.sourceId);
        rebuiltCompromised.add(s.targetId);
      });

      const lastStep = newChain[newChain.length - 1];
      const latestVictim = lastStep ? lastStep.targetId : null;
      const newCandidates = computeCandidates(rebuiltCompromised, state.snapshotNodes, state.snapshotEdges, prevStepIdx);

      const updatedPlan = state.projectedPlan.map(p => {
        if (p.step < prevStepIdx) return { ...p, status: 'completed' as const };
        if (p.step === prevStepIdx) return { ...p, status: 'active' as const };
        return { ...p, status: 'projected' as const };
      });

      set({
        currentStep: prevStepIdx,
        status: 'paused',
        isPlaying: false,
        attackChain: newChain,
        compromisedNodes: rebuiltCompromised,
        latestCompromisedId: latestVictim,
        candidateEdges: newCandidates,
        projectedPlan: updatedPlan,
      });
    },

    jumpToStep: (stepNumber: number) => {
      const state = get();
      if (stepNumber < 0 || stepNumber > state.k) return;

      if (_autoPlayInterval) {
        clearInterval(_autoPlayInterval);
        _autoPlayInterval = null;
      }

      // Reset to 0 and advance iteratively to stepNumber
      get().reset();
      for (let s = 0; s < stepNumber; s++) {
        get().nextStep();
      }
    },

    toggleAutoPlay: () => {
      const state = get();
      if (state.isPlaying) {
        if (_autoPlayInterval) {
          clearInterval(_autoPlayInterval);
          _autoPlayInterval = null;
        }
        set({ isPlaying: false, status: 'paused' });
      } else {
        if (state.status === 'completed' || state.currentStep >= state.k) {
          get().reset();
        }
        set({ isPlaying: true, status: 'running' });
        _autoPlayInterval = setInterval(() => {
          const cur = get();
          if (cur.currentStep >= cur.k || cur.status === 'completed' || cur.candidateEdges.length === 0) {
            clearInterval(_autoPlayInterval);
            _autoPlayInterval = null;
            set({ isPlaying: false, status: 'completed' });
          } else {
            get().nextStep();
          }
        }, 1800);
      }
    },
  };
});
