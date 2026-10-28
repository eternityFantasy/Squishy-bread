/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BreadTheme {
  id: string;
  name: string;
  flavor: string;
  bodyColor: string;
  bodyColorLight: string;
  crustColor: string;
  crustAccent: string;
  bellyColor: string;
  cheekColor: string;
  mouthColor: string;
  toppings: 'butter' | 'sesame' | 'sugar' | 'choco-drizzle' | 'strawberry';
  crumbColor: string;
}

export const BREAD_THEMES: BreadTheme[] = [
  {
    id: 'brioche',
    name: 'Butter Brioche',
    flavor: 'Golden & Pillowy',
    bodyColor: '#F7D488',
    bodyColorLight: '#FFF0B8',
    crustColor: '#D9822B',
    crustAccent: '#BD6416',
    bellyColor: '#FFF8E7',
    cheekColor: '#FF9E9E',
    mouthColor: '#8C3D2B',
    toppings: 'butter',
    crumbColor: '#FFEBB0',
  },
  {
    id: 'strawberry',
    name: 'Strawberry Milk',
    flavor: 'Sweet & Creamy',
    bodyColor: '#FDBCCF',
    bodyColorLight: '#FFE3EC',
    crustColor: '#E06B8F',
    crustAccent: '#C94F74',
    bellyColor: '#FFF5F8',
    cheekColor: '#FF699E',
    mouthColor: '#96294D',
    toppings: 'strawberry',
    crumbColor: '#FFD3E2',
  },
  {
    id: 'melon',
    name: 'Melon Pan',
    flavor: 'Matcha & Sugar Crust',
    bodyColor: '#C4E5B8',
    bodyColorLight: '#E5F6DF',
    crustColor: '#82B76D',
    crustAccent: '#5F954B',
    bellyColor: '#F4FAF0',
    cheekColor: '#FFAAA6',
    mouthColor: '#476839',
    toppings: 'sugar',
    crumbColor: '#D8F0CF',
  },
  {
    id: 'choco',
    name: 'Choco Swirl',
    flavor: 'Rich & Toasty',
    bodyColor: '#E0B589',
    bodyColorLight: '#F5DCBF',
    crustColor: '#8D532B',
    crustAccent: '#693717',
    bellyColor: '#FBF2E9',
    cheekColor: '#FFA07A',
    mouthColor: '#4A2311',
    toppings: 'choco-drizzle',
    crumbColor: '#ECC7A4',
  },
];
