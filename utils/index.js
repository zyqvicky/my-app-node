const fs = require("fs");

const startDate = new Date("2025-03-01T00:00:00");
const endDate = new Date("2025-04-01T23:59:59");

function getRandomDate(start, end) {
    return new Date(
        start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
}

let sqlUpdates = "";
for (let id = 41; id <= 70; id++) {
    const randomDate = getRandomDate(startDate, endDate)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    sqlUpdates += `UPDATE course SET createTime = '${randomDate}' WHERE id = ${id};\n`;
}

fs.writeFileSync("update_createTime1.sql", sqlUpdates);
console.log("SQL 已生成：update_createTime1.sql");
