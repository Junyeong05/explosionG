import { simSeeds } from './harness';
const t0 = Date.now();
console.log(simSeeds(['arm_a_bomber'], [], { level: 3, hp: 7 }, [12, 31]).kills, Date.now() - t0);
