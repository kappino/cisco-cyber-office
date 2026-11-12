import React, { useState } from 'react';
import { PacketItem } from '../types/game';
import { sound } from '../utils/audio';
import { 
  ArrowLeft, 
  ShieldAlert, 
  CheckCircle2, 
  Filter, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  AlertTriangle,
  Terminal,
  Activity,
  Radar
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
}

const PACKET_CAPTURE_DATA: PacketItem[] = [
  {
    id: 1,
    time: '0.000000',
    source: '10.0.4.15',
    destination: '198.51.100.24',
    protocol: 'TCP',
    length: 74,
    info: '49210 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM=1',
    hexData: '45 00 00 3c 1a 2b 40 00 40 06 b8 12 0a 00 04 0f c6 33 64 18 c0 3a 01 bb 00 00 00 00 a0 02 fa f0',
    decodedPayload: 'E..<.@.@....3d.:........',
    details: {
      frame: 'Frame 1: 74 bytes on wire (592 bits), 74 bytes captured on interface eth0 (Cisco Catalyst 9300 SPAN)',
      ethernet: 'Ethernet II, Src: 00:50:56:c0:00:08 (VMware), Dst: 00:0c:29:4f:8e:12 (Cisco)',
      ip: 'Internet Protocol Version 4, Src: 10.0.4.15 (Host Interno), Dst: 198.51.100.24 (External Cloud IP)',
      transport: 'Transmission Control Protocol, Src Port: 49210, Dst Port: 443, Seq: 0, Flags: [SYN]',
      application: 'TCP 3-Way Handshake Step 1 (Client initiating TLS tunnel connection)'
    }
  },
  {
    id: 2,
    time: '0.014210',
    source: '198.51.100.24',
    destination: '10.0.4.15',
    protocol: 'TCP',
    length: 74,
    info: '443 → 49210 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460',
    hexData: '45 00 00 3c 3c 4d 00 00 34 06 a5 f0 c6 33 64 18 0a 00 04 0f 01 bb c0 3a e2 19 a0 01 00 00 00 01',
    decodedPayload: 'E..<..4......3d....:....',
    details: {
      frame: 'Frame 2: 74 bytes on wire (592 bits), 74 bytes captured on interface eth0',
      ethernet: 'Ethernet II, Src: 00:0c:29:4f:8e:12 (Cisco), Dst: 00:50:56:c0:00:08 (VMware)',
      ip: 'Internet Protocol Version 4, Src: 198.51.100.24, Dst: 10.0.4.15',
      transport: 'Transmission Control Protocol, Src Port: 443, Dst Port: 49210, Seq: 0, Ack: 1, Flags: [SYN, ACK]',
      application: 'TCP 3-Way Handshake Step 2 (Server acknowledgement)'
    }
  },
  {
    id: 3,
    time: '0.014520',
    source: '10.0.4.15',
    destination: '198.51.100.24',
    protocol: 'TCP',
    length: 66,
    info: '49210 → 443 [ACK] Seq=1 Ack=1 Win=64240 Len=0',
    hexData: '45 00 00 34 1a 2c 40 00 40 06 b8 19 0a 00 04 0f c6 33 64 18 c0 3a 01 bb 00 00 00 01 e2 19 a0 02',
    decodedPayload: 'E..4.,@.@....3d.:........',
    details: {
      frame: 'Frame 3: 66 bytes on wire, connection ESTABLISHED',
      ethernet: 'Ethernet II, Src: 00:50:56:c0:00:08, Dst: 00:0c:29:4f:8e:12',
      ip: 'Internet Protocol Version 4, Src: 10.0.4.15, Dst: 198.51.100.24',
      transport: 'Transmission Control Protocol, Src Port: 49210, Dst Port: 443, Flags: [ACK]',
      application: 'TCP 3-Way Handshake Completed. Session is now active.'
    }
  },
  {
    id: 4,
    time: '0.082190',
    source: '10.0.4.15',
    destination: '198.51.100.53',
    protocol: 'DNS',
    length: 168,
    info: 'Standard query 0x3f1a TXT dGhpcy1pcy1zZWNyZXQtY2lzY28tZGF0YS5leGZpbC5uZXQ.evil-tunnel.io',
    isMalicious: true,
    hexData: '45 00 00 a8 2b 10 40 00 40 11 a7 90 0a 00 04 0f c6 33 64 35 c4 12 00 35 00 94 00 00 3f 1a 01 00 00 01 00 00 00 00 00 00 36 64 47 68 70 63 79 31 70 63 79 31 7a 5a 57 4e 79 5a 58 51 74 59 32 6c 7a 59 32 38 74 5a 47 46 30 59 53 35 6c 65 47 5a 70 62 43 35 75 5a 58 51 0b 65 76 69 6c 2d 74 75 6e 6e 65 6c 02 69 6f 00 00 10 00 01',
    decodedPayload: 'E...+..@.@...3d5...5....?...6dGhpcy1pcy1zZWNyZXQtY2lzY28tZGF0YS5leGZpbC5uZXQ.evil-tunnel.io',
    details: {
      frame: 'Frame 4: 168 bytes on wire (1344 bits), Captured anomaly on UDP Port 53',
      ethernet: 'Ethernet II, Src: 00:50:56:c0:00:08 (VMware NIC), Dst: 00:0c:29:4f:8e:12 (Cisco Switch)',
      ip: 'Internet Protocol Version 4, Src: 10.0.4.15, Dst: 198.51.100.53 (Rogue DNS Server)',
      transport: 'User Datagram Protocol, Src Port: 50194, Dst Port: 53 (DNS Service)',
      application: 'Domain Name System (Query TXT) - [CRITICAL ANOMALY: DNS TUNNELING EXFILTRATION DETECTED! Decoded string: "this-is-secret-cisco-data.exfil.net"]'
    }
  },
  {
    id: 5,
    time: '0.124800',
    source: '198.51.100.53',
    destination: '10.0.4.15',
    protocol: 'DNS',
    length: 124,
    info: 'Standard query response 0x3f1a TXT "ACK_CHUNK_01_RECEIVED"',
    isMalicious: true,
    hexData: '45 00 00 7c 5f 82 00 00 38 11 8e e1 c6 33 64 35 0a 00 04 0f 00 35 c4 12 00 68 a1 40 3f 1a 81 80 00 01 00 01 00 00 00 00 41 43 4b 5f 43 48 55 4e 4b 5f 30 31',
    decodedPayload: 'E..|.....8....3d5...5..h.@?.....ACK_CHUNK_01',
    details: {
      frame: 'Frame 5: 124 bytes on wire, C2 Command Server response',
      ethernet: 'Ethernet II, Src: 00:0c:29:4f:8e:12, Dst: 00:50:56:c0:00:08',
      ip: 'Internet Protocol Version 4, Src: 198.51.100.53, Dst: 10.0.4.15',
      transport: 'User Datagram Protocol, Src Port: 53, Dst Port: 50194',
      application: 'Domain Name System (Query response) - C2 Server confirming chunk reception'
    }
  },
  {
    id: 6,
    time: '0.245010',
    source: '10.0.4.15',
    destination: '72.163.4.185',
    protocol: 'TLSv1.3',
    length: 517,
    info: 'Client Hello, Server Name: software.cisco.com',
    hexData: '45 00 02 05 91 a3 40 00 40 06 41 ec 0a 00 04 0f 48 a3 04 b9 ef 12 01 bb 4c 11 20 01 00 00 00 00 16 03 01 01 d0 01 00 01 cc 03 03',
    decodedPayload: 'E.....@.@.A.....H.......L. .........software.cisco.com',
    details: {
      frame: 'Frame 6: 517 bytes on wire, Encrypted TLS Session Initiation',
      ethernet: 'Ethernet II, Src: 00:50:56:c0:00:08, Dst: 00:0c:29:4f:8e:12',
      ip: 'Internet Protocol Version 4, Src: 10.0.4.15, Dst: 72.163.4.185 (Official Cisco San Jose IP)',
      transport: 'Transmission Control Protocol, Src Port: 61202, Dst Port: 443',
      application: 'Transport Layer Security (TLSv1.3) Handshake: Client Hello - Legitimate Corporate Traffic'
    }
  },
  {
    id: 7,
    time: '0.312940',
    source: '10.0.4.1',
    destination: '10.0.4.15',
    protocol: 'HTTP',
    length: 210,
    info: 'GET /healthz HTTP/1.1 (200 OK - KeepAlive)',
    hexData: '45 00 00 d2 44 21 40 00 40 06 ef 10 0a 00 04 01 0a 00 04 0f 1f 90 9e 11 00 00 00 20 00 00 00 40 47 45 54 20 2f 68 65 61 6c 74 68 7a',
    decodedPayload: 'E...D!@.@.............@GET /healthz HTTP/1.1',
    details: {
      frame: 'Frame 7: 210 bytes on wire, Internal Subnet Healthcheck',
      ethernet: 'Ethernet II, Src: 00:0c:29:4f:8e:12, Dst: 00:50:56:c0:00:08',
      ip: 'Internet Protocol Version 4, Src: 10.0.4.1 (Default Gateway), Dst: 10.0.4.15',
      transport: 'Transmission Control Protocol, Src Port: 8080, Dst Port: 40465',
      application: 'Hypertext Transfer Protocol: Internal Monitoring Daemon probe'
    }
  }
];

