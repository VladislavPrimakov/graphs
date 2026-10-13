/**
 * Verified historical LEO payload capacities (in kg) for rocket configurations
 * where Launch Library 2 / Space Devs API has null or missing values.
 */
export const FALLBACK_LEO_CAPACITY: Record<number, number> = {
  // Soviet launchers
  102: 1500, // Kosmos-3M (11K65M)
  104: 5900, // Voskhod
  106: 7000, // Molniya-M 2BL (LEO stage capability)
  335: 7000, // Molniya 8K78M-PVB
  80: 20600, // Proton K/DM-2
  349: 20600, // Proton-K/DM
  350: 20600, // Proton-K/DM-2M
  95: 20600, // Proton-K
  191: 20600, // Proton / UR-500 K/D
  347: 20600, // Proton-K/D-1
  94: 22000, // Proton-M DM-2 Enhanced
  87: 22000, // Proton-M Briz-M Enhanced
  96: 6500, // Soyuz (11A511)
  212: 8200, // Soyuz 2.1a Fregat
  57: 7000, // Soyuz 2.1a Volga
  555: 8200, // Soyuz 2.1b Volga
  351: 5000, // R-36O 8K69 (FOBS)
  352: 5000, // R-36O 8K69M (FOBS)
  325: 1500, // K65M-RB
  76: 1700, // Strela
  382: 532, // Start-1.2
  468: 500, // Sputnik 8K74PS
  469: 1327, // Sputnik 8A91
  53: 3800, // Angara 1.2pp
  11: 13740, // Zenit 3SL
  91: 13740, // Zenit 3SLB
  89: 13740, // Zenit 2M
  58: 13740, // Zenit
  456: 13740, // Zenit-2 11K77.05
  31: 4500, // Dnepr 1

  // European launchers
  20: 21000, // Ariane 5 ECA
  215: 21000, // Ariane 5 ECA+
  149: 18000, // Ariane 5 GS
  146: 18500, // Ariane 5 G+
  221: 4900, // Ariane 3
  220: 4900, // Ariane 2

  // US Launchers - Delta family
  159: 5080, // Delta II 7925
  140: 5080, // Delta II 7925-9.5
  157: 5080, // Delta II 7925-10C
  151: 5080, // Delta II 7925-10L
  308: 5080, // Delta II 7925-10
  309: 5080, // Delta II 7925-8
  155: 6000, // Delta II 7925H-9.5
  306: 5000, // Delta II 7920-10L
  307: 5000, // Delta II 7920-8
  467: 3190, // Delta II 7420-10C
  303: 3190, // Delta II 7425-10
  304: 3190, // Delta II 7425-9.5
  305: 3190, // Delta II 7426-9.5
  302: 2800, // Delta II 7326-9.5
  298: 3800, // Delta II 6920-10
  299: 3800, // Delta II 6920-8
  285: 1800, // Delta 2910
  295: 2000, // Delta 3924
  288: 2000, // Delta 3910
  292: 2900, // Delta 3920
  293: 2900, // Delta 3920-8
  290: 2000, // Delta 3913
  283: 1300, // Delta 2310
  275: 750, // Delta 0300
  282: 1300, // Delta 1914
  281: 1300, // Delta 1913
  279: 1300, // Delta 1900
  280: 1300, // Delta 1910
  277: 1000, // Delta 1410
  189: 450, // Thor-Delta
  406: 550, // Thor Delta G
  411: 650, // Thor Delta N
  412: 700, // Thor Delta N6

  // US Launchers - Thor / Agena
  417: 1500, // Thor SLV-2A Agena D
  186: 1200, // Thor DM-21 Agena-B
  418: 1500, // Thorad SLV-2G Agena D
  419: 1500, // Thorad SLV-2H Agena D
  393: 1500, // Thor Agena D
  415: 1400, // Thor SLV-2 Agena D
  416: 1200, // Thor SLV-2A Agena B
  395: 450, // Thor Burner 2
  396: 450, // Thor Burner 2A
  394: 450, // Thor Burner 1
  413: 450, // Thor MG-18
  390: 150, // Thor Able III
  391: 150, // Thor Able IV
  389: 150, // Thor Able II

  // US Launchers - Atlas & Titan
  230: 175, // Atlas-Able
  183: 1400, // Atlas LV-3 Agena B
  238: 1500, // SM-65E Atlas
  243: 800, // Atlas E/SVS
  244: 1500, // SM-65F Atlas
  249: 1500, // Atlas F/SVS
  246: 1500, // Atlas F MSD
  242: 1500, // Atlas E/SGS-2
  248: 1500, // Atlas F/PTS
  245: 1500, // Atlas F/Agena D
  247: 1500, // Atlas F/OIS
  235: 3900, // Atlas LV-3C Centaur
  236: 4100, // Atlas LV-3C Centaur D
  426: 14500, // Titan 34D Transtage
  425: 14500, // Titan 34D IUS
  130: 21680, // Titan IVB/Centaur
  516: 21600, // Vulcan VC4S

  // US Launchers - Scout & Minotaur
  359: 140, // Scout B-1
  357: 100, // Scout A-1
  365: 87, // Scout X-2B
  366: 100, // Scout X-2M
  369: 100, // Scout X-3M
  82: 1400, // Minotaur C
  386: 1450, // Minotaur-C 3110
  387: 1058, // Minotaur-C 3210
  62: 300, // SPARK

  // Chinese launchers
  64: 4200, // Long March 4C
  71: 8500, // Long March 3A
  90: 9100, // Long March 3C
  36: 9100, // Long March 3C/YZ-1
  54: 1500, // Long March 6
  216: 13500, // Long March 7A
  66: 3500, // Long March 2C/SMA
  176: 3500, // Long March 2D/YZ-3
  92: 300, // Long March 1
  65: 300, // Kuaizhou
  125: 350, // Kaituozhe-2
  109: 14000, // Long March 7/YZ-1A
  123: 25000, // Long March 5/YZ-2
  160: 300, // Zhuque-1

  // Japanese launchers
  322: 12000, // H-IIA 2024
  48: 15000, // H-IIA 204
  321: 11000, // H-IIA 2022
  486: 12000, // H3-22
  204: 16000, // H3-24

  // Indian launchers
  168: 5000, // GSLV Mk. II

  // Israeli launchers
  44: 250, // Shavit
  110: 350, // Shavit-2

  // Iranian launchers
  39: 50, // Safir
  74: 50, // Safir 1B
  142: 350, // Simorgh

  // South / North Korean launchers
  12: 100, // KSLV Naro-1
  343: 10, // Paektusan 1
  67: 100, // Unha-3
  86: 100, // Unha
  495: 300, // Chollima-1

  // Lunar / Sample return ascenders
  513: 4700, // Apollo LM Ascent Stage
  514: 1880, // Luna Ascent Stage
  515: 800, // Chang'e Sample Ascender
};
