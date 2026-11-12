export type GameScreen = 'office' | 'rack' | 'terminal' | 'umbrella' | 'wireshark' | 'badges';

export type RoomId = 'office' | 'datacenter_vault';

export interface Badge {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface CableConnection {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
}

export interface PatchPort {
  id: string;
  name: string;
  label: string;
  type: 'patch-panel' | 'cisco-switch';
  targetRequiredPort?: string;
  isTrunk?: boolean;
  vlan?: number;
  status: 'empty' | 'connected' | 'error';
  color?: string;
}

export interface TerminalHistoryItem {
  type: 'input' | 'output' | 'error' | 'success' | 'system';
  text: string;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  sourceIp: string;
  destinationDomain: string;
  protocol: 'DNS' | 'HTTPS' | 'TCP';
  category: 'Clean' | 'Malware C2' | 'Phishing' | 'Suspicious';
  actionTaken: 'Allowed' | 'Blocked';
  isThreat: boolean;
}

// Wireshark Deep Packet Inspection Types
export interface PacketItem {
  id: number;
  time: string;
  source: string;
  destination: string;
  protocol: 'TCP' | 'UDP' | 'DNS' | 'HTTP' | 'TLSv1.3';
  length: number;
  info: string;
  isMalicious?: boolean;
  hexData: string;
  decodedPayload: string;
  details: {
    frame: string;
    ethernet: string;
    ip: string;
    transport: string;
    application: string;
  };
}

// RPG & Avatar Customization Types
export interface AvatarConfig {
  name: string;
  title: string;
  skinTone: string;
  hairStyle: 'short' | 'spiky' | 'curly' | 'cyber';
  hairColor: string;
  shirtStyle: 'cisco-polo' | 'hoodie' | 'tech-jacket' | 'cyber-armor';
  shirtColor: string;
  pantsColor: string;
  accessory: 'none' | 'glasses' | 'cyber-visor' | 'cisco-lanyard' | 'headset';
}

export interface RpgSkills {
  cablingSpeed: number;     // Layer 1-2 bonus
  cliMastery: number;       // Layer 3 bonus
  threatHunting: number;    // Layer 7 bonus
  caffeineEndurance: number; // Walking speed
}

export interface PlayerStats {
  level: number;
  xp: number;
  xpNextLevel: number;
  skillPoints: number;
  skills: RpgSkills;
}
