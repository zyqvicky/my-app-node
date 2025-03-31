const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { nanoid } = require("nanoid");
const path = require("path");

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    },
});
const upload = multer({ storage });
const router = express.Router();
const db = require("../db/index");

// 登录验证
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM user WHERE username = ?";
    db.query(sql, [username], (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("用户不存在！");
        if (result[0].password !== password) {
            return res.status(401).send("密码错误！");
        }
        const token = jwt.sign({ username }, "secret");
        const userId = result[0].id;
        res.status(200).json({
            message: "登录成功！",
            token,
            userId,
        });
    });
});

// 注册用户
router.post("/register", (req, res) => {
    const { username, password } = req.body;
    const userId = nanoid();
    const sql = "INSERT INTO user (id, username, password) VALUES (?, ?, ?)";

    db.query(sql, [userId, username, password], (err, result) => {
        if (err) return res.status(500).send("数据库插入失败！" + err);
        res.status(200).send("注册成功！");
    });
});

// 根据id获取用户信息
router.get("/getUserInfo", (req, res) => {
    const { id } = req.query;
    const sql = "SELECT * FROM user WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("无用户信息！");

        res.status(200).json({
            message: "获取用户信息成功！",
            data: result,
        });
    });
});

// 编辑用户信息
router.post("/editUserInfo", (req, res) => {
    const { id, username, email, phone, address, signature } = req.body;
    const sql =
        "UPDATE user SET username = ?, email = ?, phone = ?, address = ?, signature = ? WHERE id = ?";
    db.query(
        sql,
        [username, email, phone, address, signature, id],
        (err, result) => {
            if (err) return res.status(500).send("数据库更新失败！" + err);
            if (result.affectedRows === 0)
                return res.status(404).send("无用户信息或数据未变化！");

            res.status(200).json({
                message: "更新用户信息成功！",
            });
        }
    );
});

// 修改用户头像
router.post("/editUserAvatar", upload.single("avatar"), (req, res) => {
    const { id } = req.body;
    const avatar = `http://localhost:3000/uploads/${req.file.filename}`;
    const sql = "UPDATE user SET avatar = ? WHERE id = ?";
    db.query(sql, [avatar, id], (err, result) => {
        if (err) return res.status(500).send("数据库更新失败！" + err);
        if (result.affectedRows === 0)
            return res.status(404).send("无用户信息或数据未变化！");

        res.status(200).json({
            message: "更新用户头像成功！",
            avatar,
        });
    });
});

// 获取全部用户信息
router.get("/getAllUserInfo", (req, res) => {
    const sql = "SELECT * FROM user";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);

        res.status(200).json({
            message: "获取全部用户信息成功！",
            data: result,
        });
    });
});

// 新增用户信息
router.post("/addUser", (req, res) => {
    const { username, email, phone, address, signature, role } = req.body;
    const userId = nanoid();
    const sql =
        "INSERT INTO user (id, username, email, phone, address, signature, role) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.query(
        sql,
        [userId, username, email, phone, address, signature, role],
        (err, result) => {
            if (err) return res.status(500).send("数据库插入失败！" + err);

            res.status(200).json({
                message: "新增用户信息成功！",
            });
        }
    );
});

// 删除用户信息
router.post("/deleteUser", (req, res) => {
    const { id } = req.body;
    const sql = "DELETE FROM user WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send("数据库删除失败！" + err);
        if (result.affectedRows === 0)
            return res.status(404).send("无用户信息或数据未变化！");

        res.status(200).json({
            message: "删除用户信息成功！",
        });
    });
});

// 更新用户信息
router.post("/updateUser", (req, res) => {
    const { id, username, email, phone, address, signature, role } = req.body;
    const sql =
        "UPDATE user SET username = ?, email = ?, phone = ?, address = ?, signature = ?, role = ? WHERE id = ?";
    db.query(
        sql,
        [username, email, phone, address, signature, role, id],
        (err, result) => {
            if (err) return res.status(500).send("数据库更新失败！" + err);
            if (result.affectedRows === 0)
                return res.status(404).send("无用户信息或数据未变化！");

            res.status(200).json({
                message: "更新用户信息成功！",
            });
        }
    );
});

module.exports = router;
