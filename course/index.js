const express = require("express");
const router = express.Router();
const db = require("../db/index");

// 获取分类列表 暂时弃置
router.get("/courseSort", (req, res) => {
    const sql = `
        SELECT 
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', c.id,
                    'sort', c.sort,
                    'content', (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', sc.id,
                                'name', sc.name
                            )
                        )
                        FROM subcategory sc
                        WHERE sc.category_id = c.id
                    )
                )
            ) AS data FROM category c;`;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("无数据！");

        res.status(200).json({
            message: "获取分类成功！",
            data: result,
        });
    });
});

// 获取全部分类列表2.0
router.get("/getCategory", (req, res) => {
    const sql = "SELECT * FROM subcategory";

    db.query(sql, (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("无数据！");

        res.status(200).json({
            message: "获取全部分类成功！",
            data: result,
        });
    });
});

// 获取分页课程列表
router.get("/getList", (req, res) => {
    const { page, pageSize, category } = req.query;

    // 查询总数的 SQL
    const countSql = `
        SELECT COUNT(*) AS total
        FROM course
        ${
            category && category !== "全部"
                ? `WHERE category = '${category}'`
                : ""
        }`;

    // 查询分页数据的 SQL
    const dataSql = `
        SELECT 
            category,
            id,
            title,
            teacher,
            \`desc\`,
            source,
            enrollNum,
            tag,
            price,
            rate,
            avatarUrl,
            coverUrl,
            guide,
            overview,
            target,
            createTime
        FROM course
        ${
            category && category !== "全部"
                ? `WHERE category = '${category}'`
                : ""
        }
        ORDER BY createTime DESC
        LIMIT ${(page - 1) * pageSize}, ${pageSize}`;

    // 查询总数
    db.query(countSql, (err, countResult) => {
        if (err) {
            return res.status(500).send("查询总数失败！" + err);
        }

        const total = countResult[0]?.total || 0;

        // 查询分页数据
        db.query(dataSql, (err, data) => {
            if (err) {
                return res.status(500).send("查询课程失败！" + err);
            }

            res.status(200).json({
                message: "获取课程列表成功！",
                total,
                data: data,
            });
        });
    });
});

// 根据id获取课程详情
router.get("/getDetail", (req, res) => {
    const { id } = req.query;
    const sql = "SELECT * FROM course WHERE id = ?";

    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("无数据！");

        res.status(200).json({
            message: "获取课程详情成功！",
            data: result,
        });
    });
});

// 获取热门课程排行
router.get("/getPopularCourses", (req, res) => {
    // 默认返回3条数据
    const sql = "SELECT * FROM course ORDER BY enrollNum DESC LIMIT 3";

    db.query(sql, (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(404).send("无课程数据！");

        res.status(200).json({
            message: "获取热门排行成功！",
            data: result,
        });
    });
});

// 获取新课排行
router.get("/getTopNew", (req, res) => {
    const { startDate } = req.query;

    const sql = `
        SELECT *
        FROM course
        WHERE createTime >= DATE_SUB(?, INTERVAL 60 DAY) AND createTime < ?
        ORDER BY enrollNum DESC
        LIMIT 3;
    `;

    db.query(sql, [startDate, startDate], (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1)
            return res.status(404).send("没有找到符合条件的课程！");

        res.status(200).json({
            message: "获取新课排行成功！",
            data: result,
        });
    });
});

// 获取五星课程
router.get("/getTopRate", (req, res) => {
    const sql =
        "SELECT * FROM course WHERE rate = 5 ORDER BY enrollNum DESC LIMIT 3";

    db.query(sql, (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1)
            return res.status(404).send("没有找到符合条件的课程！");

        res.status(200).json({
            message: "获取五星课程成功！",
            data: result,
        });
    });
});

// 模糊搜索课程名
router.get("/searchCourse", (req, res) => {
    let { keyword } = req.query;
    keyword = keyword ? `%${keyword}%` : "%";

    const sql = `
        SELECT *
        FROM course
        WHERE title LIKE ?
    `;

    db.query(sql, [keyword], (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "数据库查询失败！",
                error: err,
            });
        }

        res.status(200).json({
            message: "搜索课程成功！",
            data: result,
        });
    });
});

// 用户是否购买过该课程
router.get("/isBuy", (req, res) => {
    const { userId, courseId } = req.query;

    const sql = `
        SELECT * FROM cart WHERE userId = ? AND courseId = ?
    `;

    db.query(sql, [userId, courseId], (err, result) => {
        if (err) return res.status(500).send("数据库查询失败！" + err);
        if (result.length < 1) return res.status(200).json({ isBuy: false });

        res.status(200).json({ isBuy: true });
    });
});

