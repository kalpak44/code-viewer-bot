const crypto = require('node:crypto');

const distance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

// crypto, not Math.random: the schedule offset is drawn from it and a predictable
// idle-automation schedule is the thing the offset exists to avoid. randomInt's upper
// bound is exclusive, so max + 1 keeps this inclusive.
const randomInt = (min, max) => crypto.randomInt(min, max + 1);

module.exports = {
    distance,
    randomInt
};
