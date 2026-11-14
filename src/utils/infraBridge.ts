export interface InfraLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  mode: 'live_cml' | 'live_ai' | 'fallback_sim';
  summary: string;
  latencyMs: number;
}

export interface InfraHealth {
  cmlOnline: boolean;
  cmlIp: string;
  cmlLabFound: boolean;
  cmlNodesActive: number;
  aiOnline: boolean;
  aiModel: string;
}

export interface MissionVerifyResult {
  missionId: string;
  title: string;
  passed: boolean;
  scorePct: number;
  osiLayer: string;
  matched: string[];
  missing: string[];
  diffLines: string[];
  source: string;
}

export interface GeneratedMissionResult {
  source: string;
  spec: {
    mission_id: string;
    mission_title: string;
    description: string;
    osi_layer: string;
    nodes: Array<{
      label: string;
      role: string;
      cml_def: string;
      ideal_config: string[];
      faulty_config: string[];
    }>;
    links: Array<{ src_node: string; dst_node: string }>;
  };
  cmlDeploy: {
    mode: string;
    lab_title?: string;
    nodes_created?: number;
    links_created?: number;
  } | null;
  latencyMs: number;
}

const DEFAULT_HEALTH: InfraHealth = {
  cmlOnline: false,
  cmlIp: '192.168.122.110',
  cmlLabFound: false,
  cmlNodesActive: 0,
  aiOnline: false,
  aiModel: 'gemma4:12b',
};

class InfraBridge {
  private logs: InfraLogEntry[] = [];
  private listeners = new Set<() => void>();

