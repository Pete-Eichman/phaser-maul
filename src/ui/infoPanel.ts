import Phaser from 'phaser';
import { TILE_SIZE, MAP_ROWS, GAME_WIDTH, TOWER_DEFS, TowerDef, ENEMY_DEFS, WAVE_DEFS } from '@/config/gameConfig';
import { Tower } from '@/entities/Tower';
import { WaveManager } from '@/systems/WaveManager';

// Landscape default — override for portrait by passing a different infoPanelX
export const INFO_PANEL_X = 745;

// Mutable object held by GameScene; functions mutate it directly via JS reference semantics
export interface InfoPanelRefs {
  graphics: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  upgradeButton: Phaser.GameObjects.Container | null;
  sellButton: Phaser.GameObjects.Container | null;
  targetModeButton: Phaser.GameObjects.Container | null;
  towerNameText: Phaser.GameObjects.Text | null;
  convertPanelItems: Phaser.GameObjects.GameObject[];
}

type CreateButtonFn = (
  x: number, y: number, width: number, height: number,
  label: string, color: number, onClick: () => void,
) => Phaser.GameObjects.Container;

export interface TowerInfoCallbacks {
  getGold: () => number;
  onUpgrade: (tower: Tower, cost: number) => void;
  onSell: (tower: Tower, sellValue: number) => void;
  onConvert: (wall: Tower, defId: string) => void;
  onRefresh: (tower: Tower) => void;
  createButton: CreateButtonFn;
  infoPanelX: number;
}

export function clearTowerInfo(refs: InfoPanelRefs): void {
  refs.upgradeButton?.destroy();
  refs.upgradeButton = null;
  refs.sellButton?.destroy();
  refs.sellButton = null;
  refs.targetModeButton?.destroy();
  refs.targetModeButton = null;
  refs.towerNameText?.destroy();
  refs.towerNameText = null;
  for (const item of refs.convertPanelItems) item.destroy();
  refs.convertPanelItems = [];
}

export function showTowerInfo(
  scene: Phaser.Scene,
  refs: InfoPanelRefs,
  tower: Tower,
  callbacks: TowerInfoCallbacks,
): void {
  if (tower.def.id === 'wall') { showWallConvertPanel(scene, refs, tower, callbacks); return; }

  clearTowerInfo(refs);

  const uiY = MAP_ROWS * TILE_SIZE;
  const { infoPanelX } = callbacks;
  const panelCenterX = (infoPanelX + GAME_WIDTH) / 2;
  const btnX = GAME_WIDTH - 80;

  const colorHex = `#${tower.def.color.toString(16).padStart(6, '0')}`;
  refs.towerNameText = scene.add.text(panelCenterX, uiY + 58, tower.def.name, {
    fontSize: '12px',
    fontStyle: 'bold',
    fontFamily: 'Arial, sans-serif',
    color: colorHex,
  });
  refs.towerNameText.setOrigin(0.5, 0.5);
  refs.towerNameText.setDepth(52);

  if (tower.def.id !== 'poison' && tower.def.id !== 'wall') {
    const modeLabel = tower.targetMode.charAt(0).toUpperCase() + tower.targetMode.slice(1);
    refs.targetModeButton = callbacks.createButton(
      btnX, uiY + 75, 130, 20,
      `Target: ${modeLabel}`,
      0x1a1a3a,
      () => {
        tower.cycleTargetMode();
        callbacks.onRefresh(tower);
      },
    );
  }

  if (tower.canUpgrade()) {
    const cost = tower.getUpgradeCost();
    refs.upgradeButton = callbacks.createButton(
      btnX, uiY + 98, 130, 24,
      `Upgrade (${cost}g)`,
      callbacks.getGold() >= cost ? 0x2196f3 : 0x555555,
      () => {
        if (callbacks.getGold() >= cost) {
          callbacks.onUpgrade(tower, cost);
        }
      },
    );
  }

  const sellValue = Math.floor(tower.def.cost * 0.6);
  refs.sellButton = callbacks.createButton(
    btnX, uiY + 120, 130, 20,
    `Sell (${sellValue}g)`,
    0x666666,
    () => callbacks.onSell(tower, sellValue),
  );
}

