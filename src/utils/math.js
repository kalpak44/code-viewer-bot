const distance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt((dx * dx) + (dy * dy));
};

const randomInt = (min, max) => Math.floor(Math.random() * ((max - min) + 1)) + min;

module.exports = {
    distance,
    randomInt
};