  private addLog(entry: Omit<InfraLogEntry, 'id' | 'timestamp'>) {
    const item: InfraLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    this.logs = [item, ...this.logs].slice(0, 15);
    this.listeners.forEach((cb) => cb());
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getLogs(): InfraLogEntry[] {
    return this.logs;
  }

  private async postJson<T>(
    endpoint: string,
    body: unknown,
    timeoutMs = 1500
  ): Promise<{ ok: boolean; data: T | null; latencyMs: number }> {
    const t0 = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - t0);
      if (!res.ok) return { ok: false, data: null, latencyMs };
      const data = (await res.json()) as T;
      return { ok: true, data, latencyMs };
    } catch {
      return { ok: false, data: null, latencyMs: Math.round(performance.now() - t0) };
    } finally {
      clearTimeout(timer);
    }
  }

  async getHealth(): Promise<InfraHealth> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch('/api/health', { signal: controller.signal });
      if (!res.ok) return DEFAULT_HEALTH;
      const data = await res.json();
      return {
        cmlOnline: data?.cml?.status === 'online',
        cmlIp: data?.cml?.ip ?? '192.168.122.110',
        cmlLabFound: Boolean(data?.cml?.lab_found),
        cmlNodesActive: Number(data?.cml?.nodes_active ?? 0),
        aiOnline: data?.ollama?.status === 'online',
        aiModel: data?.ollama?.model ?? 'gemma4:12b',
      };
    } catch {
      return DEFAULT_HEALTH;
    } finally {
      clearTimeout(timer);
    }
  }

  async bootstrapDemoLab(): Promise<{ mode: string; created: boolean; latencyMs: number }> {
    const res = await this.postJson<{ mode: string; created: boolean; latency_ms?: number }>(
      '/api/cml/bootstrap-demo',
      {},
      5000
    );
    const mode = res.data?.mode === 'live_cml' ? 'live_cml' : 'fallback_sim';
    const latencyMs = res.data?.latency_ms ?? res.latencyMs;
    this.addLog({
      endpoint: '/api/cml/bootstrap-demo',
      mode,
      summary: mode === 'live_cml' ? 'CML Lab FuoriRete_Office synced' : 'SIM_FALLBACK (CML unreachable)',
      latencyMs,
    });
    return { mode, created: Boolean(res.data?.created), latencyMs };
  }

  async patchCable(
    portId: string,
    cableId: string | undefined,
    connected: boolean
  ): Promise<{ mode: 'live_cml' | 'fallback_sim'; portId: string; up: boolean }> {
    const res = await this.postJson<{ mode: string; latency_ms?: number }>('/api/rack/patch', {
      port_id: portId,
      cable_id: cableId,
      connected,
    });
    const mode = res.data?.mode === 'live_cml' ? 'live_cml' : 'fallback_sim';
    this.addLog({
      endpoint: '/api/rack/patch',
      mode,
      summary: `${portId} -> ${connected ? 'UP' : 'DOWN'}`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });
    return { mode, portId, up: connected };
  }

  async execCommand(
    node: string,
    command: string
  ): Promise<{ source: 'live_cml' | 'fallback_sim'; output: string }> {
    const res = await this.postJson<{ source: string; output: string; latency_ms?: number }>(
      '/api/terminal/command',
      { node, command }
    );
    const source = res.data?.source === 'live_cml' ? 'live_cml' : 'fallback_sim';
    this.addLog({
      endpoint: '/api/terminal/command',
      mode: source,
      summary: `${node}# ${command}`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });
    return {
      source,
      output: res.data?.output ?? `[SIM] ${node}# ${command}`,
    };
  }

  async blockDomain(domain: string, action: 'block' | 'unblock' = 'block'): Promise<{ ok: boolean }> {
    const res = await this.postJson<{ ok: boolean }>('/api/soc/sinkhole', { domain, action });
    this.addLog({
      endpoint: '/api/soc/sinkhole',
      mode: res.ok ? 'live_cml' : 'fallback_sim',
      summary: `Sinkhole ${action}: ${domain}`,
      latencyMs: res.latencyMs,
    });
    return { ok: res.ok };
  }

  async askNpc(
    npcId: string,
    prompt: string
  ): Promise<{ source: 'live_ai' | 'fallback_sim'; reply: string | null }> {
    const res = await this.postJson<{ source: string; reply: string; latency_ms?: number }>(
      '/api/ai/interact',
      { mode: 'npc', npc_id: npcId, prompt },
      10000
    );
    const source = res.data?.source === 'live_ai' ? 'live_ai' : 'fallback_sim';
    this.addLog({
      endpoint: '/api/ai/interact',
      mode: source,
      summary: `NPC(${npcId})`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });
    return { source, reply: res.data?.reply ?? null };
  }

  async askMentorHint(
    minigame: string,
    context: string
  ): Promise<{ source: 'live_ai' | 'fallback_sim'; hint: string; osiLayer: string; suggestedCheck: string }> {
    const res = await this.postJson<{
      source: string;
      hint: string;
      osi_layer: string;
      suggested_check: string;
      latency_ms?: number;
    }>('/api/ai/interact', { mode: 'hint', minigame, context }, 10000);
    const source = res.data?.source === 'live_ai' ? 'live_ai' : 'fallback_sim';
    this.addLog({
      endpoint: '/api/ai/interact',
      mode: source,
      summary: `Hint(${minigame})`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });
    return {
      source,
      hint: res.data?.hint ?? 'Verifica lo stato L1/L2 delle interfacce e riprova.',
      osiLayer: res.data?.osi_layer ?? 'Layer 1-3',
      suggestedCheck: res.data?.suggested_check ?? 'show ip interface brief',
    };
  }

  async verifyMission(
    missionId: string,
    playerCommands: string[] = [],
    playerState: Record<string, unknown> = {}
  ): Promise<MissionVerifyResult> {
    const res = await this.postJson<{
      mission_id: string;
      title: string;
      passed: boolean;
      score_pct: number;
      osi_layer: string;
      matched: string[];
      missing: string[];
      diff_lines: string[];
      source: string;
    }>('/api/mission/verify', {
      mission_id: missionId,
      player_commands: playerCommands,
      player_state: playerState,
    }, 3000);

    const passed = Boolean(res.data?.passed);
    const scorePct = Number(res.data?.score_pct ?? 0);
    this.addLog({
      endpoint: '/api/mission/verify',
      mode: res.ok ? 'live_cml' : 'fallback_sim',
      summary: `netAgent Verify(${missionId}): ${scorePct}% ${passed ? 'PASS' : 'DIFF'}`,
      latencyMs: res.latencyMs,
    });

    if (!res.ok || !res.data) {
      return {
        missionId,
        title: missionId,
        passed: false,
        scorePct: 0,
        osiLayer: 'Layer 1-7',
        matched: [],
        missing: ['Backend netAgent non raggiungibile (SIM_FALLBACK)'],
        diffLines: [],
        source: 'fallback_sim',
      };
    }

    return {
      missionId: res.data.mission_id,
      title: res.data.title,
      passed: res.data.passed,
      scorePct: res.data.score_pct,
      osiLayer: res.data.osi_layer,
      matched: res.data.matched,
      missing: res.data.missing,
      diffLines: res.data.diff_lines,
      source: res.data.source,
    };
  }

  async generateMissionTopology(
    prompt: string,
    deployToCml = true
  ): Promise<GeneratedMissionResult | null> {
    const res = await this.postJson<{
      source: string;
      spec: GeneratedMissionResult['spec'];
      cml_deploy: GeneratedMissionResult['cmlDeploy'];
      latency_ms: number;
    }>('/api/mission/generate', { prompt, deploy_to_cml: deployToCml }, 65000);

    this.addLog({
      endpoint: '/api/mission/generate',
      mode: res.data?.source === 'live_ai' ? 'live_ai' : 'fallback_sim',
      summary: `Architect(${res.data?.spec?.mission_id ?? 'custom'})`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });

    if (!res.ok || !res.data) return null;
    return {
      source: res.data.source,
      spec: res.data.spec,
      cmlDeploy: res.data.cml_deploy,
      latencyMs: res.data.latency_ms,
    };
  }

  async syncRoomLab(roomId: string): Promise<void> {
    const res = await this.postJson<{ mode: string; lab_title?: string; latency_ms?: number }>(
      '/api/cml/room-sync',
      { room_id: roomId },
      8000
    );
    this.addLog({
      endpoint: '/api/cml/room-sync',
      mode: res.data?.mode === 'live_cml' ? 'live_cml' : 'fallback_sim',
      summary: `Room(${roomId}) -> ${res.data?.lab_title ?? 'SIM'}`,
      latencyMs: res.data?.latency_ms ?? res.latencyMs,
    });
  }
}

export const infraBridge = new InfraBridge();
