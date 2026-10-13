/**
 * Historical launch cost estimates (in USD) for rocket configurations
 * where Launch Library 2 / Space Devs API has null or missing values.
 *
 * Sources and methodology:
 * - Western / commercial launchers: Arianespace, CSIS Aerospace Security Project,
 *   FAA AST commercial launch reports, and NASA historical budget reports.
 * - Soviet / Russian state launchers: retrospective aerospace literature estimates
 *   (CSIS / RAND) based on vehicle mass class, propulsion, and series production volume.
 * - Chinese export launchers: Great Wall Industry Corporation (GWIC) commercial pricing.
 * - Japanese / Indian / Korean launchers: JAXA, ISRO, and KARI public commercial mission schedules.
 */
export const FALLBACK_LAUNCH_COST: Record<number, number> = {
  // Soviet / Russian launchers
  37: 20_000_000, // Soyuz U
  102: 10_000_000, // Kosmos-3M (11K65M)
  104: 18_000_000, // Voskhod
  106: 15_000_000, // Molniya-M 2BL
  327: 5_000_000, // Kosmos 11K63
  80: 65_000_000, // Proton K/DM-2
  452: 15_000_000, // Vostok 8A92M
  378: 20_000_000, // Soyuz-U-PVB
  101: 22_000_000, // Soyuz-U2
  22: 75_000_000, // Proton-M Briz-M
  349: 60_000_000, // Proton-K/DM
  34: 45_000_000, // Soyuz FG
  451: 15_000_000, // Vostok 8A92
  350: 65_000_000, // Proton-K/DM-2M
  184: 15_000_000, // Molniya 8K78
  191: 55_000_000, // Proton / UR-500 K/D
  190: 5_000_000, // Kosmos-2I
  87: 80_000_000, // Proton-M Briz-M Enhanced
  96: 18_000_000, // Soyuz
  40: 18_000_000, // Rokot/Briz-KM
  95: 60_000_000, // Proton-K
  103: 15_000_000, // Vostok-K
  351: 30_000_000, // R-36O 8K69
  454: 15_000_000, // Vostok-L 8K72
  329: 8_000_000, // Kosmos 65S3
  444: 15_000_000, // Tsiklon-2A
  376: 18_000_000, // Soyuz 11A511M
  347: 60_000_000, // Proton-K/D-1
  335: 15_000_000, // Molniya 8K78M-PVB
  345: 65_000_000, // Proton-K/17S40
  70: 50_000_000, // Soyuz-FG Fregat
  94: 75_000_000, // Proton-M DM-2 Enhanced
  60: 25_000_000, // Soyuz 2.1v Volga

  // Ukrainian / Sea Launch
  11: 70_000_000, // Zenit 3SL (Sea Launch commercial contract)
  91: 65_000_000, // Zenit 3SLB (Land Launch)
  455: 40_000_000, // Zenit-2
  31: 15_000_000, // Dnepr 1

  // European launchers (Arianespace / ESA)
  219: 40_000_000, // Ariane 1
  220: 45_000_000, // Ariane 2
  221: 50_000_000, // Ariane 3
  222: 55_000_000, // Ariane 40
  224: 60_000_000, // Ariane 42P
  223: 70_000_000, // Ariane 42L
  227: 65_000_000, // Ariane 44P
  226: 75_000_000, // Ariane 44LP
  225: 85_000_000, // Ariane 44L
  131: 130_000_000, // Ariane 5 G
  149: 135_000_000, // Ariane 5 GS
  18: 150_000_000, // Ariane 5 ES
  20: 165_000_000, // Ariane 5 ECA
  215: 170_000_000, // Ariane 5 ECA+
  171: 50_000_000, // Soyuz STB Fregat (CSG Kourou)
  49: 50_000_000, // Soyuz STA Fregat (CSG Kourou)
  312: 10_000_000, // Diamant B

  // US Launchers - Early & Human Spaceflight
  449: 5_000_000, // Vanguard
  324: 3_000_000, // Juno-I
  188: 4_000_000, // Juno II
  162: 20_000_000, // Atlas LV-3B (Project Mercury)
  98: 35_000_000, // Titan II GLV (Project Gemini)
  355: 30_000_000, // Saturn I
  163: 45_000_000, // Saturn IB
  93: 185_000_000, // Saturn V (marginal flight cost)

  // US Launchers - Scout & Minotaur
  370: 5_000_000, // Scout X-4
  360: 5_000_000, // Scout D-1
  359: 5_000_000, // Scout B-1
  175: 30_000_000, // Minotaur I
  52: 50_000_000, // Minotaur IV

  // US Launchers - Thor & Delta family
  395: 8_000_000, // Thor Burner 2
  396: 8_000_000, // Thor Burner 2A
  417: 15_000_000, // Thor SLV-2A Agena D
  186: 12_000_000, // Thor DM-21 Agena-B
  187: 10_000_000, // Thor DM-21 Ablestar
  401: 12_000_000, // Thor Delta C
  405: 15_000_000, // Thor Delta E1
  419: 18_000_000, // Thorad SLV-2H Agena D
  285: 25_000_000, // Delta 2910
  287: 25_000_000, // Delta 2914
  289: 30_000_000, // Delta 3910/PAM
  291: 35_000_000, // Delta 3914
  294: 35_000_000, // Delta 3920/PAM
  295: 35_000_000, // Delta 3924
  300: 50_000_000, // Delta II 6925
  467: 50_000_000, // Delta II 7420-10C
  23: 140_000_000, // Delta IV M+(5,4)

  // US Launchers - Atlas & Titan family
  237: 20_000_000, // SM-65D Atlas
  238: 30_000_000, // SM-65E Atlas
  244: 25_000_000, // SM-65F Atlas
  249: 25_000_000, // Atlas F/SVS
  232: 25_000_000, // Atlas LV-3 Agena D
  258: 25_000_000, // Atlas SLV-3 Agena D
  259: 25_000_000, // Atlas SLV-3A Agena D
  236: 40_000_000, // Atlas LV-3C Centaur D
  260: 40_000_000, // Atlas SLV-3C Centaur
  261: 45_000_000, // Atlas SLV-3D Centaur
  250: 55_000_000, // Atlas G Centaur
  251: 50_000_000, // Atlas H
  252: 65_000_000, // Atlas I
  253: 70_000_000, // Atlas II
  254: 75_000_000, // Atlas IIA
  255: 85_000_000, // Atlas IIAS
  438: 50_000_000, // Titan IIIB
  420: 50_000_000, // Titan 23B
  421: 60_000_000, // Titan 24B
  436: 45_000_000, // Titan II SLV
  439: 180_000_000, // Titan IIIC
  440: 150_000_000, // Titan IIID
  148: 120_000_000, // Titan IIIE (Centaur)
  426: 160_000_000, // Titan 34D Transtage
  427: 250_000_000, // Titan 401A Centaur
  429: 260_000_000, // Titan 402B IUS
  430: 250_000_000, // Titan 403A
  130: 350_000_000, // Titan IVB/Centaur

  // US Launchers - Commercial / Orbital Sciences
  165: 80_000_000, // Antares 230
  210: 85_000_000, // Antares 230+

  // Chinese launchers (GWIC export & domestic)
  318: 20_000_000, // Feng Bao 1
  270: 35_000_000, // Long March 3
  71: 45_000_000, // Long March 3A
  90: 50_000_000, // Long March 3C
  61: 30_000_000, // Long March 2C
  267: 30_000_000, // Long March 2C/SD
  156: 35_000_000, // Long March 2C/YZ-1S
  268: 40_000_000, // Long March 2E
  79: 60_000_000, // Long March 2F
  84: 60_000_000, // Long March 2F/G (crewed Shenzhou)
  10: 30_000_000, // Long March 4B
  64: 35_000_000, // Long March 4C
  54: 15_000_000, // Long March 6
  478: 30_000_000, // Long March 6A
  100: 65_000_000, // Long March 7
  216: 50_000_000, // Long March 7A
  462: 35_000_000, // Long March 8
  518: 35_000_000, // Long March 8A
  128: 100_000_000, // Long March 5
  47: 10_000_000, // Long March 11
  517: 45_000_000, // Long March 12
  135: 6_000_000, // Kuaizhou 1A
  194: 8_000_000, // Kuaizhou 11
  484: 8_000_000, // Smart Dragon 3
  461: 5_000_000, // Ceres-1
  500: 5_000_000, // Ceres-1S
  483: 12_000_000, // Kinetica 1
  193: 5_000_000, // Hyperbola-1

  // Japanese launchers (NASDA / JAXA)
  333: 5_000_000, // Lambda 4S
  459: 30_000_000, // N-I
  341: 35_000_000, // N-2
  339: 30_000_000, // Mu-3S-II
  319: 40_000_000, // H-I
  320: 90_000_000, // H-II
  334: 60_000_000, // M-V
  322: 95_000_000, // H-IIA 2024

  // Indian launchers (ISRO)
  38: 25_000_000, // PSLV XL
  178: 22_000_000, // PSLV-DL
  168: 40_000_000, // GSLV Mk. II

  // Israeli / Korean / Iranian launchers
  110: 15_000_000, // Shavit-2
  117: 40_000_000, // KSLV-2 Nuri
  39: 8_000_000, // Safir
  142: 10_000_000, // Simorgh
};
