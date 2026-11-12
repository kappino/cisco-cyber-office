import { GameScreen, RoomId } from '../types/game';

export interface InteractiveSpot {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  tileX: number;
  tileY: number;
  interactX: number;
  interactY: number;
  screen?: GameScreen;
  isNpc?: boolean;
  isCoffee?: boolean;
  isElevator?: boolean;
  isBot?: boolean;
  targetRoom?: RoomId;
  completed?: boolean;
}

export const getInteractiveSpots = (
  room: RoomId,
  level1Done: boolean,
  level2Done: boolean,
  level3Done: boolean,
  level4Done: boolean
): InteractiveSpot[] => {
  if (room === 'datacenter_vault') {
    return [
      {
        id: 'wireshark',
        name: 'Console Wireshark DPI',
        tag: 'LAYER 4-7 INSPECTION',
        desc: 'Deep Packet Inspection: decifra l\'esfiltrazione DNS e analizza i pacchetti TCP',
        icon: '🦈',
        tileX: 2,
        tileY: 2,
        interactX: 2.5,
        interactY: 3.2,
        screen: 'wireshark',
        completed: level4Done
      },
      {
        id: 'firepower',
        name: 'Cisco Firepower 4100',
        tag: 'NEXT-GEN FIREWALL',
        desc: 'Appliance NGFW con IPS/IDS hardware contro attacchi brute-force',
        icon: '🛡️',
        tileX: 5,
        tileY: 2,
        interactX: 5,
        interactY: 3.2
      },
      {
        id: 'san_storage',
        name: 'Cisco UCS Storage Vault',
        tag: 'FIBRE CHANNEL SAN',
        desc: 'Array di storage criptato con le istantanee di backup di NetCorp',
        icon: '💾',
        tileX: 2,
        tileY: 5,
        interactX: 2.8,
        interactY: 5.2
      },
      {
        id: 'elevator_up',
        name: 'Ascensore di Servizio (Livello 1)',
        tag: 'TRANSITO VERTICALE',
        desc: 'Ritorna al piano superiore: Ufficio Operativo con vista Vesuvio',
        icon: '🛗',
        tileX: 6,
        tileY: 1,
        interactX: 5.8,
        interactY: 1.8,
        isElevator: true,
        targetRoom: 'office'
      },
      {
        id: 'secbot',
        name: 'SecBot Sentinel AI',
        tag: 'AUTOMATION DRONE',
        desc: 'Drone di pattuglia per il monitoraggio della temperatura dell\'aria e dei rack',
        icon: '🤖',
        tileX: 1,
        tileY: 6,
        interactX: 1.8,
        interactY: 5.8,
        isBot: true
      }
    ];
  }

  // Default: Office Room (Floor 1)
  return [
    {
      id: 'rack',
      name: 'Rack 42U Catalyst 9300',
      tag: 'LAYER 1-2 HARDWARE',
      desc: 'Cablaggio fisico patch panel e porte Trunk/Access',
      icon: '🔌',
      tileX: 2,
      tileY: 2,
      interactX: 2.5,
      interactY: 3.2,
      screen: 'rack',
      completed: level1Done
    },
    {
      id: 'terminal',
      name: 'Workstation Admin CLI',
      tag: 'LAYER 3 ROUTING',
      desc: 'Console Cisco IOS: risolvi il loop e la VLAN 20',
      icon: '💻',
      tileX: 5,
      tileY: 2,
      interactX: 5,
      interactY: 3.2,
      screen: 'terminal',
      completed: level2Done
    },
    {
      id: 'umbrella',
      name: 'SOC Threat Wall',
      tag: 'LAYER 7 SECURITY',
      desc: 'Cisco Umbrella: blocca il dominio Ransomware C2',
      icon: '🛡️',
      tileX: 6,
      tileY: 4,
      interactX: 5.5,
      interactY: 4.8,
      screen: 'umbrella',
      completed: level3Done
    },
    {
      id: 'marco',
      name: 'Marco (Senior NetAdmin)',
      tag: 'MENTOR CISCO',
      desc: 'Parla con il mentor per consigli tecnici e lore',
      icon: '👨‍💻',
      tileX: 2,
      tileY: 5,
      interactX: 2.8,
      interactY: 5.2,
      isNpc: true
    },
    {
      id: 'coffee',
      name: 'Bar Napoletano & Pizza',
      tag: 'STAMINA & SPEED',
      desc: 'Prendi un espresso fumante e una fetta di pizza margherita!',
      icon: '☕',
      tileX: 1,
      tileY: 6,
      interactX: 1.8,
      interactY: 5.8,
      isCoffee: true
    },
    {
      id: 'elevator_down',
      name: 'Ascensore Datacenter (Livello -1)',
      tag: 'TRANSITO VERTICALE',
      desc: 'Prendi l\'ascensore industriale per scendere nel caveau sotterraneo dei server',
      icon: '🛗',
      tileX: 6,
      tileY: 1,
      interactX: 5.8,
      interactY: 1.8,
      isElevator: true,
      targetRoom: 'datacenter_vault'
    }
  ];
};
