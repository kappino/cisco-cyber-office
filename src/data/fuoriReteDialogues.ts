export type PortraitSpeaker = 'marco' | 'rosaria' | 'ciro' | 'secbot' | 'protagonist';
export type PortraitMood = 'neutral' | 'tense' | 'satisfied';

export interface DialogueChoice {
  label: string;
  reply: string;
  replyMood: PortraitMood;
  repDelta: number;
}

export interface DialogueNode {
  speaker: PortraitSpeaker;
  speakerName: string;
  role: string;
  mood: PortraitMood;
  text: string;
  choices?: DialogueChoice[];
}

export const getPortraitSrc = (speaker: PortraitSpeaker, mood: PortraitMood): string =>
  `/assets/portraits/${speaker}_${mood}_128.png`;

export function buildNpcDialogue(
  speakerId: 'rosaria' | 'ciro' | 'marco' | 'secbot',
  playerName: string,
  progress: { level1Done: boolean; level2Done: boolean; level3Done: boolean; level4Done: boolean }
): DialogueNode {
  const completedCount = [
    progress.level1Done,
    progress.level2Done,
    progress.level3Done,
    progress.level4Done,
  ].filter(Boolean).length;

  if (speakerId === 'rosaria') {
    if (completedCount === 4) {
      return {
        speaker: 'rosaria',
        speakerName: 'Rosaria',
        role: 'IT Mentor // Napoli',
        mood: 'satisfied',
        text: `Ottimo lavoro ${playerName}! Con il Vesuvio sullo sfondo e la rete al sicuro hai dimostrato sangue freddo da vero ingegnere.`,
      };
    }
    return {
      speaker: 'rosaria',
      speakerName: 'Rosaria',
      role: 'IT Mentor // Napoli',
      mood: 'neutral',
      text: `Benvenuto in sede, ${playerName}. Oggi la palazzina è quasi fuori rete: nel Corridoio Operativo trovi il Rack SW1 e la console CLI. Da dove preferisci iniziare?`,
      choices: [
        {
          label: 'Parto dal livello fisico (cablaggio Rack SW1)',
          reply: 'Scelta da manuale OSI: senza Layer 1 pulito non si diagnostica nulla. Vai nel Corridoio Operativo!',
          replyMood: 'satisfied',
          repDelta: 10,
        },
        {
          label: 'Vado dritto a controllare il traffico anomalo',
          reply: 'Attento a non saltare i controlli di base: se manca link fisico rischi di perdere tempo prezioso.',
          replyMood: 'tense',
          repDelta: -5,
        },
      ],
    };
  }

  if (speakerId === 'ciro') {
    if (progress.level1Done && progress.level2Done) {
      return {
        speaker: 'ciro',
        speakerName: 'Ciro',
        role: 'Helpdesk Tech',
        mood: 'satisfied',
        text: `Ué ${playerName}, i telefoni IP hanno ripreso linea! Ora resta l'allarme DNS sul SOC Wall prima di scendere giù da Marco.`,
      };
    }
    return {
      speaker: 'ciro',
      speakerName: 'Ciro',
      role: 'Helpdesk Tech',
      mood: 'tense',
      text: `Guagliò, qui al Catalyst 9300 è saltato tutto! Mezza palazzina è isolata e il centralino squilla di continuo. Come la gestiamo?`,
      choices: [
        {
          label: 'Controlliamo prima VLAN e porte trunk sul Rack SW1',
          reply: 'Perfetto! Metto in attesa gli utenti e ti lascio campo libero sul Patch Panel.',
          replyMood: 'satisfied',
          repDelta: 8,
        },
        {
          label: 'Riavviamo lo switch a freddo senza guardare i log',
          reply: 'Eh no, così perdiamo la diagnostica del loop! Meglio verificare i cavi e la CLI.',
          replyMood: 'tense',
          repDelta: -6,
        },
      ],
    };
  }

  if (speakerId === 'secbot') {
    return {
      speaker: 'secbot',
      speakerName: 'SecBot Sentinel AI',
      role: 'Datacenter Telemetry (-1F)',
      mood: progress.level4Done ? 'satisfied' : 'tense',
      text: progress.level4Done
        ? 'Telemetria nominale: corridoio freddo a 19.4°C, flusso SPAN su Gi0/48 ripulito da esfiltrazioni.'
        : 'Allerta: rilevata entropia anomala su porta SPAN Gi0/48. Avvia Wireshark DPI per isolare il pacchetto malevolo.',
      choices: [
        {
          label: 'Mostra priorità di analisi pacchetti',
          reply: 'Priorità 1: filtra traffico DNS/TLS verso IP esterni non censiti sulla console Wireshark DPI.',
          replyMood: 'satisfied',
          repDelta: 5,
        },
        {
          label: 'Silenzia allarme temporaneamente',
          reply: 'Allarme lasciato in coda audit: l\'esfiltrazione resta attiva finché non completi la DPI.',
          replyMood: 'tense',
          repDelta: -5,
        },
      ],
    };
  }

  // Marco
  if (completedCount === 4) {
    return {
      speaker: 'marco',
      speakerName: 'Marco',
      role: 'Senior NetAdmin',
      mood: 'satisfied',
      text: `Incredibile ${playerName}! Tutte e 4 le criticità risolte. La rete NetCorp regge alla grande: pronto per il debriefing finale.`,
    };
  }

  const nextHint = !progress.level1Done
    ? 'Parti dal Rack 9300 nel Corridoio Operativo (Layer 1).'
    : !progress.level2Done
      ? 'Apri la CLI Admin e riattiva Gi0/1 con no shutdown.'
      : !progress.level3Done
        ? 'Controlla il SOC Wall: Umbrella segnala un beaconing DNS!'
        : 'Esamina la console Wireshark DPI qui nel Datacenter (-1F).';

  return {
    speaker: 'marco',
    speakerName: 'Marco',
    role: 'Senior NetAdmin',
    mood: completedCount >= 2 ? 'neutral' : 'tense',
    text: `${playerName}, abbiamo un incidente su più livelli. ${nextHint}`,
    choices: [
      {
        label: 'Ricevuto, procedo con la checklist tecnica',
        reply: 'Ottimo approccio metodico. Aggiornami appena chiudi la prossima postazione!',
        replyMood: 'satisfied',
        repDelta: 8,
      },
      {
        label: 'Chiedo prima una pausa caffè al Bar Napoletano',
        reply: 'Un espresso ci sta pure per la velocità, ma non perdere di vista il blackout in corso!',
        replyMood: 'neutral',
        repDelta: 2,
      },
    ],
  };
}
