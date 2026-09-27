import { useState, useMemo } from 'react';
import {
  Shield,
  Search,
  Layers,
  BookOpen
} from 'lucide-react';
import { useSimplifiedSimulatorStore } from '@/store/simplifiedSimulatorStore';

interface MitreMatrixTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  detection: string;
  mitigation: string;
  defaultHost?: string;
}

const MITRE_TACTICAL_COLUMNS: { tactic: string; techniques: MitreMatrixTechnique[] }[] = [
  {
    tactic: 'Initial Access',
    techniques: [
      {
        id: 'T1190',
        name: 'Exploit Public-Facing Application',
        tactic: 'Initial Access',
        description: 'Adversaries compromise internet-exposed systems like perimeter gateways, NGINX web servers, or VPN routers.',
        detection: 'Anomalous inbound HTTP request bodies (JNDI, SQLi syntax), spikes in connection rate to port 80/443.',
        mitigation: 'Implement Web Application Firewall (WAF), enforce patch management for public-facing assets.',
        defaultHost: 'Perimeter Gateway / DMZ Web Server'
      },
      {
        id: 'T1566',
        name: 'Phishing',
        tactic: 'Initial Access',
        description: 'Spearphishing attachments or malicious links targeting corporate staff workstations.',
        detection: 'Inbound email telemetry containing suspicious macro attachments or lookalike sender domains.',
        mitigation: 'Anti-phishing email filtering, user security awareness training, endpoint execution protection.',
        defaultHost: 'Corporate Workstation-HR'
      },
    ]
  },
  {
    tactic: 'Execution & PrivEsc',
    techniques: [
      {
        id: 'T1068',
        name: 'Exploitation for Privilege Escalation',
        tactic: 'Privilege Escalation',
        description: 'Adversary exploits local OS flaw to elevate privileges to SYSTEM or root authority.',
        detection: 'Unusual process token impersonation, unexpected kernel module loading, Defender SmartScreen alerts.',
        mitigation: 'Deploy Endpoint Detection and Response (EDR), enforce principle of least privilege.',
        defaultHost: 'Admin Workstation'
      },
      {
        id: 'T1059',
        name: 'Command & Scripting Interpreter',
        tactic: 'Execution',
        description: 'Execution of malicious PowerShell, Bash, or WMI commands to orchestrate internal persistence.',
        detection: 'Script block logging, base64-encoded command line arguments, unusual parent-child process pairs.',
        mitigation: 'Enable PowerShell Constrained Language Mode, restrict script execution policies.',
        defaultHost: 'App Core Server'
      }
    ]
  },
  {
    tactic: 'Discovery',
    techniques: [
      {
        id: 'T1046',
        name: 'Network Service Discovery',
        tactic: 'Discovery',
        description: 'Adversary enumerates listening TCP/UDP services on internal subnets to find lateral jump points.',
        detection: 'High volume of TCP SYN packets across sequential ports (22, 80, 445, 3389, 5432) from single host.',
        mitigation: 'Internal network micro-segmentation, zero-trust network access (ZTNA), port scan threshold alarms.',
        defaultHost: 'Internal Services LAN'
      },
      {
        id: 'T1018',
        name: 'Remote System Discovery',
        tactic: 'Discovery',
        description: 'Identifying other systems on the domain or enterprise network via NetBIOS, ping sweeps, or ARP queries.',
        detection: 'Rapid ARP or ICMP sweeps originating from a single compromised internal workstation.',
        mitigation: 'Disable NetBIOS over TCP/IP where unnecessary, alert on cross-subnet broadcast anomalies.',
        defaultHost: 'Workstation Subnet'
      }
    ]
  },
  {
    tactic: 'Lateral Movement',
    techniques: [
      {
        id: 'T1021.002',
        name: 'SMB / Windows Admin Shares',
        tactic: 'Lateral Movement',
        description: 'Adversary leverages administrative shares (C$, IPC$, ADMIN$) over port 445 to execute commands remotely.',
        detection: 'High volume of SMB Tree Connect events to admin shares from non-admin internal IPs.',
        mitigation: 'Block port 445 between workstations, deploy Microsoft LAPS, disable SMBv1 entirely.',
        defaultHost: 'Admin Workstation / Corporate LAN'
      },
      {
        id: 'T1021.001',
        name: 'Remote Desktop Protocol (RDP)',
        tactic: 'Lateral Movement',
        description: 'Interactive graphical logon across internal networks using harvested domain administrator credentials.',
        detection: 'RDP connections (port 3389) outside standard working hours or between unusual workstation pairs.',
        mitigation: 'Require MFA for RDP sessions, restrict port 3389 to dedicated jump boxes, enable NLA.',
        defaultHost: 'Admin Workstation'
      }
    ]
  },
  {
    tactic: 'Credential Access',
    techniques: [
      {
        id: 'T1003.002',
        name: 'OS Credential Dumping: Zerologon / SAM',
        tactic: 'Credential Access',
        description: 'Adversary exploits Netlogon authentication flaws (CVE-2020-1472) to compromise Domain Controller accounts.',
        detection: 'Zero-key Netlogon authentication requests followed by DC computer account password reset.',
        mitigation: 'Apply Microsoft Zerologon security update, isolate Active Directory Domain Controllers on secure VLAN.',
        defaultHost: 'Domain Controller (AD)'
      },
      {
        id: 'T1110',
        name: 'Brute Force / Password Spraying',
        tactic: 'Credential Access',
        description: 'Systematic testing of passwords against SSH, RDP, or LDAP services across multiple accounts.',
        detection: 'Repeated Event ID 4625 (Failed Logon) from a single IP targeting multiple distinct usernames.',
        mitigation: 'Account lockout thresholds, smart lockout, mandatory multi-factor authentication (MFA).',
        defaultHost: 'Identity Tier'
      }
    ]
  },
  {
    tactic: 'Exfiltration & Impact',
    techniques: [
      {
        id: 'T1048',
        name: 'Exfiltration Over Alternative Protocol',
        tactic: 'Exfiltration & Impact',
        description: 'Adversary extracts sensitive database records over encrypted channels directly to external C2 node.',
        detection: 'Abnormal outbound data transfer volumes (>100MB) from database subnet to foreign IP addresses.',
        mitigation: 'Strict egress firewall filtering, database encryption at rest, data loss prevention (DLP) proxies.',
        defaultHost: 'Production SQL Database'
      },
      {
        id: 'T1486',
        name: 'Data Encrypted for Impact (Ransomware)',
        tactic: 'Exfiltration & Impact',
        description: 'Adversary encrypts critical files and databases to disrupt business operations and extort the organization.',
        detection: 'Mass file renaming operations, sudden I/O spikes, creation of ransom note text files.',
        mitigation: 'Immutable offline backups, honeypot canary files, EDR behavior-based ransomware blockers.',
        defaultHost: 'Core File & Database Storage'
      }
    ]
  }
];

