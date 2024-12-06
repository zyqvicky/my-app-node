const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));   // 配置静态文件路径

const userRouter = require('./user/index');
const courseRouter = require('./course/index');
app.use('/api', userRouter);
app.use('/api', courseRouter);

app.listen(3000, () => {
	console.log('Server is running on port 3000');
});