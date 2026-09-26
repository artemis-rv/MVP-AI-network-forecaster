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
  technique: string;
  priority: number;
  reason: string;
}

interface SimplifiedSimulatorStore {
  k: number;
  setK: (k: number) => void;
  status: 'idle' | 'running' | 'paused' | 'completed';
  currentStep: number;
  
  snapshotNodes: TopologyNode[];
  snapshotEdges: TopologyEdge[];
  snapshotTime: string | null;

  compromisedNodes: Set<string>;
  latestCompromisedId: string | null;
  attackChain: AttackStep[];
  candidateEdges: { source: string; target: string; priority: number; reason: string; technique: string }[];
  
  captureSnapshot: () => void;
  start: () => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

function dummyEnrichNode(ip: string, type: string): TopologyNode {
  let name = ip;
  let role = 'Endpoint';
  let os = 'Unknown';
  let ports = 'N/A';
  let vulnerabilities: string[] = [];
  let criticality: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let baseRisk = 10;
  let zone = 'Internal LAN';
  
  if (type === 'suspicious') {
    name = 'Threat Actor';
    role = 'Attacker';
    os = 'Kali Linux';
    zone = 'Internet';
    criticality = 'Low';
    baseRisk = 0;
  } else if (type === 'server') {
    name = 'Application Server';
    role = 'Internal Service';
    os = 'Ubuntu 22.04';
    ports = '80, 443, 8080, 22';
    vulnerabilities = ['CVE-2021-44228', 'Misconfiguration'];
    criticality = 'High';
    baseRisk = 70;
    zone = 'DMZ';
  } else if (type === 'external') {
    name = 'External Entity';
    role = 'Internet Host';
    zone = 'Internet';
  } else {
    name = 'Workstation';
    os = 'Windows 11';
    ports = '135, 445, 3389';
    vulnerabilities = ['CVE-2024-21412'];
    criticality = 'Medium';
    baseRisk = 40;
  }

  return {
    id: ip,
    ip,
    name,
    role,
    category: type as any,
    zone,
    os,
    ports,
    vulnerabilities,
    criticality,
    baseRisk
  };
}

function calculatePriority(target: TopologyNode): number {
  let score = target.baseRisk;
  if (target.criticality === 'Critical') score += 50;
  if (target.criticality === 'High') score += 30;
  if (target.vulnerabilities.length > 0) score += 40;
  return score;
}

function getTechnique(target: TopologyNode): string {
  if (target.category === 'server') return 'T1190: Exploit Public-Facing Application';
  if (target.ports.includes('445')) return 'T1021.002: SMB/Windows Admin Shares';
  if (target.ports.includes('3389')) return 'T1021.001: Remote Desktop Protocol';
  return 'T1021: Remote Services (Lateral Movement)';
}

function getReason(target: TopologyNode): string {
  if (target.vulnerabilities.length > 0) return `Exploitable vulnerability: ${target.vulnerabilities[0]}`;
  if (target.criticality === 'Critical' || target.criticality === 'High') return `High value target (${target.role})`;
  return 'Exposed service';
}

function computeCandidates(
  latestNodeId: string, 
  compromised: Set<string>,
  snapshotNodes: TopologyNode[], 
  snapshotEdges: TopologyEdge[]
): { source: string; target: string; priority: number; reason: string; technique: string }[] {
  const candidates: { source: string; target: string; priority: number; reason: string; technique: string }[] = [];
  
  snapshotEdges.forEach(edge => {
    if (edge.source === latestNodeId && !compromised.has(edge.target)) {
      const targetNode = snapshotNodes.find(n => n.id === edge.target);
      const sourceNode = snapshotNodes.find(n => n.id === edge.source);
      if (targetNode && sourceNode) {
        candidates.push({
          source: edge.source,
          target: edge.target,
          priority: calculatePriority(targetNode),
          reason: getReason(targetNode),
          technique: getTechnique(targetNode),
        });
      }
    }
  });
  
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
}


export const useSimplifiedSimulatorStore = create<SimplifiedSimulatorStore>((set, get) => ({
  k: 5,
  setK: (k) => set({ k }),
  status: 'idle',
  currentStep: 0,
  
  snapshotNodes: [],
  snapshotEdges: [],
  snapshotTime: null,

  compromisedNodes: new Set(),
  attackChain: [],
  candidateEdges: [],
  latestCompromisedId: null as string | null,
  
  captureSnapshot: () => {
    const liveNodes = useLiveStore.getState().liveNodes;
    const liveEdges = useLiveStore.getState().liveEdges;

    const snapshotNodes = liveNodes.map(n => dummyEnrichNode(n.ip, n.type));
    const snapshotEdges = liveEdges.map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      protocol: e.label || 'Unknown',
      isObservedAttack: e.suspicious
    }));

    const initialCompromised = new Set<string>();
    let latestVictim: string | null = null;
    snapshotEdges.forEach(e => {
      if (e.isObservedAttack) {
        initialCompromised.add(e.source);
        initialCompromised.add(e.target);
        latestVictim = e.target;
      }
    });
    if (!latestVictim) {
       const susp = snapshotNodes.find(n => n.category === 'suspicious');
       if (susp) {
         initialCompromised.add(susp.id);
         latestVictim = susp.id;
       }
    }

    set({
      status: 'idle',
      currentStep: 0,
      snapshotNodes,
      snapshotEdges,
      snapshotTime: new Date().toLocaleTimeString(),
      compromisedNodes: initialCompromised,
      attackChain: [],
      latestCompromisedId: latestVictim,
      candidateEdges: latestVictim ? computeCandidates(latestVictim, initialCompromised, snapshotNodes, snapshotEdges) : []
    });
  },