export function MitreMappingView() {
  const { attackChain, candidateEdges, projectedPlan } = useSimplifiedSimulatorStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTactic, setSelectedTactic] = useState<string>('ALL');

  // Map execution status for each technique
  const techniqueStatusMap = useMemo(() => {
    const map = new Map<string, {
      status: 'executed' | 'candidate' | 'projected' | 'monitored';
      step?: number;
      target?: string;
      confidence?: number;
    }>();

    // Check confirmed attack chain
    attackChain.forEach(step => {
      const id = step.techniqueId || step.technique.split(':')[0].trim();
      map.set(id, { status: 'executed', step: step.step, target: step.targetId, confidence: step.confidence });
    });

    // Check immediate candidate
    if (candidateEdges.length > 0) {
      const best = candidateEdges[0];
      const id = best.techniqueId || best.technique.split(':')[0].trim();
      if (!map.has(id) || map.get(id)?.status !== 'executed') {
        map.set(id, { status: 'candidate', confidence: best.confidence, target: best.target });
      }
    }

    // Check future projected plan
    projectedPlan.forEach(p => {
      const id = p.techniqueId || p.techniqueName.split(':')[0].trim();
      if (!map.has(id)) {
        map.set(id, { status: 'projected', step: p.step, target: p.targetName, confidence: p.confidence });
      }
    });

    return map;
  }, [attackChain, candidateEdges, projectedPlan]);

  // Flattened techniques list for the table
  const allTechniques = useMemo(() => {
    const list: (MitreMatrixTechnique & { statusInfo: ReturnType<typeof techniqueStatusMap.get> })[] = [];
    MITRE_TACTICAL_COLUMNS.forEach(col => {
      col.techniques.forEach(t => {
        list.push({
          ...t,
          statusInfo: techniqueStatusMap.get(t.id) || { status: 'monitored' }
        });
      });
    });
    return list;
  }, [techniqueStatusMap]);

  const filteredTechniques = useMemo(() => {
    return allTechniques.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.tactic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.mitigation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTactic = selectedTactic === 'ALL' || t.tactic === selectedTactic;
      return matchesSearch && matchesTactic;
    });
  }, [allTechniques, searchTerm, selectedTactic]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(245,158,11,0.06))',
        border: '1.5px solid rgba(239,68,68,0.2)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#dc2626', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(220,38,38,0.3)', flexShrink: 0
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                MITRE ATT&CK Matrix & Tactical Mapping
              </h2>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca',
              }}>
                ENTERPRISE MATRIX v14
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Full cross-mapping of observed adversary progression, predicted lateral jumps, and SOC mitigation playbooks.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626' }} />
            <span style={{ color: '#dc2626' }}>Executed / Compromised</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ color: '#d97706' }}>Active Prediction (Next Step)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
            <span style={{ color: '#6d28d9' }}>Projected Vector</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-default)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Monitored Substrate</span>
          </div>
        </div>
      </div>

      {/* ── Interactive ATT&CK Matrix Grid ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={15} color="var(--primary)" /> Tactical Progression Matrix
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${MITRE_TACTICAL_COLUMNS.length}, minmax(170px, 1fr))`,
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
        }}>
          {MITRE_TACTICAL_COLUMNS.map((col, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Column Header */}
              <div style={{
                background: 'var(--bg-workspace)',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--text-primary)',
                textAlign: 'center',
                letterSpacing: '-0.2px'
              }}>
                {col.tactic}
              </div>

              {/* Column Techniques */}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {col.techniques.map((tech) => {
                  const statusInfo = techniqueStatusMap.get(tech.id);
                  const isExecuted = statusInfo?.status === 'executed';
                  const isCandidate = statusInfo?.status === 'candidate';
                  const isProjected = statusInfo?.status === 'projected';

                  let border = 'var(--border-subtle)';
                  let bg = 'var(--bg-workspace)';
                  let titleColor = 'var(--text-primary)';
                  let badge = null;

                  if (isExecuted) {
                    border = '#dc2626';
                    bg = '#fef2f2';
                    titleColor = '#991b1b';
                    badge = (
                      <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#dc2626', color: 'white' }}>
                        EXECUTED
                      </span>
                    );
                  } else if (isCandidate) {
                    border = '#f59e0b';
                    bg = '#fffbeb';
                    titleColor = '#92400e';
                    badge = (
                      <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#f59e0b', color: 'white' }}>
                        NEXT TARGET
                      </span>
                    );
                  } else if (isProjected) {
                    border = '#8b5cf6';
                    bg = '#f5f3ff';
                    titleColor = '#6d28d9';
                    badge = (
                      <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#8b5cf6', color: 'white' }}>
                        PROJECTED
                      </span>
                    );
                  }

                  return (
                    <div
                      key={tech.id}
                      style={{
                        background: bg,
                        border: `1.5px solid ${border}`,
                        borderRadius: 8,
                        padding: '10px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                          {tech.id}
                        </span>
                        {badge}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: titleColor, lineHeight: 1.3 }}>
                        {tech.name}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                        Asset: {tech.defaultHost}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter Bar & Comprehensive Mapping Table ── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: '1px solid var(--border-default)',
        padding: 16,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Technique Details & Defensive Playbook Mapping
            </h3>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search technique or CVE..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                  border: '1px solid var(--border-default)', background: 'var(--bg-workspace)',
                  fontSize: 12, color: 'var(--text-primary)'
                }}
              />
            </div>

            <select
              value={selectedTactic}
              onChange={e => setSelectedTactic(e.target.value)}
              style={{
                padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--border-default)', background: 'var(--bg-workspace)',
                fontSize: 12, color: 'var(--text-primary)'
              }}
            >
              <option value="ALL">All Tactics</option>
              {MITRE_TACTICAL_COLUMNS.map(c => (
                <option key={c.tactic} value={c.tactic}>{c.tactic}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-default)', background: 'var(--bg-workspace)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>ID</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Technique & Tactic</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Target Entity</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Detection Telemetry</th>
                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>SOC Playbook Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {filteredTechniques.map((tech) => {
                const s = tech.statusInfo;
                const isExecuted = s?.status === 'executed';
                const isCandidate = s?.status === 'candidate';
                const isProjected = s?.status === 'projected';

                return (
                  <tr key={tech.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: isExecuted ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                    <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--primary)' }}>
                      {tech.id}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tech.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tech.tactic}</div>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {tech.defaultHost}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {isExecuted ? (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#fee2e2', color: '#dc2626' }}>
                          ✓ EXECUTED
                        </span>
                      ) : isCandidate ? (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#fef3c7', color: '#d97706' }}>
                          ⚡ NEXT TARGET
                        </span>
                      ) : isProjected ? (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#ede9fe', color: '#6d28d9' }}>
                          🔮 PROJECTED
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-workspace)', color: 'var(--text-muted)' }}>
                          MONITORED
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontSize: 11, maxWidth: 280, lineHeight: 1.4 }}>
                      {tech.detection}
                    </td>
                    <td style={{ padding: '12px 12px', color: '#047857', fontSize: 11, maxWidth: 300, lineHeight: 1.4, fontWeight: 600 }}>
                      {tech.mitigation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
