import { InteractiveSpotData } from '../EventBus';

export interface FurnitureConfig {
  id: string;
  gridX: number;
  gridY: number;
  textureKey: string;
  frame?: number;
  animKey?: string;
  originX?: number;
  originY?: number;
  isSolid?: boolean;
}

export interface NpcConfig {
  id: string;
  name: string;
  role: string;
  charKey: 'rosaria' | 'ciro' | 'marco';
  gridX: number;
  gridY: number;
  direction: 'SE' | 'SW' | 'NE' | 'NW';
  spotId: string;
}

export interface RoomThreshold {
  targetRoom: string;
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
  spawnGx: number;
  spawnGy: number;
  spawnDir: 'SE' | 'SW' | 'NE' | 'NW';
  label: string;
}

export interface RoomConfig {
  id: string;
  name: string;
  subtitle: string;
  floorTexture: string;
  hasWindow: boolean;
  windowGridY?: number;
  defaultSpawn: { gx: number; gy: number; dir: 'SE' | 'SW' | 'NE' | 'NW' };
  furniture: FurnitureConfig[];
  npcs: NpcConfig[];
  spots: InteractiveSpotData[];
  thresholds: RoomThreshold[];
  solidGrid: number[][]; // 8x8 matrix: 1 = collision, 0 = walkable
}

