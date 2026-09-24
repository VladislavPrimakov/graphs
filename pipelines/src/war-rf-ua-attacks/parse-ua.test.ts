import { describe, expect, it } from 'bun:test';
import { parseShotDownParagraph } from './parse-ua';

describe('parseShotDownParagraph', () => {
  it('parses all UAV variants and aliases', () => {
    const cases = [
      {
        text: 'Air defence shot down one UAV, two drones, three unmanned aerial vehicles, four Bayraktar, five Leleka, six Furia, seven Valkyrie, eight Tekever, nine Tu-143 Reys, 10 Strizh, 11 UJ-22, 12 Reis, and 13 Bayraktar-TB2.',
        expected: { uavs: 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13, ballistic: 0, cruise: 0 },
      },
      {
        text: 'Russian air defence facilities shot down 14 unmanned aerial vehicles and one another drone.',
        expected: { uavs: 14 + 1, ballistic: 0, cruise: 0 },
      },
    ];

    for (const { text, expected } of cases) {
      const res = parseShotDownParagraph(text);
      expect(res.uavs).toBe(expected.uavs);
      expect(res.ballistic).toBe(expected.ballistic);
      expect(res.cruise).toBe(expected.cruise);
    }
  });

  it('parses all cruise missile variants', () => {
    const cases = [
      {
        text: 'Air defence intercepted two Storm Shadow, three SCALP, four Neptun, one Neptune-MD, five Flamingo, and six cruise missiles.',
        expected: { cruise: 2 + 3 + 4 + 1 + 5 + 6, uavs: 0, ballistic: 0 },
      },
      {
        text: 'Russian air defence shot down eight French-made SCALP-EG cruise missiles and four British-made Storm Shadow missiles.',
        expected: { cruise: 8 + 4, uavs: 0, ballistic: 0 },
      },
    ];

    for (const { text, expected } of cases) {
      const res = parseShotDownParagraph(text);
      expect(res.cruise).toBe(expected.cruise);
      expect(res.uavs).toBe(expected.uavs);
      expect(res.ballistic).toBe(expected.ballistic);
    }
  });

  it('parses all ballistic and MLRS variants', () => {
    const cases = [
      {
        text: 'Air defence shot down one HIMARS, two Vampire, three Uragan, four Olkha, five Olha, six Grad, seven Smerch, eight ATACMS, nine Tochka-U, 10 Grom-2, 11 S-200 missiles converted to hit ground targets, 12 ballistic missiles, and 13 operational-tactical missiles.',
        expected: { ballistic: 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13, uavs: 0, cruise: 0 },
      },
      {
        text: 'Air defence intercepted 14 projectiles of multiple-launch rocket systems Olkha and HIMARS, as well as 16 rockets launched by Vampire MLRS.',
        expected: { ballistic: 14 + 16, uavs: 0, cruise: 0 },
      },
      {
        text: 'Air defence facilities shot down 21 U.S.-made MLRS projectiles and 15 Czech-made Vampire missiles.',
        expected: { ballistic: 21 + 15, uavs: 0, cruise: 0 },
      },
      {
        text: 'Air defence intercepted 5 projectiles launched by a MRLS and 14 rocket-propelled projectiles, launched by HIMARS MLRS.',
        expected: { ballistic: 5 + 14, uavs: 0, cruise: 0 },
      },
      {
        text: 'Air defence shot down 53 shells of multiple rocket launchers and 26 multiple-launch rockets.',
        expected: { ballistic: 53 + 26, uavs: 0, cruise: 0 },
      },
      {
        text: '13 shells of the U.S. HIMARS MLRS were shot down by Russian air defence.',
        expected: { ballistic: 13, uavs: 0, cruise: 0 },
      },
    ];

    for (const { text, expected } of cases) {
      const res = parseShotDownParagraph(text);
      expect(res.ballistic).toBe(expected.ballistic);
      expect(res.uavs).toBe(expected.uavs);
      expect(res.cruise).toBe(expected.cruise);
    }
  });

  it('handles syntax formatting, sub-clauses, and edge cases', () => {
    const cases = [
      {
        text: 'Air defence shot down 12 unmanned aerial vehicles (four Leleka, eight Furia) and five aircraft (three MiG-29, two Su-25).',
        expected: { uavs: 12, ballistic: 0, cruise: 0, total_missiles: 0 },
      },
      {
        text: 'Air defence shot down 49 unmanned aerial vehicles, including 15 Bayraktar-TB2, near the line of contact.',
        expected: { uavs: 49, ballistic: 0, cruise: 0, total_missiles: 0 },
      },
      {
        text: 'Air defence systems shot down 340 unmanned aerial vehicles, with 147 of them outside the special military operation were shot down.',
        expected: { uavs: 340, ballistic: 0, cruise: 0, total_missiles: 0 },
      },
      {
        text: 'Over the past 24 hours, air defence intercepted 1,250 fixed-wing UAVs, twenty-four HIMARS, and one Neptune missile.',
        expected: { uavs: 1250, ballistic: 24, cruise: 1, total_missiles: 25 },
      },
      {
        text: 'Near S-400 and MiG-29 base, air defence shot down 18 French-made Hammer guided bombs, 87 U.S.-made HIMARS projectiles, and 50 UAVs.',
        expected: { uavs: 50, ballistic: 87, cruise: 0, total_missiles: 87 },
      },
      {
        text: 'two Su-27s, two Su-24s, one helicopter and four Bayraktar TB-2 attack unmanned aerial vehicles of the Armed Forces of Ukraine have been shot down.',
        expected: { uavs: 4, ballistic: 0, cruise: 0, total_missiles: 0 },
      },
      {
        text: 'During the night of March 14, 4 Ukrainian unmanned aerial vehicles were shot down by Russian air defence.',
        expected: { uavs: 4, ballistic: 0, cruise: 0, total_missiles: 0 },
      },
      {
        text: 'Russian air defence systems shot down 5 unmanned aerial vehicles, including 2 Bayraktar TB-2 and 1 Tochka-U tactical missile.',
        expected: { uavs: 5, ballistic: 1, cruise: 0, total_missiles: 1 },
      },
    ];

    for (const { text, expected } of cases) {
      const res = parseShotDownParagraph(text);
      expect(res.uavs).toBe(expected.uavs);
      expect(res.ballistic).toBe(expected.ballistic);
      expect(res.cruise).toBe(expected.cruise);
      expect(res.total_missiles).toBe(expected.total_missiles);
    }
  });

  it('handles multi-paragraph reports and cumulative stop triggers', () => {
    const textWithBullets =
      'Russian air defence shot down one Su-25 aircraft near Kherson.\n\n' +
      '▫️ In addition, 14 HIMARS projectiles and six Neptune missiles were intercepted.\n\n' +
      '▫️ Moreover, 26 Ukrainian unmanned aerial vehicles were downed.\n\n' +
      '📊 In total, 640 airplanes and 283 helicopters, 30,390 unmanned aerial vehicles, 17,547 tanks were destroyed during the special military operation.';

    const resWithBullets = parseShotDownParagraph(textWithBullets);
    expect(resWithBullets.uavs).toBe(26);
    expect(resWithBullets.ballistic).toBe(14);
    expect(resWithBullets.cruise).toBe(6);
    expect(resWithBullets.total_missiles).toBe(20);

    const textPlain =
      'Russian air defence shot down one Su-25 aircraft near Kherson.\n\n' +
      '- In addition, 14 HIMARS projectiles and six Neptune missiles were intercepted.\n\n' +
      '- Moreover, 26 Ukrainian unmanned aerial vehicles were downed.\n\n' +
      'In total, 640 airplanes and 283 helicopters, 30,390 unmanned aerial vehicles, 17,547 tanks were destroyed during the special military operation.';

    const resPlain = parseShotDownParagraph(textPlain);
    expect(resPlain.uavs).toBe(26);
    expect(resPlain.ballistic).toBe(14);
    expect(resPlain.cruise).toBe(6);
    expect(resPlain.total_missiles).toBe(20);
  });

  it('rejects negative lookahead matches (ground depots, launchers, workshops)', () => {
    const cases = [
      'Operational-Tactical Aviation eliminated 25 UAV command posts, three drone launch sites, and two UAV depots.',
      'Missile Troops and Artillery neutralized three Grad MLRS at firing positions, one S-300 launcher, and four radar stations.',
      'High-precision weapons hit two UAV assembly workshops and five fuel depots.',
      'Missile troops have destroyed 1 Tochka-U missile launcher, as well as Russian air defence means have shot down 3 Ukrainian Tochka-U ballistic missiles.',
      'Up to 150 servicemen, 2 American M777 howitzers and up to 1,500 rounds of ammunition, 6 Msta-B howitzers, 8 artillery mounts, around 350 shells for Grad MLRS and seven unmanned aerial vehicles have been destroyed.',
    ];
    const expectedBallistic = [0, 0, 0, 3, 0];

    for (let idx = 0; idx < cases.length; idx++) {
      const res = parseShotDownParagraph(cases[idx]);
      expect(res.uavs).toBe(0);
      expect(res.ballistic).toBe(expectedBallistic[idx]);
      expect(res.cruise).toBe(0);
      expect(res.total_missiles).toBe(expectedBallistic[idx]);
    }
  });
});
