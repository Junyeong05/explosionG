// npx tsx tools/carry/fun.ts --write 로 고른 재밌을 조합 (극적 반응, 18초 두 판)
import type { AttackCat } from '../../../src/data/links';

export const FUN: { kind: string; cats: AttackCat[]; title: string; weapons: string[]; fuse: [string, string][]; input?: string; ratio: number; reacts: number }[] = [
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
    "ratio": 3,
    "reacts": 33
  },
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
      "spirit",
      "sound"
    ],
    "title": "정령 + 음파",
    "weapons": [
      "arm_sl_fairy",
      "arm_s_guitar"
    ],
    "fuse": [
      [
        "arm_sl_fairy",
        "arm_s_guitar"
      ]
    ],
    "ratio": 4.114754098360656,
    "reacts": 26
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
    "ratio": 2.8222222222222224,
    "reacts": 26
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
      "swarm",
      "spirit"
    ],
    "title": "떼 + 정령",
    "weapons": [
      "arm_sw_mosquito",
      "arm_sl_fairy"
    ],
    "fuse": [
      [
        "arm_sw_mosquito",
        "arm_sl_fairy"
      ]
    ],
    "ratio": 2.9879518072289155,
    "reacts": 21
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
    "ratio": 2.868131868131868,
    "reacts": 33
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
      "spirit",
      "gun",
      "swarm"
    ],
    "title": "정령 + [총, 떼]",
    "weapons": [
      "arm_sl_fairy",
      "arm_g_carbine",
      "arm_sw_mosquito"
    ],
    "fuse": [
      [
        "arm_sl_fairy",
        "arm_g_carbine"
      ],
      [
        "arm_sl_fairy",
        "arm_sw_mosquito"
      ]
    ],
    "ratio": 2.180327868852459,
    "reacts": 29
  },
  {
    "kind": "한 몸에 둘",
    "cats": [
      "magic",
      "spinner",
      "ray"
    ],
    "title": "주문 + [회전체, 광선]",
    "weapons": [
      "arm_m_poly",
      "arm_sp_disc",
      "arm_laser",
      "arm_pistol"
    ],
    "fuse": [
      [
        "arm_m_poly",
        "arm_sp_disc"
      ],
      [
        "arm_m_poly",
        "arm_laser"
      ]
    ],
    "ratio": 2.6455696202531644,
    "reacts": 19
  },
  {
    "kind": "사슬",
    "cats": [
      "trap",
      "summon",
      "field"
    ],
    "title": "함정 → 소환수 → 장판",
    "weapons": [
      "arm_tr_mines",
      "arm_dog",
      "arm_f_lava"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_f_lava"
      ],
      [
        "arm_tr_mines",
        "arm_dog"
      ]
    ],
    "ratio": 2.625,
    "reacts": 25
  },
  {
    "kind": "사슬",
    "cats": [
      "magic",
      "summon",
      "turret"
    ],
    "title": "주문 → 소환수 → 포격",
    "weapons": [
      "arm_m_poly",
      "arm_dog",
      "arm_cannon",
      "arm_pistol"
    ],
    "fuse": [
      [
        "arm_dog",
        "arm_cannon"
      ],
      [
        "arm_m_poly",
        "arm_dog"
      ]
    ],
    "ratio": 2.2222222222222223,
    "reacts": 26
  },
  {
    "kind": "사슬",
    "cats": [
      "magic",
      "trap",
      "field"
    ],
    "title": "주문 → 함정 → 장판",
    "weapons": [
      "arm_m_poly",
      "arm_tr_mines",
      "arm_f_lava",
      "arm_pistol"
    ],
    "fuse": [
      [
        "arm_tr_mines",
        "arm_f_lava"
      ],
      [
        "arm_m_poly",
        "arm_tr_mines"
      ]
    ],
    "ratio": 3.227272727272727,
    "reacts": 17
  }
];
