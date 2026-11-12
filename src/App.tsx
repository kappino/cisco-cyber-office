import { useState, useEffect } from 'react';
import { GameScreen, Badge, AvatarConfig, PlayerStats, RpgSkills } from './types/game';
import { HabboOffice } from './components/HabboOffice';
import { PatchRackGame } from './components/PatchRackGame';
import { CrtTerminalGame } from './components/CrtTerminalGame';
import { UmbrellaSocGame } from './components/UmbrellaSocGame';
import { BadgeShowcase } from './components/BadgeShowcase';
import { AvatarCustomizerModal } from './components/AvatarCustomizerModal';
import { RpgSkillModal } from './components/RpgSkillModal';
import { AnimatePresence, motion } from 'framer-motion';
import { sound } from './utils/audio';

const INITIAL_AVATAR: AvatarConfig = {
  name: 'NetCadet',
  title: 'Junior NetAdmin',
  skinTone: '#ffd1b3',
  hairStyle: 'spiky',
  hairColor: '#573318',
  shirtStyle: 'cisco-polo',
  shirtColor: '#00bceb',
  pantsColor: '#1e293b',
  accessory: 'glasses',
};

const INITIAL_STATS: PlayerStats = {
  level: 1,
  xp: 0,
  xpNextLevel: 400,
  skillPoints: 2,
  skills: {
    cablingSpeed: 1,
    cliMastery: 1,
    threatHunting: 0,
    caffeineEndurance: 1,
  },
};

const INITIAL_BADGES: Badge[] = [
  {
    id: 'cable-master',
    title: 'Cavo d\'Oro (Layer 1-2)',
    subtitle: 'Structured Cabling Master',
    description: 'Hai collegato con successo tutti i patch lead tra Patch Panel e Cisco Catalyst 9300 rispettando porte Trunk e VLAN.',
    icon: '🔌',
    unlocked: false,
  },
  {
    id: 'ios-ninja',
    title: 'Cisco IOS Ninja (Layer 3)',
    subtitle: 'CLI Configuration Specialist',
    description: 'Hai ripristinato l\'interfaccia Gi0/1 e assegnato la VLAN 20 via console Cisco IOS risolvendo il network outage.',
    icon: '💻',
    unlocked: false,
  },
  {
    id: 'umbrella-shield',
    title: 'Umbrella Guardian (Layer 7)',
    subtitle: 'DNS Security Sentinel',
    description: 'Hai bloccato il malware C2 beaconing al livello DNS con Cisco Umbrella e isolato l\'host contagiato.',
    icon: '🛡️',
    unlocked: false,
  },
  {
    id: 'grandmaster',
    title: 'Cisco Elite NetAdmin',
    subtitle: 'Full-Stack Network & Cyber Hero',
    description: 'Hai completato l\'intero programma pratico di The Big Hack 2026 salvando l\'infrastruttura di NetCorp!',
    icon: '🏆',
    unlocked: false,
  },
];