export const WiresharkInspector: React.FC<Props> = ({
  onBack,
  onComplete,
  isCompleted
}) => {
  const [filterText, setFilterText] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('all');
  const [selectedPacketId, setSelectedPacketId] = useState<number>(1);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    frame: true,
    ethernet: true,
    ip: true,
    transport: true,
    application: true
  });
  const [isMitigated, setIsMitigated] = useState<boolean>(isCompleted);
  const [showMitigationModal, setShowMitigationModal] = useState<boolean>(false);

  const selectedPacket = PACKET_CAPTURE_DATA.find(p => p.id === selectedPacketId) || PACKET_CAPTURE_DATA[0];

  const toggleSection = (key: string) => {
    sound.playClick();
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (preset: string) => {
    sound.playClick();
    setActivePreset(preset);
    if (preset === 'all') setFilterText('');
    else if (preset === 'dns') setFilterText('dns');
    else if (preset === 'tcp') setFilterText('tcp.port == 443');
    else if (preset === 'threat') setFilterText('dns.flags.response == 0 && dns.qry.type == 16');
  };

  // Filter logic
  const filteredPackets = PACKET_CAPTURE_DATA.filter(pkt => {
    if (!filterText.trim()) return true;
    const lower = filterText.toLowerCase();
    if (lower === 'dns') return pkt.protocol === 'DNS';
    if (lower === 'tcp' || lower.includes('tcp.port')) return pkt.protocol === 'TCP' || pkt.protocol === 'TLSv1.3';
    if (lower.includes('threat') || lower.includes('tunnel') || lower.includes('response == 0')) return pkt.isMalicious;
    return pkt.protocol.toLowerCase().includes(lower) || 
           pkt.info.toLowerCase().includes(lower) || 
           pkt.source.includes(lower) || 
           pkt.destination.includes(lower);
  });

  const handleApplyAcl = () => {
    sound.playSuccess();
    setIsMitigated(true);
    setShowMitigationModal(true);
    onComplete();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111625] text-slate-200 font-mono border-0 sm:border-4 border-slate-800 rounded-none sm:rounded-2xl shadow-2xl select-none overflow-x-hidden">
      {/* Top Retro Wireshark Header */}
      <header className="bg-[#182035] border-b-2 border-slate-700/80 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playClick(); onBack(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition shadow"
            title="Torna all'Underground Datacenter"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">DATACENTER</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <Radar className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black text-white tracking-wider">WIRESHARK DPI</span>
                <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-500/50 px-1.5 py-0.2 rounded font-black">
                  CCNA L4-L7
                </span>
              </div>
              <div className="text-[9px] text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>eth0 (SPAN Cisco Catalyst 9300) — 7 Pacchetti Catturati</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status indicator & mitigation button */}
        <div className="flex items-center gap-2">
          {isMitigated ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 rounded-lg text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>TUNNEL MITIGATO (BADGE SBLOCCATO)</span>
            </div>
          ) : (
            <button
              onClick={handleApplyAcl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white rounded-lg text-xs font-black shadow-lg shadow-red-950/50 animate-pulse active:scale-95 transition"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>ISOLA TUNNEL DNS & APPLICA ACL</span>
            </button>
          )}
        </div>
      </header>

      {/* Wireshark Filter Bar */}
      <div className="bg-[#141b2d] border-b border-slate-700/60 p-2 sm:px-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-1 bg-[#0b101d] border border-cyan-500/40 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-400 shadow-inner">
          <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtro Wireshark (es. 'dns', 'tcp.port == 443', 'threat')..."
            className="w-full bg-transparent text-emerald-400 font-mono placeholder:text-slate-500 outline-none text-xs"
          />
          {filterText && (
            <button
              onClick={() => { sound.playClick(); setFilterText(''); setActivePreset('all'); }}
              className="text-slate-500 hover:text-white text-xs px-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick Filter Presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 text-[10px]">
          <button
            onClick={() => applyPreset('all')}
            className={`px-2 py-1 rounded border transition shrink-0 ${
              activePreset === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Tutti (7)
          </button>
          <button
            onClick={() => applyPreset('dns')}
            className={`px-2 py-1 rounded border transition shrink-0 ${
              activePreset === 'dns'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            DNS (Port 53)
          </button>
          <button
            onClick={() => applyPreset('tcp')}
            className={`px-2 py-1 rounded border transition shrink-0 ${
              activePreset === 'tcp'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            TCP / TLS 443
          </button>
          <button
            onClick={() => applyPreset('threat')}
            className={`px-2 py-1 rounded border transition shrink-0 flex items-center gap-1 ${
              activePreset === 'threat'
                ? 'bg-red-500/30 text-rose-300 border-red-500 font-black ring-1 ring-red-400'
                : 'bg-red-950/40 text-red-400 border-red-800/60 hover:bg-red-900/40'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Minaccia Tunnel DNS</span>
          </button>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pane 1: Packet Stream List (Wireshark Table) */}
        <div className="h-48 sm:h-56 overflow-y-auto overflow-x-auto border-b-2 border-slate-700/80 bg-[#0c101c]">
          <table className="w-full text-left text-[11px] font-mono border-collapse min-w-[620px]">
            <thead className="bg-[#161d31] text-slate-300 sticky top-0 border-b border-slate-700 select-none text-[10px]">
              <tr>
                <th className="py-1 px-2 w-12 text-center">No.</th>
                <th className="py-1 px-2 w-20">Time</th>
                <th className="py-1 px-2 w-28">Source</th>
                <th className="py-1 px-2 w-28">Destination</th>
                <th className="py-1 px-2 w-20">Protocol</th>
                <th className="py-1 px-2 w-14 text-right">Length</th>
                <th className="py-1 px-3">Info</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackets.map((pkt) => {
                const isSelected = pkt.id === selectedPacketId;
                let rowBg = 'hover:bg-slate-800/80';
                let textColor = 'text-slate-300';

                // Real Wireshark-like syntax color styling
                if (pkt.isMalicious) {
                  rowBg = isSelected ? 'bg-red-900/80' : 'bg-red-950/40 hover:bg-red-900/50';
                  textColor = 'text-rose-200';
                } else if (pkt.protocol === 'DNS') {
                  rowBg = isSelected ? 'bg-sky-900/80' : 'bg-sky-950/30 hover:bg-sky-900/40';
                  textColor = 'text-cyan-200';
                } else if (pkt.protocol === 'TCP') {
                  rowBg = isSelected ? 'bg-emerald-900/70' : 'bg-emerald-950/20 hover:bg-emerald-900/40';
                  textColor = 'text-emerald-200';
                } else if (pkt.protocol === 'TLSv1.3') {
                  rowBg = isSelected ? 'bg-purple-900/70' : 'bg-purple-950/20 hover:bg-purple-900/40';
                  textColor = 'text-purple-200';
                } else if (pkt.protocol === 'HTTP') {
                  rowBg = isSelected ? 'bg-amber-900/70' : 'bg-amber-950/20 hover:bg-amber-900/40';
                  textColor = 'text-amber-200';
                }

                return (
                  <tr
                    key={pkt.id}
                    onClick={() => { sound.playPacketSniff(); setSelectedPacketId(pkt.id); }}
                    className={`cursor-pointer transition-colors border-b border-slate-800/50 ${rowBg} ${
                      isSelected ? 'ring-1 ring-cyan-400 font-bold' : ''
                    }`}
                  >
                    <td className="py-1 px-2 text-center text-slate-500 font-bold">{pkt.id}</td>
                    <td className="py-1 px-2 text-slate-400">{pkt.time}</td>
                    <td className="py-1 px-2 truncate font-semibold">{pkt.source}</td>
                    <td className="py-1 px-2 truncate font-semibold">{pkt.destination}</td>
                    <td className="py-1 px-2">
                      <span className={`px-1 rounded text-[9.5px] font-black ${
                        pkt.isMalicious ? 'bg-red-800 text-white' : 'bg-slate-800 text-slate-200'
                      }`}>
                        {pkt.protocol}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right text-slate-400">{pkt.length}</td>
                    <td className={`py-1 px-3 truncate ${textColor}`}>
                      {pkt.isMalicious && <span className="text-red-400 font-black mr-1">[EXFIL!]</span>}
                      {pkt.info}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lower Split Pane: Details Tree & Hex Dump */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-y-auto">
          {/* Pane 2: Packet Detail Dissection Tree */}
          <div className="border-b md:border-b-0 md:border-r border-slate-700/80 bg-[#121829] p-3 text-xs overflow-y-auto max-h-72 md:max-h-full">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 pb-1 border-b border-slate-700">
              <span className="flex items-center gap-1 text-cyan-300">
                <FileText className="w-3.5 h-3.5" />
                <span>DISSEZIONE PROTOCOLLO (PACCHETTO #{selectedPacket.id})</span>
              </span>
              {selectedPacket.isMalicious && (
                <span className="text-red-400 font-black flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> ANOMALIA CYBER
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-[11px]">
              {/* Frame Level */}
              <div className="border border-slate-700/70 rounded bg-slate-900/60 overflow-hidden">
                <button
                  onClick={() => toggleSection('frame')}
                  className="w-full px-2 py-1 flex items-center gap-1.5 text-left text-slate-300 font-bold hover:bg-slate-800 transition"
                >
                  {expandedSections.frame ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  <span>{selectedPacket.details.frame}</span>
                </button>
              </div>

              {/* Ethernet Level */}
              <div className="border border-slate-700/70 rounded bg-slate-900/60 overflow-hidden">
                <button
                  onClick={() => toggleSection('ethernet')}
                  className="w-full px-2 py-1 flex items-center gap-1.5 text-left text-slate-300 font-bold hover:bg-slate-800 transition"
                >
                  {expandedSections.ethernet ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  <span>{selectedPacket.details.ethernet}</span>
                </button>
              </div>

              {/* IP Level */}
              <div className="border border-slate-700/70 rounded bg-slate-900/60 overflow-hidden">
                <button
                  onClick={() => toggleSection('ip')}
                  className="w-full px-2 py-1 flex items-center gap-1.5 text-left text-slate-300 font-bold hover:bg-slate-800 transition"
                >
                  {expandedSections.ip ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  <span>{selectedPacket.details.ip}</span>
                </button>
              </div>

              {/* Transport Level */}
              <div className="border border-slate-700/70 rounded bg-slate-900/60 overflow-hidden">
                <button
                  onClick={() => toggleSection('transport')}
                  className="w-full px-2 py-1 flex items-center gap-1.5 text-left text-slate-300 font-bold hover:bg-slate-800 transition"
                >
                  {expandedSections.transport ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  <span>{selectedPacket.details.transport}</span>
                </button>
              </div>

              {/* Application / Payload Level */}
              <div className={`border rounded overflow-hidden ${
                selectedPacket.isMalicious 
                  ? 'border-red-500/80 bg-red-950/40 text-rose-200' 
                  : 'border-slate-700/70 bg-slate-900/60 text-slate-300'
              }`}>
                <button
                  onClick={() => toggleSection('application')}
                  className="w-full px-2 py-1.5 flex items-center gap-1.5 text-left font-bold hover:bg-slate-800/60 transition"
                >
                  {expandedSections.application ? <ChevronDown className="w-3 h-3 text-amber-400" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  <span className={selectedPacket.isMalicious ? 'text-rose-300 font-black' : ''}>
                    {selectedPacket.details.application}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pane 3: Hex Dump & Raw ASCII Decoded Buffer */}
          <div className="bg-[#0b0e17] p-3 text-xs overflow-y-auto max-h-72 md:max-h-full">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1 text-emerald-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>HEX DUMP & ASCII PAYLOAD (OFFSET / BYTES)</span>
              </span>
              <span className="text-slate-500 font-mono">0000 - 003F</span>
            </div>

            {/* Authentic Hex View */}
            <div className="bg-black/60 rounded border border-slate-800 p-2 text-[10.5px] font-mono leading-relaxed overflow-x-auto">
              <div className="text-slate-500 border-b border-slate-800 pb-1 mb-1 text-[9.5px]">
                OFFSET | 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F | ASCII
              </div>
              <div className="text-slate-300 whitespace-pre-wrap break-all">
                <span className="text-cyan-400 font-bold">0000  </span>
                {selectedPacket.hexData.slice(0, 48)}
              </div>
              {selectedPacket.hexData.length > 48 && (
                <div className="text-slate-300 whitespace-pre-wrap break-all mt-1">
                  <span className="text-cyan-400 font-bold">0010  </span>
                  {selectedPacket.hexData.slice(48, 96)}
                </div>
              )}
              {selectedPacket.hexData.length > 96 && (
                <div className="text-slate-300 whitespace-pre-wrap break-all mt-1">
                  <span className="text-cyan-400 font-bold">0020  </span>
                  {selectedPacket.hexData.slice(96)}
                </div>
              )}

              {/* Decoded ASCII Column */}
              <div className="mt-3 pt-2 border-t border-slate-800">
                <div className="text-[10px] text-slate-400 mb-0.5">PAYLOAD ASCII DECODIFICATO:</div>
                <div className={`p-1.5 rounded text-[11px] font-bold break-all ${
                  selectedPacket.isMalicious 
                    ? 'bg-red-950/60 text-rose-300 border border-red-500/60' 
                    : 'bg-slate-900 text-emerald-400 border border-slate-800'
                }`}>
                  {selectedPacket.decodedPayload}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mitigation Success Modal */}
      {showMitigationModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-400 rounded-2xl max-w-lg w-full p-5 shadow-2xl animate-fade-in text-center font-mono">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white">ESFILTRAZIONE DNS BLOCCATA!</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Hai identificato il tunnel clandestino sul pacchetto #4! La query TXT conteneva dati aziendali riservati codificati in Base64 diretti a un C2 rogue.
            </p>

            <div className="my-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-left text-[11px] text-cyan-300">
              <div className="text-[9px] text-slate-500 uppercase mb-1 font-bold">REGOLA ACL CISCO CATALYST GENERATA:</div>
              <code>ip access-list extended BLOCK_DNS_EXFIL</code><br/>
              <code>deny udp host 10.0.4.15 any eq 53</code><br/>
              <code>permit ip any any</code>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-300 mb-4">
              <span>+1250 XP GUADAGNATI</span>
              <span>•</span>
              <span>BADGE "DEEP PACKET DETECTIVE" SBLOCCATO!</span>
            </div>

            <button
              onClick={() => { sound.playClick(); setShowMitigationModal(false); onBack(); }}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition active:scale-95"
            >
              TORNA AL DATACENTER
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
