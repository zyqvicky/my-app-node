const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../db/index');

// 生成订单
router.post('/createOrder', (req, res) => {
    const { userId, courseId } = req.body;

    // 检查用户是否存在
    db.query('SELECT * FROM user WHERE id = ?', [userId], (err, userResult) => {
        if (err) return res.status(500).json({ message: '数据库查询错误！', error: err });
        if (userResult.length === 0) return res.status(404).json({ message: '用户不存在' });

        // 检查课程是否存在
        db.query('SELECT * FROM course WHERE id = ?', [courseId], (err, courseResult) => {
            if (err) return res.status(500).json({ message: '数据库查询错误！', error: err });
            if (courseResult.length === 0) return res.status(404).json({ message: '课程不存在' });

            const course = courseResult[0];
            const orderId = nanoid();
            const price = course.price;

            // 检查订单是否已存在
            db.query(
                'SELECT * FROM cart WHERE userId = ? AND courseId = ?',
                [userId, courseId],
                (err, existingOrder) => {
                    if (err) return res.status(500).json({ message: '订单检查失败', error: err });
                    if (existingOrder.length > 0) {
                        return res.status(409).json({ message: '订单已存在，无法重复创建' });
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
                            if (err) return res.status(500).json({ message: '订单创建失败', error: err });
                            const countSql = 'SELECT COUNT(*) AS total FROM cart';
                            db.query(countSql, (err, countResult) => {
                                if (err) return res.status(500).json({ message: '订单统计失败', error: err });

                                const total = countResult[0].total;
                                return res.status(200).json({
                                    message: '订单创建成功',
                                    orderId,
                                    total,
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

// 获取订单列表
router.get('/getOrders', (req, res) => {
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
        if (err) return res.status(500).json({ message: '订单列表获取失败', error: err });

        return res.status(200).json({
            message: '订单列表获取成功',
            orders: result,
        });
    });
});

// 删除订单
router.delete('/deleteOrders', (req, res) => {
    const { orderIds } = req.body;
    let sql;
    
    if (!orderIds) {
        sql = 'DELETE FROM cart';
    } else {
        sql = `DELETE FROM cart WHERE id IN (?)`;
    }
    db.query(sql, [orderIds], (err, result) => {
        if (err) return res.status(500).json({ message: '订单删除失败', error: err });

        const countSql = 'SELECT COUNT(*) AS total FROM cart';
        db.query(countSql, (err, countResult) => {
            if (err) return res.status(500).json({ message: '订单统计失败', error: err });

            const total = countResult[0].total;
            return res.status(200).json({
                message: '订单删除成功',
                total,
            });
        });
    });
});

module.exports = router;