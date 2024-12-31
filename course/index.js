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

module.exports = router;
