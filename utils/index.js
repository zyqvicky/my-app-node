const fs = require('fs');

const startDate = new Date('2024-12-01T00:00:00');
const endDate = new Date('2025-02-28T23:59:59');

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

let sqlUpdates = '';
for (let id = 1; id <= 40; id++) {
    const randomDate = getRandomDate(startDate, endDate).toISOString().slice(0, 19).replace('T', ' ');
    sqlUpdates += `UPDATE course SET createTime = '${randomDate}' WHERE id = ${id};\n`;
}

fs.writeFileSync('update_createTime.sql', sqlUpdates);
console.log('SQL 已生成：update_createTime.sql');