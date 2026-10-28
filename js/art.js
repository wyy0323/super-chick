/* 美术：小鸡 / 鸡蛋 / 老鹰 / 云朵全部由 Canvas 程序化绘制，不依赖任何图片资源 */
(function (global) {
  'use strict';

  const C = {
    body: '#FFD93D',
    bodyLine: 'rgba(178, 108, 0, 0.34)',
    wing: '#FFC929',
    comb: '#FF5A5F',
    beak: '#FF9F1C',
    feet: '#F29100',
    ink: '#22343F',
    cape: '#FF4D4F',
    capeLine: 'rgba(176, 20, 32, 0.35)',
    egg: '#FFFCF1',
    eggLine: '#E4D5AC',
    eggCrack: 'rgba(176, 146, 84, 0.5)',
    hawk: '#7A5545',
    hawkDark: '#5B3C30',
    hawkBeak: '#FFC145'
  };

  const FONT = '900 22px "YouYuan", "Arial Rounded MT Bold", "PingFang SC", "Microsoft YaHei", sans-serif';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 柔和投影 */
  function shadow(ctx, x, y, rx, ry, alpha) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 58, 92, ' + alpha + ')';
    ctx.fill();
  }

  /* 天空：渐变 + 阳光 + 暗角 */
  function sky(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#149FE8');
    g.addColorStop(0.52, '#3AC4F8');
    g.addColorStop(1, '#A6EBFF');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const R = Math.max(W, H) * 0.9;
    const sun = ctx.createRadialGradient(W * 0.14, -H * 0.06, 20, W * 0.14, -H * 0.06, R);
    sun.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    sun.addColorStop(0.45, 'rgba(255, 255, 255, 0.10)');
    sun.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.82);
    v.addColorStop(0, 'rgba(4, 58, 90, 0)');
    v.addColorStop(1, 'rgba(4, 58, 90, 0.22)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function puffCloud(ctx, x, y, s, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFFFFF';
    const circles = [[-42, 6, 20], [-16, -6, 27], [16, -2, 23], [44, 8, 16], [0, 13, 21]];
    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      ctx.beginPath();
      ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#D6F2FF';
    ctx.beginPath();
    ctx.ellipse(0, 23, 62, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function clouds(ctx, W, H, t) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const seed = i * 91.7;
      const span = W + 560;
      const x = ((seed * 5 + t * (10 + i * 3)) % span) - 280;
      const y = 56 + ((seed * 7.3) % Math.max(90, H * 0.6));
      const s = 0.5 + (((seed * 3.1) % 100) / 100) * 0.8;
      puffCloud(ctx, x, y, s, 0.52 - i * 0.045);
    }
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.32, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.32, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* 鸡蛋 */
  function egg(ctx, e, t) {
    const bob = Math.sin(t * 2.6 + e.phase) * 2.5;
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    ctx.rotate(Math.sin(t * 1.7 + e.phase) * 0.06);

    ctx.beginPath();
    ctx.ellipse(0, 0, 13.5, 16.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.egg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.eggLine;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-7.5, -1.5);
    ctx.lineTo(-3, 2.6);
    ctx.lineTo(1, -1.5);
    ctx.lineTo(5, 2);
    ctx.lineTo(8.5, -1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.eggCrack;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-4.6, -6.4, 3.2, 4.3, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(3.2, 5.6, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    // 一闪一闪的小星星
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.2 + e.phase));
    ctx.globalAlpha = tw;
    star(ctx, 12, -13, 4.2, '#FFFFFF');
    ctx.globalAlpha = tw * 0.7;
    star(ctx, -13, 10, 2.6, '#FFF6C9');
    ctx.restore();
  }

  /* 小鸡：o = { x, y, scale, leader, t, flip, bob } */
  function chick(ctx, o) {
    const s = o.scale || 1;
    const flip = o.flip || 1;
    const t = o.t;

    ctx.save();
    ctx.translate(o.x, o.y + (o.bob || 0));
    ctx.scale(s * flip, s);

    // 队长披风
    if (o.leader) {
      const flap = Math.sin(t * 7) * 3;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.quadraticCurveTo(-20, -12 + flap, -31, 4);
      ctx.quadraticCurveTo(-21, 8 + flap * 0.5, -6, 9);
      ctx.closePath();
      ctx.fillStyle = C.cape;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.capeLine;
      ctx.stroke();

      // 披风上的小星星徽章
      ctx.globalAlpha = 0.92;
      star(ctx, -16, 0, 3.4, '#FFE066');
      ctx.globalAlpha = 1;
    }

    // 脚
    const step = Math.sin(t * 10) * 2.2;
    ctx.strokeStyle = C.feet;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(-7 + step, 19);
    ctx.moveTo(3, 11);
    ctx.lineTo(6 - step, 19);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7 + step, 19);
    ctx.lineTo(-10.5 + step, 21.5);
    ctx.moveTo(-7 + step, 19);
    ctx.lineTo(-4 + step, 21.5);
    ctx.moveTo(6 - step, 19);
    ctx.lineTo(3 - step, 21.5);
    ctx.moveTo(6 - step, 19);
    ctx.lineTo(9.5 - step, 21.5);
    ctx.stroke();

    // 尾羽
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-22, -5);
    ctx.lineTo(-16, 5);
    ctx.closePath();
    ctx.fillStyle = C.wing;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.bodyLine;
    ctx.stroke();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 14.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.body;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.bodyLine;
    ctx.stroke();

    // 头顶高光
    ctx.beginPath();
    ctx.ellipse(-2, -6, 8, 5.4, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // 翅膀
    ctx.save();
    ctx.translate(-2, 3);
    ctx.rotate(-0.18 + Math.sin(t * 11) * 0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 5, 0.35, 0, Math.PI * 2);
    ctx.fillStyle = C.wing;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = C.bodyLine;
    ctx.stroke();
    ctx.restore();

    // 鸡冠
    ctx.fillStyle = C.comb;
    const combBob = Math.sin(t * 4) * 0.7;
    const combs = [[-7, -15, 3.4], [0, -18, 3.9], [7, -15, 3.4]];
    for (let i = 0; i < combs.length; i++) {
      ctx.beginPath();
      ctx.arc(combs[i][0], combs[i][1] + combBob, combs[i][2], 0, Math.PI * 2);
      ctx.fill();
    }

    // 喙
    ctx.beginPath();
    ctx.moveTo(14.5, -1.5);
    ctx.lineTo(23, 1.6);
    ctx.lineTo(14.5, 5);
    ctx.closePath();
    ctx.fillStyle = C.beak;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(190, 105, 0, 0.3)';
    ctx.stroke();

    // 眼睛
    ctx.beginPath();
    ctx.arc(7, -3.5, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7.9, -4.6, 0.95, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 腮红
    ctx.beginPath();
    ctx.arc(10, 4.5, 2.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 120, 120, 0.32)';
    ctx.fill();

    ctx.restore();
  }

  /* 老鹰 */
  function hawk(ctx, h, t) {
    const ang = Math.atan2(h.vy, h.vx);
    const flip = Math.cos(ang) < 0 ? -1 : 1;
    const flap = Math.sin(t * 14 + h.phase);

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(flip, 1);

    // 后翼
    ctx.save();
    ctx.rotate(0.22 + flap * 0.2);
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.quadraticCurveTo(-22, -4 - flap * 4, -34, 8);
    ctx.quadraticCurveTo(-18, 6, -2, 7);
    ctx.closePath();
    ctx.fillStyle = C.hawkDark;
    ctx.fill();
    ctx.restore();

    // 尾羽
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-27, 6);
    ctx.lineTo(-24, -3);
    ctx.closePath();
    ctx.fillStyle = C.hawkDark;
    ctx.fill();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 11, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = C.hawk;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(50, 28, 20, 0.35)';
    ctx.stroke();

    // 头
    ctx.beginPath();
    ctx.arc(12, -6, 8, 0, Math.PI * 2);
    ctx.fillStyle = C.hawk;
    ctx.fill();
    ctx.stroke();

    // 喙
    ctx.beginPath();
    ctx.moveTo(18, -8.5);
    ctx.lineTo(26.5, -4);
    ctx.lineTo(18, -2);
    ctx.closePath();
    ctx.fillStyle = C.hawkBeak;
    ctx.fill();

    // 眼
    ctx.beginPath();
    ctx.arc(13, -9, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF6D6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13.9, -9, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#241610';
    ctx.fill();

    // 凶眉
    ctx.beginPath();
    ctx.moveTo(9.5, -13.8);
    ctx.lineTo(16.2, -11.6);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#2B1A12';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 前翼
    ctx.save();
    ctx.rotate(-0.16 - flap * 0.26);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-18, -8 + flap * 3, -30, 4);
    ctx.quadraticCurveTo(-16, 4, 0, 6);
    ctx.closePath();
    ctx.fillStyle = C.hawk;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(50, 28, 20, 0.3)';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /* 老鹰来袭预警 */
  function warning(ctx, w, W, H, t) {
    const x = clamp(w.x, 42, W - 42);
    const y = clamp(w.y, 42, H - 42);
    const pulse = 1 + Math.sin(t * 16) * 0.09;

    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 9));
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 74, 74, 0.92)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 26px "Arial Rounded MT Bold", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }

  /* 手指 / 鼠标目标环 */
  function pointerRing(ctx, x, y, t) {
    const p = 0.94 + Math.sin(t * 6) * 0.07;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, 14 * p, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  /* 粒子：羽毛 / 星星 / 绒毛球 */
  function particles(ctx, list) {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'feather') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.36, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.36, 0);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.7 - a * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* 飘字 */
  function texts(ctx, list) {
    ctx.save();
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const a = Math.max(0, item.life / item.max);
      ctx.globalAlpha = a;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
  }

  global.Art = {
    sky: sky,
    clouds: clouds,
    shadow: shadow,
    egg: egg,
    chick: chick,
    hawk: hawk,
    warning: warning,
    pointerRing: pointerRing,
    particles: particles,
    texts: texts
  };
})(window);