  start: () => {
    if (get().snapshotNodes.length === 0) {
      get().captureSnapshot();
    }
    set({ status: 'running' });
  },

  
  reset: () => {
    const { snapshotNodes, snapshotEdges } = get();
    const initialCompromised = new Set<string>();
    let latestVictim: string | null = null;
    snapshotEdges.forEach(e => {
      if (e.isObservedAttack) {
        initialCompromised.add(e.source);
        initialCompromised.add(e.target);
        latestVictim = e.target;
      }
    });
    if (!latestVictim) {
       const susp = snapshotNodes.find(n => n.category === 'suspicious');
       if (susp) {
         initialCompromised.add(susp.id);
         latestVictim = susp.id;
       }
    }

    set({
      status: 'idle',
      currentStep: 0,
      compromisedNodes: initialCompromised,
      attackChain: [],
      latestCompromisedId: latestVictim,
      candidateEdges: latestVictim ? computeCandidates(latestVictim, initialCompromised, snapshotNodes, snapshotEdges) : [],
    });
  },
  
  nextStep: () => {
    const state = get();
    if (state.currentStep >= state.k || state.candidateEdges.length === 0) {
      set({ status: 'completed' });
      return;
    }
    
    const bestCandidate = state.candidateEdges[0];
    const newCompromised = new Set(state.compromisedNodes);
    newCompromised.add(bestCandidate.target);
    
    const newStep: AttackStep = {
      step: state.currentStep + 1,
      sourceId: bestCandidate.source,
      targetId: bestCandidate.target,
      technique: bestCandidate.technique,
      priority: bestCandidate.priority,
      reason: bestCandidate.reason,
    };
    
    set({
      currentStep: state.currentStep + 1,
      compromisedNodes: newCompromised,
      attackChain: [...state.attackChain, newStep],
      latestCompromisedId: bestCandidate.target,
      candidateEdges: computeCandidates(bestCandidate.target, newCompromised, state.snapshotNodes, state.snapshotEdges),
    });
  },
  
  prevStep: () => {
     const state = get();
     if (state.currentStep <= 0) return;
     const newChain = state.attackChain.slice(0, -1);
     
     const initialCompromised = new Set<string>();
     let latestVictim: string | null = null;
     state.snapshotEdges.forEach(e => {
      if (e.isObservedAttack) {
        initialCompromised.add(e.source);
        initialCompromised.add(e.target);
        latestVictim = e.target;
      }
     });
     if (!latestVictim) {
       const susp = state.snapshotNodes.find(n => n.category === 'suspicious');
       if (susp) {
         initialCompromised.add(susp.id);
         latestVictim = susp.id;
       }
     }
     
     newChain.forEach(s => {
       initialCompromised.add(s.targetId);
       latestVictim = s.targetId;
     });
     
     set({
       currentStep: state.currentStep - 1,
       status: 'paused',
       attackChain: newChain,
       compromisedNodes: initialCompromised,
       latestCompromisedId: latestVictim,
       candidateEdges: latestVictim ? computeCandidates(latestVictim, initialCompromised, state.snapshotNodes, state.snapshotEdges) : []
     });
  }
}));
