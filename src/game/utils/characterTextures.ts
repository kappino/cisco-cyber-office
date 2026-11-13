import Phaser from 'phaser';

/** Illustrated characters drawn at native sprite size; same animation contract as the scene. */
export function registerCharacterTextures(scene: Phaser.Scene): void {
  const cast = [
    ['protagonist', '#438e9a', '#332e2b', '#e7b58e'],
    ['rosaria', '#b57055', '#533b31', '#eac09b'],
    ['ciro', '#6b8270', '#303b40', '#c68e69'],
    ['marco', '#536c87', '#b8b3a5', '#e2b895'],
  ];
  for (const [key, shirt, hair, skin] of cast) {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(3, 3);
    for (let row = 0; row < 4; row++) for (let frame = 0; frame < 5; frame++) {
      ctx.save(); ctx.translate(frame * 32, row * 64);
      const stride = frame ? Math.sin((frame - 1) * Math.PI / 2) * 3 : 0;
      const bob = frame % 2 ? -1 : 0;
      const back = row >= 2;
      const side = row === 0 || row === 2 ? 1 : -1;
      const round = (x:number,y:number,w:number,h:number,r:number,color:string) => {
        ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
      };
      ctx.fillStyle='rgba(15,30,35,.2)'; ctx.beginPath(); ctx.ellipse(16,54,11,3,0,0,Math.PI*2);ctx.fill();
      round(9,37,6,15+stride,2,'#39434a'); round(18,37,6,15-stride,2,'#455159');
      round(8,49+stride,8,5,2,'#243139'); round(17,49-stride,9,5,2,'#243139');
      round(6,23+bob,20,18,5,shirt);
      round(3,26+bob-stride/2,5,14,2,shirt); round(24,26+bob+stride/2,5,14,2,shirt);
      round(3,37+bob-stride/2,5,5,2,skin);round(24,37+bob+stride/2,5,5,2,skin);
      round(13,20+bob,6,6,2,skin);
      round(7,5+bob,18,19,7,hair);
      if(!back) {
        round(8,10+bob,16,13,5,skin);
        round(8,6+bob,15,7,3,hair);
        ctx.fillStyle='#30393b';ctx.fillRect(12+side,15+bob,2,2);ctx.fillRect(19+side,15+bob,2,2);
        ctx.fillStyle='#b77f68';ctx.fillRect(16+side,20+bob,3,1);
        ctx.strokeStyle='#d9d5bf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,26+bob);ctx.lineTo(16,33+bob);ctx.lineTo(20,26+bob);ctx.stroke();
        round(15,32+bob,5,6,1,'#f1e9d5');
      }
      ctx.restore();
    }
    if(scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addSpriteSheet(key,canvas as unknown as HTMLImageElement,{frameWidth:96,frameHeight:192});
  }
}
