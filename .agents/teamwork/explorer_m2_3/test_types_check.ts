// Type check simulation for drawCiscoHologram
import { Entity } from '../../src/canvas/isoMath';

// Function signature under test
export declare function drawCiscoHologram(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  canvasW: number,
  frame: number,
  variant?: 'office' | 'datacenter_vault'
): void;

// Test entity registration contract
const officeEntity: Entity = {
  id: 'cisco_hologram',
  depth: 4 + 4,
  draw: (context) => drawCiscoHologram(context, 4, 4, 840, 100, 'office')
};

const datacenterEntity: Entity = {
  id: 'datacenter_hologram',
  depth: 4 + 4,
  draw: (context) => drawCiscoHologram(context, 4, 4, 840, 100, 'datacenter_vault')
};

const defaultEntity: Entity = {
  id: 'default_hologram',
  depth: 8,
  draw: (context) => drawCiscoHologram(context, 4, 4, 840, 100)
};

console.log('Office Entity:', officeEntity.id, officeEntity.depth);
console.log('Datacenter Entity:', datacenterEntity.id, datacenterEntity.depth);
console.log('Default Entity:', defaultEntity.id, defaultEntity.depth);
