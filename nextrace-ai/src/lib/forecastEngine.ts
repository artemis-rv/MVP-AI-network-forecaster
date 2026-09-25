import type { SimEvent, ForecastSnapshot, StageProfile, SyntheticFeatureProfile } from '@/types/simulator';

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateProbabilisticForecast(
  nodes: any[],
  _edges: any[],
  k: number,
  windowSeconds: number
) {
  const allEvents: SimEvent[] = [];
  const allForecasts: ForecastSnapshot[] = [];
  const stageProfiles: StageProfile[] = [];
  const stageSequence: string[] = [];
  
  if (nodes.length === 0) {
    return { allEvents, allForecasts, stageProfiles, stageSequence };
  }

  // Base timestamp for simulation
  const baseTs = Math.floor(Date.now() / 1000);

  // States dictionary instead of MITRE attack chain
  const possibleBehaviors = [
    { name: 'Initial Probe', risk: 30, protocol: 'TCP SYN', technique: 'T1595.001' },
    { name: 'Service Enumeration', risk: 45, protocol: 'TCP SCAN', technique: 'T1046' },
    { name: 'Anomalous Auth Attempt', risk: 65, protocol: 'SSH/RDP', technique: 'T1110' },
    { name: 'Privilege Escalation', risk: 80, protocol: 'RPC/SMB', technique: 'T1068' },
    { name: 'Internal Pivot', risk: 85, protocol: 'SMB', technique: 'T1021.002' },
    { name: 'Data Staging', risk: 90, protocol: 'HTTPS', technique: 'T1074' },
    { name: 'Exfiltration', risk: 98, protocol: 'TCP Encrypted', technique: 'T1048' },
  ];

  let currentSource = nodes.find(n => n.type === 'external' || n.type === 'suspicious') || nodes[0];
  let currentTarget = nodes.find(n => n.type === 'server' || n.type === 'gateway') || nodes[Math.min(1, nodes.length - 1)];

  // Insert CURRENT STATE as step 0
  stageSequence.push('CURRENT STATE');
  allEvents.push({
    step: 0,
    stage: 'CURRENT STATE',
    timestamp: baseTs,
    source: currentSource.ip,
    destination: currentTarget.ip,
    source_label: currentSource.label || currentSource.type,
    destination_label: currentTarget.label || currentTarget.type,
    protocol: 'Baseline',
    source_port: 0,
    destination_port: 0,
    packet_count: 0,
    byte_count: 0,
    connection_count: 0,
    synthetic_feature_profile: {
      window_index: 0, window_start: baseTs, window_end: baseTs + windowSeconds,
      packet_count: 0, byte_count: 0, flow_count: 0, unique_src_ips: 1, unique_dst_ips: 1,
      unique_dst_ports: 1, tcp_count: 0, udp_count: 0, icmp_count: 0, mean_packet_size: 0, connection_rate: 0, suspicious_ratio: 0
    },
    disclaimer: 'SIMULATION ONLY / SYNTHETIC DATA',
  });

  allForecasts.push({
    step: 0,
    current_stage: 'CURRENT STATE',
    predicted_next_stage: possibleBehaviors[0].name,
    confidence: 100,
    supporting_features: ['Captured live network snapshot'],
    time_window: 'T+0s',
    target_entity: currentTarget.ip,
  });

  stageProfiles.push({
    step: 0, name: 'CURRENT STATE', description: 'Snapshot of live network state before forecasting.',
    feature_narrative: ['Baseline snapshot captured.'],
    packet_count: 0, byte_count: 0, connection_count: 0, unique_dst_ports: 0, connection_rate: 0, suspicious_ratio: 0
  });

  for (let i = 1; i <= k; i++) {
    // Probabilistic behavior selection (using i - 1 for behavior index)
    const behaviorIndex = Math.min(i - 1, possibleBehaviors.length - 1);
    const behavior = possibleBehaviors[behaviorIndex];

    // Pick next target probabilistically
    if (i > 1) {
      currentSource = currentTarget;
      // Prefer internal or server nodes for lateral movement
      const possibleTargets = nodes.filter(n => n.id !== currentSource.id && (n.type === 'internal' || n.type === 'server' || n.type === 'database'));
      if (possibleTargets.length > 0) {
        currentTarget = possibleTargets[getRandomInt(0, possibleTargets.length - 1)];
      } else {
        currentTarget = nodes[getRandomInt(0, nodes.length - 1)];
      }
    }

    stageSequence.push(behavior.name);

    const ts = baseTs + i * windowSeconds;

    const featureProfile: SyntheticFeatureProfile = {
      window_index: i,
      window_start: ts,
      window_end: ts + windowSeconds,
      packet_count: getRandomInt(100, 5000),
      byte_count: getRandomInt(5000, 500000),
      flow_count: getRandomInt(5, 50),
      unique_src_ips: 1,
      unique_dst_ips: 1,
      unique_dst_ports: getRandomInt(1, 10),
      tcp_count: getRandomInt(50, 4500),
      udp_count: getRandomInt(0, 500),
      icmp_count: 0,
      mean_packet_size: getRandomInt(64, 1500),
      connection_rate: getRandomInt(1, 100),
      suspicious_ratio: behavior.risk / 100,
    };

    allEvents.push({
      step: i,
      stage: behavior.name,
      timestamp: ts,
      source: currentSource.ip,
      destination: currentTarget.ip,
      source_label: currentSource.label || currentSource.type,
      destination_label: currentTarget.label || currentTarget.type,
      protocol: behavior.protocol,
      source_port: getRandomInt(1024, 65535),
      destination_port: [22, 80, 443, 445, 3389, 5432][getRandomInt(0, 5)],
      packet_count: featureProfile.packet_count,
      byte_count: featureProfile.byte_count,
      connection_count: featureProfile.flow_count,
      synthetic_feature_profile: featureProfile,
      disclaimer: 'SIMULATION ONLY / SYNTHETIC DATA',
    });

    const nextBehavior = i < k ? possibleBehaviors[Math.min(i, possibleBehaviors.length - 1)] : { name: 'Simulation Complete' };

    allForecasts.push({
      step: i,
      current_stage: behavior.name,
      predicted_next_stage: nextBehavior.name,
      confidence: getRandomInt(75, 95),
      supporting_features: [
        `Unusual ${behavior.protocol} traffic detected`,
        `High connection rate from ${currentSource.ip}`,
        `Targeting sensitive asset: ${currentTarget.ip}`
      ],
      time_window: `T+${i * windowSeconds}s`,
      target_entity: currentTarget.ip,
    });

    stageProfiles.push({
      step: i,
      name: behavior.name,
      description: `Predicted behavior: ${behavior.name} mapped to ${behavior.technique}`,
      feature_narrative: [
        `Observed anomalous volume of ${featureProfile.packet_count} packets`,
        `Probability/Risk computed at ${behavior.risk}% based on network model`
      ],
      packet_count: featureProfile.packet_count,
      byte_count: featureProfile.byte_count,
      connection_count: featureProfile.flow_count,
      unique_dst_ports: featureProfile.unique_dst_ports,
      connection_rate: featureProfile.connection_rate,
      suspicious_ratio: featureProfile.suspicious_ratio,
    });
  }

  return { allEvents, allForecasts, stageProfiles, stageSequence };
}
