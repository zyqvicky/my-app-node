const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Root123456@',
	database: 'MyDB',
    port: 3306
});

module.exports=connection