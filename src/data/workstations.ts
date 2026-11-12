import { GameScreen } from '../types/game';

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
  completed?: boolean;
}

export const getInteractiveSpots = (
  level1Done: boolean,
  level2Done: boolean,
  level3Done: boolean
): InteractiveSpot[] => [
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
    id: 'trophy',
    name: 'Bacheca Certificazioni',
    tag: 'BADGE & PREMI',
    desc: 'Visualizza i badge ufficiali e il punteggio',
    icon: '🏆',
    tileX: 6,
    tileY: 1,
    interactX: 5.8,
    interactY: 1.8,
    screen: 'badges'
  }
];