// 用户点击课程 & 交互
router.post("/courseAction", (req, res) => {
    const { action, userId, courseId, rating } = req.body;

    if (!userId || !courseId) {
        return res.status(400).json({ error: "userId 和 courseId 不能为空" });
    }

    switch (action) {
        case "rate":
            db.query(
                "SELECT rating FROM user_course WHERE userId = ? AND courseId = ?",
                [userId, courseId],
                (err, result) => {
                    if (err) {
                        return res
                            .status(500)
                            .json({ message: "数据库查询失败", error: err });
                    }

                    if (result.length > 0 && result[0].rating !== null) {
                        return res
                            .status(400)
                            .json({ message: "您已评价过该课程" });
                    }

                    db.query(
                        "INSERT INTO user_course (userId, courseId, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating)",
                        [userId, courseId, rating],
                        (err) => {
                            if (err) {
                                return res.status(500).json({
                                    message: "评分提交失败",
                                    error: err,
                                });
                            }
                            res.json({
                                success: true,
                                message: "评分提交成功",
                            });
                        }
                    );
                }
            );
            break;

        case "getRating":
            db.query(
                "SELECT rating FROM user_course WHERE userId = ? AND courseId = ?",
                [userId, courseId],
                (err, result) => {
                    if (err)
                        return res
                            .status(500)
                            .json({ error: "数据库查询失败", details: err });
                    res.status(200).json({
                        rating: result.length ? result[0].rating : null,
                    });
                }
            );
            break;

        case "entry":
            try {
                global.userSession = global.userSession || {};
                global.userSession[userId] = {
                    courseId,
                    entryTime: Date.now(),
                };
                res.status(200).json({ message: "进入页面时间已记录" });
            } catch (error) {
                res.status(500).json({ error: "记录进入时间失败" });
            }
            break;

        case "exit":
            try {
                const sessionData = global.userSession?.[userId];
                if (!sessionData || sessionData.courseId !== courseId) {
                    return res.status(400).json({ error: "无效的退出记录" });
                }

                const stayDuration = Math.floor(
                    (Date.now() - sessionData.entryTime) / 1000
                );

                db.query(
                    "SELECT * FROM user_course WHERE userId = ? AND courseId = ?",
                    [userId, courseId],
                    (err, results) => {
                        if (err)
                            return res
                                .status(500)
                                .json({ error: "查询失败", details: err });

                        if (results.length > 0) {
                            db.query(
                                `UPDATE user_course
                                 SET clickCount = clickCount + 1, 
                                     duration = duration + ?,
                                     lastClickTime = NOW()
                                 WHERE userId = ? AND courseId = ?`,
                                [stayDuration, userId, courseId],
                                (updateErr) => {
                                    if (updateErr)
                                        return res
                                            .status(500)
                                            .json({ error: "更新数据失败" });

                                    delete global.userSession[userId];
                                    res.status(200).json({
                                        message: "停留时长已记录",
                                    });
                                }
                            );
                        } else {
                            db.query(
                                `INSERT INTO user_course (userId, courseId, clickCount, duration, lastClickTime)
                                 VALUES (?, ?, 1, ?, NOW())`,
                                [userId, courseId, stayDuration],
                                (insertErr) => {
                                    if (insertErr)
                                        return res
                                            .status(500)
                                            .json({ error: "插入数据失败" });

                                    delete global.userSession[userId];
                                    res.status(200).json({
                                        message: "停留时长已记录",
                                    });
                                }
                            );
                        }
                    }
                );
            } catch (error) {
                res.status(500).json({ error: "记录停留时长失败" });
            }
            break;

        default:
            res.status(400).json({ error: "无效的 action" });
    }
});

// 根据tag筛选推荐课程
router.get("/recommendCourses", (req, res) => {
    const { courseId } = req.query;

    const sql = `
        SELECT * FROM course
        WHERE tag LIKE CONCAT('%', (SELECT tag FROM course WHERE id = ?), '%') 
        AND id != ?
        ORDER BY RAND() 
        LIMIT 5;
    `;

    db.query(sql, [courseId, courseId], (err, results) => {
        if (err)
            return res
                .status(500)
                .json({ error: "数据库查询失败", details: err });
        if (results.length < 1)
            return res.status(404).json({ error: "暂无推荐课程" });

        res.status(200).json({
            message: "获取推荐课程成功！",
            data: results,
        });
    });
});

module.exports = router;
