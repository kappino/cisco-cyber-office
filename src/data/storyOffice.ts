import { RoomDevice, RoomRack } from '../game/EventBus';

/** Pure presentation fixtures. These are never provisioned into CML. */
export const storyOffice: Record<string, { racks: RoomRack[]; devices: RoomDevice[] }> = {
  office: {
    racks: [],
    devices: [
      { label: 'Reception', kind: 'pc', display: 'Laptop di Alessia', state: 'BOOTED', game: { gx: 4, gy: .9 }, linksUp: 0, linksTotal: 1 },
      { label: 'Stampante', kind: 'printer', display: 'Stampante condivisa', state: 'BOOTED', game: { gx: 5.8, gy: .9 }, linksUp: 1, linksTotal: 1 },
    ],
  },
  corridor: {
    racks: [{ id: 'story-rack', label: 'Banco prove · simulato', gx: 1.3, gy: 1.3, devices: ['SW1', 'SW2'], booted: 2, alert: true }],
    devices: [{ label: 'Mentor', kind: 'pc', display: 'Banco di Luca', state: 'BOOTED', game: { gx: 4, gy: .9 }, linksUp: 1, linksTotal: 1 }],
  },
  datacenter_vault: {
    racks: [{ id: 'story-qa', label: 'Collaudo · simulato', gx: 1.3, gy: 1.3, devices: ['RTR1', 'SW-CORE'], booted: 2, alert: false }],
    devices: [{ label: 'QA', kind: 'pc', display: 'Console di Gaia', state: 'BOOTED', game: { gx: 4, gy: .9 }, linksUp: 1, linksTotal: 1 }],
  },
};