export function showWallConvertPanel(
  scene: Phaser.Scene,
  refs: InfoPanelRefs,
  wall: Tower,
  callbacks: TowerInfoCallbacks,
): void {
  clearTowerInfo(refs);

  const uiY = MAP_ROWS * TILE_SIZE;
  const { infoPanelX } = callbacks;
  const panelCenterX = (infoPanelX + GAME_WIDTH) / 2;
  const leftColX = infoPanelX + 52;
  const rightColX = infoPanelX + 157;
  const btnW = 94;
  const btnH = 14;
  const rowYs = [uiY + 82, uiY + 97, uiY + 112, uiY + 127];

  const colorHex = `#${wall.def.color.toString(16).padStart(6, '0')}`;
  refs.towerNameText = scene.add.text(panelCenterX, uiY + 60, 'WALL', {
    fontSize: '12px',
    fontStyle: 'bold',
    fontFamily: 'Arial, sans-serif',
    color: colorHex,
  }).setOrigin(0.5).setDepth(52);

  const convertLabel = scene.add.text(panelCenterX, uiY + 71, 'Convert to:', {
    fontSize: '11px',
    color: '#777788',
    fontFamily: 'Arial, sans-serif',
  }).setOrigin(0.5).setDepth(52);
  refs.convertPanelItems.push(convertLabel);

  const leftIds  = ['arrow',  'cannon',    'ice',    'fire'];
  const rightIds = ['sniper', 'lightning', 'poison', ''];

  leftIds.forEach((id, r) => {
    makeConvertButton(scene, refs, leftColX, rowYs[r], btnW, btnH, id, wall, callbacks);
  });
  rightIds.forEach((id, r) => {
    if (id) makeConvertButton(scene, refs, rightColX, rowYs[r], btnW, btnH, id, wall, callbacks);
  });

  const sellValue = Math.floor(wall.def.cost * 0.6);
  const sellBg = scene.add.rectangle(rightColX, rowYs[3], btnW, btnH, 0x555555);
  sellBg.setStrokeStyle(1, 0x777777);
  sellBg.setDepth(52);
  sellBg.setInteractive({ useHandCursor: true });
  refs.convertPanelItems.push(sellBg);

  const sellText = scene.add.text(rightColX, rowYs[3], `Sell ${sellValue}g`, {
    fontSize: '10px',
    color: '#cccccc',
    fontFamily: 'Arial, sans-serif',
  }).setOrigin(0.5).setDepth(52);
  refs.convertPanelItems.push(sellText);

  sellBg.on('pointerdown', () => callbacks.onSell(wall, sellValue));
  sellBg.on('pointerover', () => sellBg.setFillStyle(0x777777));
  sellBg.on('pointerout',  () => sellBg.setFillStyle(0x555555));
}

function makeConvertButton(
  scene: Phaser.Scene,
  refs: InfoPanelRefs,
  x: number, y: number, width: number, height: number,
  defId: string, wall: Tower,
  callbacks: TowerInfoCallbacks,
): void {
  const def = TOWER_DEFS[defId];
  const canAfford = callbacks.getGold() >= def.cost;
  const fillColor   = canAfford ? 0x2a2a4a : 0x1a1a2a;
  const strokeColor = canAfford ? 0x444466 : 0x222233;
  const textColor   = canAfford ? '#cccccc' : '#555566';

  const bg = scene.add.rectangle(x, y, width, height, fillColor);
  bg.setStrokeStyle(1, strokeColor);
  bg.setDepth(52);
  refs.convertPanelItems.push(bg);

  const shortName = def.name.replace(' Tower', '');
  const label = scene.add.text(x, y, `${shortName} ${def.cost}g`, {
    fontSize: '10px',
    color: textColor,
    fontFamily: 'Arial, sans-serif',
  }).setOrigin(0.5).setDepth(52);
  refs.convertPanelItems.push(label);

  if (canAfford) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => callbacks.onConvert(wall, defId));
    bg.on('pointerover', () => bg.setFillStyle(0x3a3a5a));
    bg.on('pointerout',  () => bg.setFillStyle(fillColor));
  }
}

export function showWavePreview(
  scene: Phaser.Scene,
  refs: Pick<InfoPanelRefs, 'graphics' | 'text'>,
  waveManager: WaveManager,
  infoPanelX: number,
): void {
  refs.graphics.clear();

  const nextWaveIdx = waveManager.currentWave;
  if (nextWaveIdx >= WAVE_DEFS.length) {
    refs.text.setText('');
    return;
  }

  const waveDef = WAVE_DEFS[nextWaveIdx];
  const totalEnemies = waveDef.groups.reduce((sum, g) => sum + g.count, 0);
  const uiY = MAP_ROWS * TILE_SIZE;
  const lineH = 16;
  const circleX = infoPanelX + 11;
  const firstGroupY = uiY + 56 + lineH;

  const textLines = [`Wave ${nextWaveIdx + 1}  ·  ${totalEnemies} enemies`];

  waveDef.groups.forEach((group, i) => {
    const enemyDef = ENEMY_DEFS[group.enemyType];
    if (!enemyDef) return;
    const circleY = firstGroupY + i * lineH + Math.floor(lineH / 2) - 2;
    refs.graphics.fillStyle(enemyDef.color, 1);
    refs.graphics.fillCircle(circleX, circleY, 4);
    textLines.push(`      ×${group.count}  ${enemyDef.name}`);
  });

  refs.text.setText(textLines.join('\n'));
}

export function clearInfoPanel(
  refs: Pick<InfoPanelRefs, 'graphics' | 'text'>,
  waveManager: WaveManager,
  scene: Phaser.Scene,
  infoPanelX: number,
): void {
  if (!waveManager.waveInProgress && !waveManager.allWavesComplete) {
    showWavePreview(scene, refs, waveManager, infoPanelX);
  } else {
    refs.text.setText('');
    refs.graphics.clear();
  }
}

// Kept for tower button hover — GameScene calls this when hovering a tower button (def preview)
export function showInfoPanel(
  refs: Pick<InfoPanelRefs, 'graphics' | 'text'>,
  def: TowerDef,
): void {
  refs.graphics.clear();
  const stats = def.levels[0];
  const isPoisonAura = def.id === 'poison';

  const line2 = isPoisonAura
    ? `DOT: ${stats.damage}/s  Rate: ${stats.fireRate}/s`
    : `Dmg: ${stats.damage}  Rate: ${stats.fireRate}/s`;

  const line3 = isPoisonAura
    ? `Range: ${stats.range}`
    : `Range: ${stats.range}  DPS: ${(stats.damage * stats.fireRate).toFixed(1)}`;

  const detail = def.special ?? def.description;

  refs.text.setText(`${def.name}  ${def.cost}g\n${line2}\n${line3}\n${detail}`);
}