export const ROOM_CONFIGS: Record<string, RoomConfig> = {
  // =========================================================================
  // ROOM 1: Entrance & Panoramic Office (1F)
  // =========================================================================
  office: {
    id: 'office',
    name: 'UFFICIO OPERATIVO (1F)',
    subtitle: 'CISCO // NETWORK STUDIO',
    floorTexture: 'tile_parquet',
    hasWindow: true,
    windowGridY: 2.5,
    defaultSpawn: { gx: 3.5, gy: 4.5, dir: 'SE' },
    solidGrid: [
      [1, 1, 1, 1, 1, 1, 1, 1], // gx = 0: West wall bounds
      [1, 0, 0, 0, 0, 1, 1, 1], // gx = 1: Bar Napoletano (gy=5,6)
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 2: open aisle
      [1, 1, 0, 0, 0, 0, 1, 1], // gx = 3: mentor desk and lounge
      [1, 1, 0, 0, 0, 0, 1, 1], // gx = 4: work desk and lounge
      [1, 1, 0, 0, 0, 0, 1, 1], // gx = 5: work desk and lounge
      [1, 0, 0, 0, 0, 0, 1, 1], // gx = 6: inset foreground corner
      [1, 1, 1, 0, 0, 1, 1, 1], // gx = 7: doorway to corridor at gy=3,4
    ],
    furniture: [
      {
        id: 'coffee_bar',
        gridX: 1.0,
        gridY: 5.0,
        textureKey: 'furniture_bar_coffee_sheet',
        animKey: 'bar-coffee-steam',
        originX: 0.5,
        originY: 0.85,
        isSolid: true
      },
      {
        id: 'pizza_box',
        gridX: 1.2,
        gridY: 4.6,
        textureKey: 'furniture_pizza_box',
        originX: 0.5,
        originY: 0.85
      },
      {
        id: 'rosaria_desk',
        gridX: 3.0,
        gridY: 1.0,
        textureKey: 'furniture_desk',
        originX: 0.5,
        originY: 0.85,
        isSolid: true
      },
      {
        id: 'elevator_frame',
        gridX: 6.0,
        gridY: 0.2,
        textureKey: 'door_frame',
        originX: 0.5,
        originY: 0.85
      }
    ],
    npcs: [
      { id: 'davide', name: 'Davide (Red Team)', role: 'RED TEAM', charKey: 'ciro', gridX: 5.5, gridY: 4.2, direction: 'SW', spotId: 'davide' },
      {
        id: 'rosaria',
        name: 'Alessia (Reception)',
        role: 'MENTOR CISCO ACADEMY',
        charKey: 'rosaria',
        gridX: 2.7,
        gridY: 2.1,
        direction: 'SW',
        spotId: 'rosaria'
      }
    ],
    spots: [
      {
        id: 'coffee',
        name: 'Bar Napoletano & Pizza',
        tag: 'STAMINA & SPEED',
        desc: 'Prendi un espresso fumante e una fetta di pizza margherita!',
        icon: '☕',
        actionText: 'PRENDI ESPRESSO & PIZZA',
        tileX: 1.0,
        tileY: 5.0,
        interactX: 1.8,
        interactY: 5.0,
        isCoffee: true
      },
      {
        id: 'rosaria',
        name: 'Alessia (Reception)',
        tag: 'MENTOR CISCO',
        desc: 'Parla con la mentor per orientarti tra le missioni di rete!',
        icon: '👩‍🏫',
        actionText: 'PARLA CON ROSARIA',
        tileX: 3.5,
        tileY: 1.8,
        interactX: 3.5,
        interactY: 2.5,
        isNpc: true
      },
      {
        id: 'elevator_down',
        name: 'Ascensore Datacenter (Piano -1)',
        tag: 'TRANSITO VERTICALE',
        desc: 'Prendi l\'ascensore di servizio per scendere nel Datacenter Vault (-1F)',
        icon: '🛗',
        actionText: 'SCENDI AL DATACENTER (-1F)',
        tileX: 6.0,
        tileY: 0.5,
        interactX: 6.0,
        interactY: 1.4,
        isElevator: true,
        targetRoom: 'datacenter_vault'
      },
      {
        id: 'door_corridor',
        name: 'Porta Corridoio Operativo',
        tag: 'COLLEGAMENTO 1F',
        desc: 'Accedi all\'area operativa e al rack switch SW1',
        icon: '🚪',
        actionText: 'ENTRA NEL CORRIDOIO',
        tileX: 7.0,
        tileY: 3.5,
        interactX: 6.5,
        interactY: 3.5,
        targetRoom: 'corridor'
      }
    ],
    thresholds: [
      {
        targetRoom: 'corridor',
        minGx: 6.8,
        maxGx: 7.6,
        minGy: 2.8,
        maxGy: 4.5,
        spawnGx: 1.2,
        spawnGy: 3.5,
        spawnDir: 'SE',
        label: 'Corridoio Operativo'
      }
    ]
  },

  // =========================================================================
  // ROOM 2: Corridor / Operational Area (1F)
  // =========================================================================
  corridor: {
    id: 'corridor',
    name: 'CORRIDOIO OPERATIVO (1F)',
    subtitle: 'NETCORP CISCO ACADEMY // OPERATIONS & SWITCH RACK',
    floorTexture: 'tile_corridor',
    hasWindow: false,
    defaultSpawn: { gx: 1.2, gy: 3.5, dir: 'SE' },
    solidGrid: [
      [1, 1, 1, 0, 0, 1, 1, 1], // gx = 0: doorway back to entrance at gy=3,4
      [1, 1, 0, 0, 0, 0, 0, 1], // gx = 1: Rack SW1 (gy=1)
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 2: open aisle
      [1, 1, 0, 0, 0, 0, 0, 1], // gx = 3: Admin PC Desk (gy=1)
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 4: Ciro spot
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 5: open aisle
      [1, 0, 0, 0, 1, 1, 0, 1], // gx = 6: SOC Threat Wall & elevator
      [1, 1, 1, 1, 1, 1, 1, 1], // gx = 7: North-East wall
    ],
    furniture: [
      {
        id: 'admin_desk',
        gridX: 3.0,
        gridY: 1.0,
        textureKey: 'furniture_desk',
        originX: 0.5,
        originY: 0.85,
        isSolid: true
      },
      {
        id: 'soc_wall',
        gridX: 6.2,
        gridY: 3.5,
        textureKey: 'furniture_desk',
        originX: 0.5,
        originY: 0.85,
        isSolid: true
      },
      {
        id: 'door_back_frame',
        gridX: 0.2,
        gridY: 3.5,
        textureKey: 'door_frame_west',
        originX: 0.5,
        originY: 0.85
      },
      {
        id: 'elevator_corridor_frame',
        gridX: 6.0,
        gridY: 0.2,
        textureKey: 'door_frame',
        originX: 0.5,
        originY: 0.85
      }
    ],
    npcs: [
      {
        id: 'ciro',
        name: 'Luca (Network Mentor)',
        role: 'HELPDESK TECH',
        charKey: 'ciro',
        gridX: 4.2,
        gridY: 3.5,
        direction: 'SE',
        spotId: 'ciro'
      }
    ],
    spots: [
      {
        id: 'terminal',
        name: 'Postazione del tecnico',
        tag: 'LAYER 3 ROUTING',
        desc: 'Cavo console verso gli apparati dell\'armadio',
        icon: '💻',
        actionText: 'APRI ARMADIO E CONSOLE',
        tileX: 3.0,
        tileY: 1.0,
        interactX: 3.0,
        interactY: 2.0,
        screen: 'terminal'
      },
      {
        id: 'umbrella',
        name: 'SOC Threat Wall',
        tag: 'LAYER 7 SECURITY',
        desc: 'Cisco Umbrella: blocca il malware DNS C2',
        icon: '🛡️',
        actionText: 'APRI CISCO UMBRELLA',
        tileX: 6.2,
        tileY: 3.5,
        interactX: 5.4,
        interactY: 3.5,
        screen: 'umbrella'
      },
      {
        id: 'ciro',
        name: 'Ciro (Helpdesk)',
        tag: 'HELPDESK TECH',
        desc: 'Parla con Ciro dei problemi di connettività degli uffici!',
        icon: '👨‍🔧',
        actionText: 'PARLA CON CIRO',
        tileX: 4.2,
        tileY: 2.2,
        interactX: 4.2,
        interactY: 3.0,
        isNpc: true
      },
      {
        id: 'door_entrance',
        name: 'Porta Ufficio Ingresso',
        tag: 'COLLEGAMENTO 1F',
        desc: 'Ritorna all\'ufficio principale e vista panoramica Vesuvio',
        icon: '🚪',
        actionText: 'TORNA ALL\'INGRESSO',
        tileX: 0.2,
        tileY: 3.5,
        interactX: 1.0,
        interactY: 3.5,
        targetRoom: 'office'
      },
      {
        id: 'elevator_down',
        name: 'Ascensore Datacenter (Piano -1)',
        tag: 'TRANSITO VERTICALE',
        desc: 'Scendi al caveau dei server sotterraneo (-1F)',
        icon: '🛗',
        actionText: 'SCENDI AL DATACENTER (-1F)',
        tileX: 6.0,
        tileY: 0.5,
        interactX: 6.0,
        interactY: 1.4,
        isElevator: true,
        targetRoom: 'datacenter_vault'
      }
    ],
    thresholds: [
      {
        targetRoom: 'office',
        minGx: 0.0,
        maxGx: 0.6,
        minGy: 2.8,
        maxGy: 4.5,
        spawnGx: 6.4,
        spawnGy: 3.5,
        spawnDir: 'NW',
        label: 'Ufficio Ingresso'
      }
    ]
  },

  // =========================================================================
  // ROOM 3: Server Room / Datacenter Vault (-1F)
  // =========================================================================
  datacenter_vault: {
    id: 'datacenter_vault',
    name: 'UNDERGROUND DATACENTER (-1F)',
    subtitle: 'NETCORP CYBER VAULT // SERVER ROOM & PACKET INSPECTION',
    floorTexture: 'tile_server_solid',
    hasWindow: false,
    defaultSpawn: { gx: 5.5, gy: 1.5, dir: 'SW' },
    solidGrid: [
      [1, 1, 1, 1, 1, 1, 1, 1], // gx = 0: West vault wall
      [1, 1, 0, 0, 1, 1, 0, 1], // gx = 1: Router R1 (gy=1), SAN (gy=4,5)
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 2: cold aisle
      [1, 1, 0, 0, 0, 0, 0, 1], // gx = 3: Wireshark console (gy=1)
      [1, 1, 0, 0, 0, 0, 0, 1], // gx = 4: Firepower 4100 (gy=1)
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 5: cold aisle
      [1, 0, 0, 0, 0, 0, 0, 1], // gx = 6: elevator access (gy=1 walkable)
      [1, 1, 1, 1, 1, 1, 1, 1], // gx = 7: North-East vault wall
    ],
    furniture: [
      {
        id: 'wireshark_desk',
        gridX: 2.8,
        gridY: 1.0,
        textureKey: 'furniture_desk',
        originX: 0.5,
        originY: 0.85,
        isSolid: true
      },
      {
        id: 'elevator_vault_frame',
        gridX: 6.0,
        gridY: 0.2,
        textureKey: 'door_frame',
        originX: 0.5,
        originY: 0.85
      }
    ],
    npcs: [
      {
        id: 'marco',
        name: 'Gaia (QA/Collaudi)',
        role: 'SENIOR NETADMIN & MENTOR',
        charKey: 'marco',
        gridX: 3.2,
        gridY: 5.2,
        direction: 'NE',
        spotId: 'marco'
      }
    ],
    spots: [
      {
        id: 'wireshark',
        name: 'Console Wireshark DPI',
        tag: 'LAYER 4-7 INSPECTION',
        desc: 'Deep Packet Inspection: decifra l\'esfiltrazione DNS e analizza i pacchetti TCP',
        icon: '🦈',
        actionText: 'APRI CONSOLE WIRESHARK DPI',
        tileX: 2.8,
        tileY: 1.0,
        interactX: 2.8,
        interactY: 2.0,
        screen: 'wireshark'
      },
      {
        id: 'marco',
        name: 'Gaia (QA/Collaudi)',
        tag: 'MENTOR CISCO',
        desc: 'Parla con Marco per quiz CCNA e mitigazione incidenti',
        icon: '👨‍💻',
        actionText: 'PARLA CON MARCO',
        tileX: 3.2,
        tileY: 5.2,
        interactX: 3.2,
        interactY: 4.5,
        isNpc: true
      },
      {
        id: 'secbot',
        name: 'SecBot Sentinel AI',
        tag: 'AUTOMATION DRONE',
        desc: 'Drone di pattuglia per la telemetria termica e diagnostica SPAN',
        icon: '🤖',
        actionText: 'INTERROGA SECBOT AI',
        tileX: 1.5,
        tileY: 6.5,
        interactX: 2.2,
        interactY: 6.0,
        isBot: true
      },
      {
        id: 'elevator_up',
        name: 'Ascensore di Servizio (Livello 1)',
        tag: 'TRANSITO VERTICALE',
        desc: 'Ritorna al piano superiore: Ufficio Operativo con vista Vesuvio',
        icon: '🛗',
        actionText: 'RISALI ALL\'UFFICIO (1F)',
        tileX: 6.0,
        tileY: 0.5,
        interactX: 6.0,
        interactY: 1.4,
        isElevator: true,
        targetRoom: 'office'
      }
    ],
    thresholds: []
  }
};

// Keep proximity interactions aligned with the visible colleague positions.
for (const room of Object.values(ROOM_CONFIGS)) {
  for (const npc of room.npcs) {
    const spot = room.spots.find(s => s.id === npc.spotId);
    if (spot) {
      spot.tileX = npc.gridX; spot.tileY = npc.gridY;
      spot.interactX = npc.gridX; spot.interactY = npc.gridY;
    }
  }
}

// The reception workstation is supplied by the device layout, avoiding duplicate desks.
ROOM_CONFIGS.office.furniture = ROOM_CONFIGS.office.furniture.filter(f => f.id !== 'rosaria_desk');
