import Phaser from 'phaser';

export interface InteractiveSpotData {
  id: string;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  actionText: string;
  tileX: number;
  tileY: number;
  interactX: number;
  interactY: number;
  targetRoom?: string;
  isNpc?: boolean;
  isElevator?: boolean;
  isCoffee?: boolean;
  isBot?: boolean;
  screen?: string;
  completed?: boolean;
  /** Etichetta del nodo CML corrispondente (postazioni generate dal lab della stanza). */
  cmlNode?: string;
  /** Armadio di rete della stanza (contiene router, switch e server del lab). */
  cmlRack?: string;
}

/** Armadio di rete della stanza: raccoglie gli apparati montati a rack. */
export interface RoomRack {
  id: string;
  label: string;
  gx: number;
  gy: number;
  devices: string[];
  booted: number;
  alert: boolean;
}

/** Dispositivo della stanza, 1:1 con un nodo del lab CML. */
export interface RoomDevice {
  label: string;
  kind: 'router' | 'switch' | 'pc' | 'server' | 'printer' | string;
  display: string;
  state: string;
  game?: { gx: number; gy: number } | null;
  linksUp: number;
  linksTotal: number;
}

export type TimePhase = 'morning' | 'sunset' | 'night';

export interface GameEvents {
  // Phaser -> React
  'SPOT_ENTER': (spot: InteractiveSpotData) => void;
  'SPOT_LEAVE': () => void;
  'SPOT_INTERACT': (spotId: string) => void;
  'ROOM_CHANGED': (roomId: string) => void;
  'PLAYER_MOVED': (coords: { x: number; y: number; gridX: number; gridY: number }) => void;
  'SCENE_READY': (sceneKey: string) => void;

  // React -> Phaser
  'NAVIGATE_TO': (target: { tileX?: number; tileY?: number; spotId?: string }) => void;
  'SET_TIME_PHASE': (phase: TimePhase) => void;
  'CHANGE_ROOM': (roomId: string) => void;
  'TRIGGER_CELEBRATION': () => void;
  'TRIGGER_COFFEE_BOOST': () => void;
  'SET_ROOM_DEVICES': (payload: { roomId: string; racks: RoomRack[]; devices: RoomDevice[] }) => void;
  'SET_INPUT_ENABLED': (enabled: boolean) => void;
}

export const EventBus = new Phaser.Events.EventEmitter();

if (typeof window !== 'undefined') {
  (window as unknown as { __GAME_EVENT_BUS__: typeof EventBus }).__GAME_EVENT_BUS__ = EventBus;
}
