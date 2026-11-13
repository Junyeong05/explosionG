// npx tsx tools/carry/fun.ts --write 로 고른 재밌을 조합 (극적 반응, 18초 두 판)
import type { AttackCat } from '../../../src/data/links';

export const FUN: { kind: string; cats: AttackCat[]; title: string; weapons: string[]; fuse: [string, string][]; input?: string; ratio: number; reacts: number }[] = [
  {
    "kind": "둘",
    "cats": [
      "ray",
      "sound"
    ],
    "title": "광선 + 음파",
    "weapons": [
      "arm_laser",
      "arm_s_guitar"
    ],
    "fuse": [
      [
        "arm_laser",
        "arm_s_guitar"
      ]
    ],
    "ratio": 5.5476190476190474,
    "reacts": 32
  },
  {
    "kind": "둘",
    "cats": [
      "ray",
      "throw"
    ],
    "title": "광선 + 투척",
    "weapons": [
      "arm_laser",
      "arm_th_volley"
    ],
    "fuse": [
      [
        "arm_laser",
        "arm_th_volley"
      ]
    ],
    "ratio": 3.037037037037037,
    "reacts": 32
  },
  {
    "kind": "둘",
    "cats": [
      "gun",
      "sound"
    ],
    "title": "총 + 음파",
    "weapons": [
      "arm_g_carbine",
      "arm_s_guitar"
    ],
    "fuse": [
      [
        "arm_g_carbine",
        "arm_s_guitar"
      ]
    ],
    "ratio": 3.4833333333333334,
    "reacts": 28
  },
  {
    "kind": "둘",
    "cats": [
      "spirit",
      "throw"
    ],
    "title": "정령 + 투척",
    "weapons": [
      "arm_sl_fairy",
      "arm_th_volley"
    ],
    "fuse": [
      [
        "arm_sl_fairy",
        "arm_th_volley"
      ]
    ],
    "ratio": 2.1842105263157894,
    "reacts": 33
  },
  {
    "kind": "둘",
    "cats": [
      "summon",
      "spinner"
    ],
    "title": "소환수 + 회전체",
    "weapons": [
      "arm_dog",
      "arm_sp_disc"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_sp_disc"
      ]
    ],
    "ratio": 2.8,
    "reacts": 25
  },
  {
    "kind": "둘",
    "cats": [
      "spirit",
      "gun"
    ],
    "title": "정령 + 총",
    "weapons": [
      "arm_sl_fairy",
      "arm_g_carbine"
    ],
    "fuse": [
      [
        "arm_sl_fairy",
        "arm_g_carbine"
      ]
    ],
    "ratio": 2.880434782608696,
    "reacts": 22
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "summon",
      "magic",
      "trap"
    ],
    "title": "소환수 + [주문, 함정]",
    "weapons": [
      "arm_dog",
      "arm_m_clone",
      "arm_tr_mines"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_m_clone"
      ],
      [
        "arm_dog",
        "arm_tr_mines"
      ]
    ],
    "ratio": 3.4285714285714284,
    "reacts": 36
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "summon",
      "ray",
      "swarm"
    ],
    "title": "소환수 + [광선, 떼]",
    "weapons": [
      "arm_dog",
      "arm_laser",
      "arm_sw_mosquito"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_laser"
      ],
      [
        "arm_dog",
        "arm_sw_mosquito"
      ]
    ],
    "ratio": 2.8351648351648353,
    "reacts": 37
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "ray",
      "gun",
      "magic"
    ],
    "title": "광선 + [총, 주문]",
    "weapons": [
      "arm_laser",
      "arm_g_carbine",
      "arm_m_timestop"
    ],
    "fuse": [
      [
        "arm_laser",
        "arm_g_carbine"
      ],
      [
        "arm_laser",
        "arm_m_timestop"
      ]
    ],
    "ratio": 3.5675675675675675,
    "reacts": 30
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "trap",
      "spinner",
      "field"
    ],
    "title": "함정 + [회전체, 장판]",
    "weapons": [
      "arm_tr_mines",
      "arm_sp_disc",
      "arm_f_lava"
    ],
    "fuse": [
      [
        "arm_tr_mines",
        "arm_sp_disc"
      ],
      [
        "arm_tr_mines",
        "arm_f_lava"
      ]
    ],
    "ratio": 2.876923076923077,
    "reacts": 20
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "magic",
      "charge",
      "swarm"
    ],
    "title": "주문 + [돌격, 떼]",
    "weapons": [
      "arm_m_poly",
      "arm_c_bikers",
      "arm_sw_mosquito"
    ],
    "fuse": [
      [
        "arm_m_poly",
        "arm_c_bikers"
      ],
      [
        "arm_m_poly",
        "arm_sw_mosquito"
      ]
    ],
    "ratio": 3.253968253968254,
    "reacts": 15
  },
  {
    "kind": "사슬",
    "cats": [
      "magic",
      "summon",
      "field"
    ],
    "title": "주문 → 소환수 → 장판",
    "weapons": [
      "arm_m_poly",
      "arm_dog",
      "arm_f_lava"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_f_lava"
      ],
      [
        "arm_m_poly",
        "arm_dog"
      ]
    ],
    "ratio": 2.8260869565217392,
    "reacts": 26
  },
  {
    "kind": "사슬",
    "cats": [
      "trap",
      "summon",
      "turret"
    ],
    "title": "함정 → 소환수 → 포격",
    "weapons": [
      "arm_tr_mines",
      "arm_dog",
      "arm_cannon"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_cannon"
      ],
      [
        "arm_tr_mines",
        "arm_dog"
      ]
    ],
    "ratio": 1.9166666666666667,
    "reacts": 26
  },
  {
    "kind": "사슬",
    "cats": [
      "magic",
      "trap",
      "charge"
    ],
    "title": "주문 → 함정 → 돌격",
    "weapons": [
      "arm_m_poly",
      "arm_tr_mines",
      "arm_c_bikers"
    ],
    "fuse": [
      [
        "arm_tr_mines",
        "arm_c_bikers"
      ],
      [
        "arm_m_poly",
        "arm_tr_mines"
      ]
    ],
    "ratio": 2.2982456140350878,
    "reacts": 21
  }
];
