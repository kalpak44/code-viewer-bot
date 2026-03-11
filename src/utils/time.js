const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = String(timeStr || '00:00').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return 0;
    }

    return (hours * 60) + minutes;
};

const formatMinutes = (totalMinutes) => {
    const normalized = Math.max(0, Math.min((23 * 60) + 59, totalMinutes));
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

module.exports = {
    parseTimeToMinutes,
    formatMinutes,
    getDateKey
};
