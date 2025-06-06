const express = require("express");
const router = express.Router();
const { nanoid } = require("nanoid");
const db = require("../db/index");

// 生成订单
router.post("/createOrder", (req, res) => {
    const { userId, courseId } = req.body;

    // 检查用户是否存在
    db.query("SELECT * FROM user WHERE id = ?", [userId], (err, userResult) => {
        if (err)
            return res
                .status(500)
                .json({ message: "数据库查询错误！", error: err });
        if (userResult.length === 0)
            return res.status(404).json({ message: "用户不存在" });

        // 检查课程是否存在
        db.query(
            "SELECT * FROM course WHERE id = ?",
            [courseId],
            (err, courseResult) => {
                if (err)
                    return res
                        .status(500)
                        .json({ message: "数据库查询错误！", error: err });
                if (courseResult.length === 0)
                    return res.status(404).json({ message: "课程不存在" });

                const course = courseResult[0];
                const orderId = nanoid();
                const price = course.price;

                // 检查订单是否已存在
                db.query(
                    "SELECT * FROM cart WHERE userId = ? AND courseId = ?",
                    [userId, courseId],
                    (err, existingOrders) => {
                        if (err)
                            return res
                                .status(500)
                                .json({ message: "订单检查失败", error: err });
                        if (existingOrders.length > 0) {
                            // 判断订单状态
                            const paidOrder = existingOrders.find(
                                (order) => order.status === 1
                            );
                            if (paidOrder) {
                                return res.status(409).json({
                                    message: "该课程已购买，无法重复购买",
                                });
                            }

                            return res.status(409).json({
                                message: "该课程已在购物车中，无法重复添加",
                            });
                        }

                        // 插入订单记录
                        const sql = `
                        INSERT INTO cart (id, userId, courseId, price, status, createTime)
                        VALUES (?, ?, ?, ?, ?, NOW())
                    `;
                        db.query(
                            sql,
                            [orderId, userId, courseId, price, 0],
                            (err, result) => {
                                if (err)
                                    return res.status(500).json({
                                        message: "订单创建失败",
                                        error: err,
                                    });
                                const countSql =
                                    "SELECT COUNT(*) AS total FROM cart WHERE status = 0";
                                db.query(countSql, (err, countResult) => {
                                    if (err)
                                        return res.status(500).json({
                                            message: "订单统计失败",
                                            error: err,
                                        });

                                    const total = countResult[0].total;

                                    db.query(
                                        "SELECT title FROM course WHERE id = ?",
                                        [courseId],
                                        (err, result) => {
                                            if (err)
                                                return res.status(500).json({
                                                    message: "查询课程失败",
                                                    error: err,
                                                });
                                            if (result.length === 0)
                                                return res.status(404).json({
                                                    message: "课程不存在",
                                                });

                                            const courseName = result[0].title;

                                            // 生成系统消息
                                            const messageSql = `
                                            INSERT INTO message (type, title, content, status, userId, courseId) 
                                            VALUES ('buy', '购买成功', '您购买的《${courseName}》已成功支付。', 0, ?, ?);
                                        `;
                                            db.query(
                                                messageSql,
                                                [userId, courseId],
                                                (err, result) => {
                                                    if (err)
                                                        return res
                                                            .status(500)
                                                            .json({
                                                                message:
                                                                    "消息添加失败",
                                                                error: err,
                                                            });

                                                    return res
                                                        .status(200)
                                                        .json({
                                                            message:
                                                                "订单创建成功，消息创建成功",
                                                            orderId,
                                                            total,
                                                        });
                                                }
                                            );
                                        }
                                    );
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// 根据id获取订单列表
router.get("/getOrders", (req, res) => {
    const { userId } = req.query;

    const sql = `
        SELECT 
            cart.id,
            cart.userId,
            cart.courseId,
            cart.price,
            cart.status,
            cart.createTime,
            course.title,
            course.coverUrl
        FROM cart
        JOIN course ON cart.courseId = course.id
        WHERE cart.userId = ?
    `;

    db.query(sql, [userId], (err, result) => {
        if (err)
            return res
                .status(500)
                .json({ message: "订单列表获取失败", error: err });

        return res.status(200).json({
            message: "订单列表获取成功",
            orders: result,
        });
    });
});

// 删除订单
router.delete("/deleteOrders", (req, res) => {
    const { orderIds } = req.body;
    let sql;

    if (!orderIds) {
        sql = "DELETE FROM cart WHERE status = 0";
    } else {
        sql = `DELETE FROM cart WHERE id IN (?) AND status = 0`;
    }
    db.query(sql, [orderIds], (err, result) => {
        if (err)
            return res
                .status(500)
                .json({ message: "订单删除失败", error: err });

        const countSql = "SELECT COUNT(*) AS total FROM cart WHERE status = 0";
        db.query(countSql, (err, countResult) => {
            if (err)
                return res
                    .status(500)
                    .json({ message: "订单统计失败", error: err });

            const total = countResult[0].total;
            return res.status(200).json({
                message: "订单删除成功",
                total,
            });
        });
    });
});

// 更新订单状态
router.put("/updateOrderStatus", (req, res) => {
    const { orderIds } = req.body;

    const sql = `
        UPDATE cart
        SET status = 1
        WHERE id In (?)
    `;

    db.query(sql, [orderIds], (err, result) => {
        if (err)
            return res
                .status(500)
                .json({ message: "订单状态更新失败", error: err });
        const countSql = "SELECT COUNT(*) AS total FROM cart WHERE status = 0";

        db.query(countSql, (err, countResult) => {
            if (err)
                return res
                    .status(500)
                    .json({ message: "订单统计失败", error: err });
            const total = countResult[0].total;

            return res.status(200).json({
                message: "订单状态更新成功",
                total,
            });
        });
    });
});

// 生成购买信息
router.post("/createBuyInfo", (req, res) => {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
        return res.status(400).json({ message: "缺少 userId 或 courseId" });
    }

    try {
        const messageSql = `
            INSERT INTO message (userId, content, type, status, createTime) 
            VALUES (?, ?, 'system', 'unread', NOW());
        `;
        const messageContent = `您已成功购买课程，快去学习并留下评分吧！`;

        db.query(messageSql, [userId, messageContent]);

        res.status(200).json({ message: "购买信息和系统消息已生成" });
    } catch (error) {
        console.error("生成购买信息失败:", error);
        res.status(500).json({ error: "生成购买信息失败" });
    }
});

module.exports = router;
