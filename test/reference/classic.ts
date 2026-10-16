// Пресеты с классическим голосом: каждый задействует свою часть цикла sfxr —
// скачок и повтор тона, вибрато, скважность, фильтры, фазер, шум.
import type { Preset } from "../../src/index.ts";

export const CLASSIC: Record<string, Preset> = {
  click: { ms: 39.25170068027211, voices: [{ kind: "classic", wave: "square", hz: 1070.7480000000003, env: { a: 0, h: 10.331632653061225, d: 28.97108843537415, punch: 0.08 }, gain: 0.0625, slide: -0.3257481647558761, duty: 0.5, hp: { hz: 2.2459945569128275 } }] },
  coin: { ms: 238.0952380952381, voices: [{ kind: "classic", wave: "square", hz: 885.528, env: { a: 0, h: 5.668934240362813, d: 232.4716553287982, punch: 0.45 }, gain: 0.0484, jump: { ms: 80.72562358276645, ratio: 1.2903225806451613 }, duty: 0.5, hp: { hz: 14.037465980705171 } }] },
  arpeggio: { ms: 918.3673469387755, voices: [{ kind: "classic", wave: "square", hz: 460.7568, env: { a: 0, h: 232.19954648526078, d: 686.2131519274377, punch: 0.42 }, gain: 0.1024, slide: 0.3257498325907493, jump: { ms: 66.21315192743764, ratio: 1.149372442646315 }, repeat: 105.21541950113378, duty: 0.275, hp: { hz: 8.98397822765131 } }] },
  dive: { ms: 126.5079365079365, voices: [{ kind: "classic", wave: "sine", hz: 1988.028, env: { a: 0, h: 277.7777777777777, d: 459.4557823129252, punch: 0.1 }, gain: 0.09, minHz: 12.348, stopAtMin: true, slide: -57.94992382419198 }] },
  sweep: { ms: 414.0816326530612, voices: [{ kind: "classic", wave: "square", hz: 568.008, env: { a: 5.668934240362813, h: 204.08163265306123, d: 204.35374149659864, punch: 0.3 }, gain: 0.25, minHz: 38.808000000000014, stopAtMin: true, slide: -5.089624521994831, accel: 2.8057677424712657, vib: { hz: 17.546832475881462, depth: 0.15 }, jump: { ms: 163.99092970521542, ratio: 0.5263157894736842 }, repeat: 114.10430839002268, duty: 0.35, dutySlide: -0.44100000000000006, lp: { hz: 359.3591291060524, slide: -15.269713359601445, res: 0.6 }, hp: { hz: 224.59945569128274, slide: 5.725798960194959 }, phaser: { ms: 0.1156462585034014, slide: -0.02500000000000001 } }] },
  saw: { ms: 317.687074829932, voices: [{ kind: "classic", wave: "saw", hz: 321.048, env: { a: 22.675736961451253, h: 90.70294784580501, d: 204.35374149659864, punch: 0.5 }, gain: 0.16000000000000003, slide: 0.6362316941929103, accel: -0.3507209678089082, vib: { hz: 25.267438765269304, depth: 0.1 }, lp: { hz: 1925.9403325527487, slide: 10.179554413261382, res: 0.3 }, hp: { hz: 56.149863922820686, slide: -3.817485603902348 }, phaser: { ms: -0.2602040816326531, slide: 0.20000000000000007 } }] },
  burst: { ms: 763.6734693877551, voices: [{ kind: "classic", wave: "noise", hz: 25.323842880000004, env: { a: 0, h: 337.50938775510195, d: 426.2030839002268, punch: 0.6116 }, gain: 0.09, slide: 0.07124501566902118, jump: { ms: 43.915628117913826, ratio: 1.6734825407131235 }, phaser: { ms: -0.20441288605442182, slide: -0.23451452572500003 } }] },
  power: { ms: 1143.6734693877552, voices: [{ kind: "classic", wave: "noise", hz: 994.5432000000001, env: { a: 765.1809750566894, h: 108.06097505668934, d: 270.48308390022675, punch: 0.029 }, gain: 0.16000000000000003, slide: -0.000027278292683861643, vib: { hz: 59.25168347567235, depth: -0.22265 }, jump: { ms: 752.1468662131517, ratio: 3.532328533046037 }, repeat: 46.98412698412698, lp: { hz: 89.53613736138061, slide: -5.776987682780444, res: 0.6981 }, hp: { hz: 336.48951412974316, slide: -0.20995575573026395 }, phaser: { ms: 1.1564625850340137e-7, slide: 0.04618210207500001 } }] },
};

/** Отпечаток звука: длина, переходы через ноль (тон) и громкость по 16 отрезкам. */
export function fingerprint(x: Float32Array): { length: number; crossings: number; rms: number[] } {
  const step = Math.ceil(x.length / 16);
  const rms: number[] = [];
  for (let b = 0; b < x.length; b += step) {
    const end = Math.min(b + step, x.length);
    let e = 0;
    for (let i = b; i < end; i++) e += x[i] * x[i];
    rms.push(Math.sqrt(e / (end - b)));
  }
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 !== x[i] < 0) crossings++;
  return { length: x.length, crossings, rms };
}
