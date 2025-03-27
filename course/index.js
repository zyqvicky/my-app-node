const express = require("express");
const router = express.Router();
const axios = require("axios");
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
                "SELECT tag, category FROM course WHERE id = ?",
                [courseId],
                (err, courseResult) => {
                    if (err) {
                        return res
                            .status(500)
                            .json({ message: "查询课程信息失败", error: err });
                    }

                    const tag =
                        courseResult.length > 0 ? courseResult[0].tag : null;
                    const category =
                        courseResult.length > 0
                            ? courseResult[0].category
                            : null;

                    db.query(
                        "SELECT rating FROM user_course WHERE userId = ? AND courseId = ?",
                        [userId, courseId],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({
                                    message: "数据库查询失败",
                                    error: err,
                                });
                            }

                            if (result.length > 0) {
                                // 已有交互记录，检查是否已经评分
                                if (result[0].rating !== null) {
                                    return res.status(400).json({
                                        message:
                                            "您已评价过该课程，不能重复评分",
                                    });
                                }

                                // 更新评分
                                db.query(
                                    `UPDATE user_course 
                                SET rating = ?, lastClickTime = NOW() 
                                WHERE userId = ? AND courseId = ?`,
                                    [rating, userId, courseId],
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
                            } else {
                                // 没有交互记录，插入新记录（用户可能是直接购买后第一次访问）
                                db.query(
                                    `INSERT INTO user_course (userId, courseId, clickCount, duration, rating, tag, category, lastClickTime) 
                             VALUES (?, ?, 1, 0, ?, ?, ?, NOW())`,
                                    [userId, courseId, rating, tag, category],
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

                // 查询该用户是否已经有该课程的交互记录
                db.query(
                    "SELECT * FROM user_course WHERE userId = ? AND courseId = ?",
                    [userId, courseId],
                    (err, result) => {
                        if (err) {
                            return res.status(500).json({
                                error: "数据库查询失败",
                                details: err,
                            });
                        }

                        if (result.length > 0) {
                            // 如果记录已存在，仅更新 clickCount 和 duration
                            db.query(
                                `UPDATE user_course 
                                     SET clickCount = clickCount + 1, 
                                         duration = duration + ?, 
                                         lastClickTime = NOW() 
                                     WHERE userId = ? AND courseId = ?`,
                                [stayDuration, userId, courseId],
                                (err) => {
                                    if (err)
                                        return res.status(500).json({
                                            error: "更新数据失败",
                                            details: err,
                                        });

                                    delete global.userSession[userId];
                                    res.status(200).json({
                                        message: "停留时长已记录",
                                    });
                                }
                            );
                        } else {
                            // 如果没有记录，查询课程的 tag 和 category
                            db.query(
                                "SELECT tag, category FROM course WHERE id = ?",
                                [courseId],
                                (err, courseResult) => {
                                    if (err) {
                                        return res.status(500).json({
                                            error: "查询课程信息失败",
                                            details: err,
                                        });
                                    }

                                    const tag =
                                        courseResult.length > 0
                                            ? courseResult[0].tag
                                            : null;
                                    const category =
                                        courseResult.length > 0
                                            ? courseResult[0].category
                                            : null;

                                    // 插入新记录
                                    db.query(
                                        `INSERT INTO user_course (userId, courseId, clickCount, duration, tag, category, lastClickTime) 
                                             VALUES (?, ?, 1, ?, ?, ?, NOW())`,
                                        [
                                            userId,
                                            courseId,
                                            stayDuration,
                                            tag,
                                            category,
                                        ],
                                        (err) => {
                                            if (err)
                                                return res.status(500).json({
                                                    error: "插入数据失败",
                                                    details: err,
                                                });

                                            delete global.userSession[userId];
                                            res.status(200).json({
                                                message: "停留时长已记录",
                                            });
                                        }
                                    );
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

// 获取全部课程、所有用户的交互数据、单个用户的交互数据，并发送给 Python 计算推荐
router.get("/getRecommendations", async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: "缺少 userId 参数" });
    }

    try {
        // 查询所有课程
        const allCourses = await new Promise((resolve, reject) => {
            db.query("SELECT * FROM course", (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });

        // 查询所有用户的交互数据
        const allUserInteractions = await new Promise((resolve, reject) => {
            db.query(
                "SELECT userId, courseId, rating, clickCount, duration, tag, category FROM user_course",
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });

        // 查询当前用户的交互数据
        const userInteractions = allUserInteractions.filter(
            (item) => item.userId === userId
        );

        if (userInteractions.length < 5) {
            return res.status(404).json({
                recommended_courses: ["Python入门", "Java Web开发"],
                message: "数据不足，返回默认推荐",
            });
        }

        // 发送数据到 Python Flask 服务器
        const response = await axios.post("http://127.0.0.1:5000/recommend", {
            userId,
            userInteractions, // 当前用户的交互数据
            allCourses, // 所有课程数据
            allUserInteractions, // 所有用户的交互数据
        });

        res.status(200).json({
            message: "推荐成功！",
            recommendedCourses: response.data.recommended_courses,
            predicted_category: response.data.predicted_category,
        });
    } catch (error) {
        res.status(500).json({
            error: "获取推荐失败",
            details: error.message,
        });
    }
});

module.exports = router;
