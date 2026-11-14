import { useCallback, useEffect, useRef, useState } from 'react';
import { EventBus, RoomDevice } from '../game/EventBus';
import { infraBridge, RoomTopology } from './infraBridge';

/**
 * Stato della rete della stanza corrente, letto dal lab CML.
 * - all'ingresso nella stanza chiede al backend di accenderne il lab (non bloccante);
 * - aggiorna la topologia ogni 2 s mentre il lab si avvia, ogni 5 s quando e' pronto;
 * - passa alla scena Phaser l'elenco dei dispositivi (1:1 con i nodi CML).
 */
export function useRoomNetwork(roomId: string) {
  const [topology, setTopology] = useState<RoomTopology | null>(null);
  const lastSynced = useRef<string | null>(null);

  const publish = useCallback((t: RoomTopology) => {
    setTopology(t);
    const devices: RoomDevice[] = t.devices.map((d) => {
      const wired = d.interfaces.filter((i) => i.connected);
      return {
        label: d.label,
        kind: d.kind,
        display: d.display,
        state: d.state,
        game: d.game,
        linksTotal: wired.length,
        linksUp: wired.filter((i) => i.link_state === 'STARTED').length,
      };
    });
    EventBus.emit('SET_ROOM_DEVICES', { roomId: t.room_id, devices });
  }, []);

  const refresh = useCallback(async () => {
    const t = await infraBridge.getRoomTopology(roomId);
    if (t && t.room_id === roomId) publish(t);
    return t;
  }, [roomId, publish]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    if (lastSynced.current !== roomId) {
      lastSynced.current = roomId;
      void infraBridge.syncRoomLab(roomId);
    }
    const tick = async () => {
      const t = await refresh();
      if (!alive) return;
      const ready = t?.status.phase === 'ready';
      timer = setTimeout(tick, ready ? 5000 : 2000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [roomId, refresh]);

  return { topology, refresh, publish };
}