export function App() {
  const [screen, setScreen] = useState<GameScreen>('office');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState<boolean>(false);

  // Avatar Configuration
  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    const saved = localStorage.getItem('cisco_avatar');
    if (saved) {
      try { return JSON.parse(saved); } catch { return INITIAL_AVATAR; }
    }
    return INITIAL_AVATAR;
  });

  // RPG Player Stats
  const [stats, setStats] = useState<PlayerStats>(() => {
    const saved = localStorage.getItem('cisco_stats');
    if (saved) {
      try { return JSON.parse(saved); } catch { return INITIAL_STATS; }
    }
    return INITIAL_STATS;
  });

  // Missions & Badges
  const [level1Done, setLevel1Done] = useState<boolean>(() => localStorage.getItem('cisco_lvl1') === 'true');
  const [level2Done, setLevel2Done] = useState<boolean>(() => localStorage.getItem('cisco_lvl2') === 'true');
  const [level3Done, setLevel3Done] = useState<boolean>(() => localStorage.getItem('cisco_lvl3') === 'true');

  const [badges, setBadges] = useState<Badge[]>(() => {
    const saved = localStorage.getItem('cisco_badges');
    if (saved) {
      try { return JSON.parse(saved); } catch { return INITIAL_BADGES; }
    }
    return INITIAL_BADGES;
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('cisco_avatar', JSON.stringify(avatar));
  }, [avatar]);

  useEffect(() => {
    localStorage.setItem('cisco_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    const allDone = level1Done && level2Done && level3Done;
    setBadges(prev => {
      const updated = prev.map(b => {
        if (b.id === 'cable-master') return { ...b, unlocked: level1Done };
        if (b.id === 'ios-ninja') return { ...b, unlocked: level2Done };
        if (b.id === 'umbrella-shield') return { ...b, unlocked: level3Done };
        if (b.id === 'grandmaster') return { ...b, unlocked: allDone };
        return b;
      });
      localStorage.setItem('cisco_badges', JSON.stringify(updated));
      return updated;
    });

    localStorage.setItem('cisco_lvl1', String(level1Done));
    localStorage.setItem('cisco_lvl2', String(level2Done));
    localStorage.setItem('cisco_lvl3', String(level3Done));
  }, [level1Done, level2Done, level3Done]);

  // XP & Level-Up Engine
  const addXp = (amount: number) => {
    setStats(prev => {
      let curXp = prev.xp + amount;
      let curLevel = prev.level;
      let nextXp = prev.xpNextLevel;
      let points = prev.skillPoints;

      // Check level up
      while (curXp >= nextXp) {
        curXp -= nextXp;
        curLevel += 1;
        nextXp = Math.round(nextXp * 1.5);
        points += 2; // 2 skill points per level
        sound.playSuccess();
      }

      return {
        ...prev,
        level: curLevel,
        xp: curXp,
        xpNextLevel: nextXp,
        skillPoints: points,
      };
    });
  };

  const handleUpgradeSkill = (skillKey: keyof RpgSkills) => {
    setStats(prev => {
      if (prev.skillPoints <= 0 || prev.skills[skillKey] >= 5) return prev;
      return {
        ...prev,
        skillPoints: prev.skillPoints - 1,
        skills: {
          ...prev.skills,
          [skillKey]: prev.skills[skillKey] + 1,
        },
      };
    });
  };

  const handleLevel1Complete = () => {
    if (!level1Done) {
      setLevel1Done(true);
      addXp(500);
    }
  };

  const handleLevel2Complete = () => {
    if (!level2Done) {
      setLevel2Done(true);
      addXp(750);
    }
  };

  const handleLevel3Complete = () => {
    if (!level3Done) {
      setLevel3Done(true);
      addXp(1000);
    }
  };

  const handleCoffeeBoost = () => {
    addXp(40);
  };

  const handleReset = () => {
    sound.playClick();
    if (window.confirm('Vuoi davvero resettare tutti i progressi, il livello e i badge del personaggio?')) {
      setLevel1Done(false);
      setLevel2Done(false);
      setLevel3Done(false);
      setStats(INITIAL_STATS);
      setAvatar(INITIAL_AVATAR);
      setBadges(INITIAL_BADGES);
      localStorage.clear();
      setScreen('office');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-0 sm:p-4 font-sans">
      <div className="w-full max-w-5xl">
        <AnimatePresence mode="wait">
          {screen === 'office' && (
            <motion.div
              key="office"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.25 }}
            >
              <HabboOffice
                avatar={avatar}
                stats={stats}
                level1Done={level1Done}
                level2Done={level2Done}
                level3Done={level3Done}
                onNavigate={(target) => setScreen(target)}
                onOpenCustomizer={() => setIsCustomizerOpen(true)}
                onOpenSkills={() => setIsSkillsOpen(true)}
                onReset={handleReset}
                onCoffeeBoost={handleCoffeeBoost}
              />
            </motion.div>
          )}

          {screen === 'rack' && (
            <motion.div
              key="rack"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <PatchRackGame
                onBack={() => setScreen('office')}
                onComplete={handleLevel1Complete}
                isCompleted={level1Done}
              />
            </motion.div>
          )}

          {screen === 'terminal' && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <CrtTerminalGame
                onBack={() => setScreen('office')}
                onComplete={handleLevel2Complete}
                isCompleted={level2Done}
              />
            </motion.div>
          )}

          {screen === 'umbrella' && (
            <motion.div
              key="umbrella"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <UmbrellaSocGame
                onBack={() => setScreen('office')}
                onComplete={handleLevel3Complete}
                isCompleted={level3Done}
              />
            </motion.div>
          )}

          {screen === 'badges' && (
            <motion.div
              key="badges"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <BadgeShowcase
                badges={badges}
                onBack={() => setScreen('office')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Avatar Customizer */}
        {isCustomizerOpen && (
          <AvatarCustomizerModal
            config={avatar}
            onSave={(newCfg) => setAvatar(newCfg)}
            onClose={() => setIsCustomizerOpen(false)}
          />
        )}

        {/* Modal: RPG Skill Tree */}
        {isSkillsOpen && (
          <RpgSkillModal
            stats={stats}
            onUpgradeSkill={handleUpgradeSkill}
            onClose={() => setIsSkillsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
