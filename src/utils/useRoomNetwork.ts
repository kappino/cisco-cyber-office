import { useCallback, useEffect, useRef, useState } from 'react';
import { EventBus, RoomDevice, RoomRack } from '../game/EventBus';
import { infraBridge, RoomTopology } from './infraBridge';

/**
 * Stato della rete della stanza corrente, letto dal lab CML.
 * - all'ingresso nella stanza chiede al backend di accenderne il lab (non bloccante);
 * - aggiorna la topologia ogni 2 s mentre il lab si avvia, ogni 5 s quando e' pronto;
 * - passa alla scena Phaser l'elenco dei dispositivi (1:1 con i nodi CML).
 */
export function useRoomNetwork(roomId: string) {
  const [topology, setTopology] = useState<RoomTopology | null>(null);
  const [offline, setOffline] = useState(false);
  const lastSynced = useRef<string | null>(null);

  const livePorts = useRef<Awaited<ReturnType<typeof infraBridge.getRoomPorts>>>(null);

  const publish = useCallback((t: RoomTopology) => {
    setTopology(t);
    const linkUp = (d: RoomTopology['devices'][number]) => {
      const wired = d.interfaces.filter((i) => i.connected);
      return { total: wired.length, up: wired.filter((i) => {
        const port = livePorts.current?.ports[d.label]?.[i.label];
        return typeof port === 'object' && port !== null ? port.led.startsWith('green') : i.link_state === 'STARTED';
      }).length };
    };
    // postazioni (PC, stampante): hanno una posizione nella stanza
    const devices: RoomDevice[] = t.devices.filter((d) => d.game).map((d) => {
      const l = linkUp(d);
      return { label: d.label, kind: d.kind, display: d.display, state: d.state, game: d.game, linksTotal: l.total, linksUp: l.up };
    });
    // armadi: raccolgono gli apparati montati a rack
    const racks: RoomRack[] = (t.racks || []).map((r) => {
      const inRack = t.devices.filter((d) => d.rack === r.id);
      return {
        id: r.id, label: r.label, gx: r.gx, gy: r.gy,
        devices: inRack.map((d) => d.label),
        booted: inRack.filter((d) => d.state === 'BOOTED').length,
        alert: inRack.some((d) => { const l = linkUp(d); return l.up < l.total; }),
      };
    });
    EventBus.emit('SET_ROOM_DEVICES', { roomId: t.room_id, racks, devices });
  }, []);

  const refresh = useCallback(async () => {
    const t = await infraBridge.getRoomTopology(roomId);
    if (t && t.room_id === roomId) publish(t);
    return t;
  }, [roomId, publish]);

  useEffect(() => {
    let alive = true;
    livePorts.current = null;
    setTopology(null);
    setOffline(false);
    let timer: ReturnType<typeof setTimeout>;
    if (lastSynced.current !== roomId) {
      lastSynced.current = roomId;
      void infraBridge.syncRoomLab(roomId);
    }
    const tick = async () => {
      const [ports, t] = await Promise.all([infraBridge.getRoomPorts(roomId), infraBridge.getRoomTopology(roomId)]);
      if (!alive) return;
      livePorts.current = ports;
      setOffline(!t);
      if (t && t.room_id === roomId) publish(t);
      const ready = t?.status.phase === 'ready';
      timer = setTimeout(tick, ready ? 5000 : 2000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [roomId, publish]);

  return { topology, refresh, publish, offline };
}
