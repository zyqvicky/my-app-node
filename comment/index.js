const express = require("express");
const router = express.Router();
const db = require("../db/index");

// 根据课程id获取评论列表
router.get("/getComments", (req, res) => {
    const { courseId, userId } = req.query;

    const sql = `
        SELECT 
            comment.id,
            comment.content,
            comment.likeNum,
            comment.commentTime,
            comment.parentCommentId,
            user.id AS userId,
            user.username AS username,
            user.avatar AS avatar,
            CASE 
                WHEN likes.id IS NOT NULL THEN true 
                ELSE false 
            END AS liked
        FROM comment
        JOIN user ON comment.userId = user.id
        LEFT JOIN likes ON comment.id = likes.commentId AND likes.userId = ?
        WHERE comment.courseId = ?
        ORDER BY comment.commentTime DESC
    `;

    db.query(sql, [userId, courseId], (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "评论列表获取失败",
                error: err,
            });
        }

        return res.status(200).json({
            message: "评论列表获取成功",
            comments: result,
        });
    });
});

// 点赞完整逻辑
router.post("/like", (req, res) => {
    const { commentId, userId } = req.body;

    const checkLikeSql = `SELECT * FROM likes WHERE commentId = ? AND userId = ?`;

    db.query(checkLikeSql, [commentId, userId], (err, results) => {
        if (err) {
            return res
                .status(500)
                .json({ message: "查询点赞状态失败", error: err });
        }

        if (results.length > 0) {
            // 取消点赞
            const deleteLikeSql = `DELETE FROM likes WHERE commentId = ? AND userId = ?`;
            db.query(deleteLikeSql, [commentId, userId], (err) => {
                if (err) {
                    return res
                        .status(500)
                        .json({ message: "取消点赞失败", error: err });
                }

                // 点赞数减1
                const updateSql = `UPDATE comment SET likeNum = likeNum - 1 WHERE id = ?`;
                db.query(updateSql, [commentId], (err) => {
                    if (err) {
                        return res
                            .status(500)
                            .json({ message: "更新点赞数失败", error: err });
                    }

                    // 返回最新的点赞数
                    db.query(
                        `SELECT likeNum FROM comment WHERE id = ?`,
                        [commentId],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({
                                    message: "查询点赞量失败",
                                    error: err,
                                });
                            }
                            return res.status(200).json({
                                message: "取消点赞成功",
                                likeNum: result[0].likeNum,
                                liked: false,
                            });
                        }
                    );
                });
            });
        } else {
            // 添加点赞
            const insertLikeSql = `INSERT INTO likes (commentId, userId) VALUES (?, ?)`;
            db.query(insertLikeSql, [commentId, userId], (err) => {
                if (err) {
                    return res
                        .status(500)
                        .json({ message: "点赞失败", error: err });
                }

                // 点赞数加1
                const updateSql = `UPDATE comment SET likeNum = likeNum + 1 WHERE id = ?`;
                db.query(updateSql, [commentId], (err) => {
                    if (err) {
                        return res
                            .status(500)
                            .json({ message: "更新点赞数失败", error: err });
                    }

                    // 返回最新的点赞数
                    db.query(
                        `SELECT likeNum FROM comment WHERE id = ?`,
                        [commentId],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({
                                    message: "查询点赞量失败",
                                    error: err,
                                });
                            }
                            return res.status(200).json({
                                message: "点赞成功",
                                likeNum: result[0].likeNum,
                                liked: true,
                            });
                        }
                    );
                });
            });
        }
    });
});

// 发表评论
router.post("/addComment", (req, res) => {
    const { content, courseId, userId, parentCommentId } = req.body;

    const insertSql = `
        INSERT INTO comment (content, courseId, userId, parentCommentId, commentTime, likeNum)
        VALUES (?, ?, ?, ?, NOW(), 0)
    `;

    db.query(
        insertSql,
        [content, courseId, userId, parentCommentId],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "评论发表失败",
                    error: err,
                });
            }

            return res.status(200).json({
                message: "评论发表成功",
                commentId: result.insertId,
            });
        }
    );
});

// 回复其他评论
router.post("/replyComment", (req, res) => {
    const { content, courseId, userId, parentCommentId, targetUserId } =
        req.body;

    const insertSql = `
        INSERT INTO comment (content, courseId, userId, parentCommentId, commentTime, likeNum, targetUserId)
        VALUES (?, ?, ?, ?, NOW(), 0, ?)
    `;

    db.query(
        insertSql,
        [content, courseId, userId, parentCommentId, targetUserId],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "评论发表失败",
                    error: err,
                });
            }

            const insertMessageSql = `
                INSERT INTO message (type, title, content, status, userId, senderId, courseId)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertMessageSql,
                [
                    "comment",
                    "新消息",
                    content,
                    0, // 未读状态
                    targetUserId, // 收到评论的用户ID
                    userId, // 发送评论的用户ID
                    courseId, // 课程ID
                ],
                (msgErr) => {
                    if (msgErr) {
                        return res.status(500).json({
                            message: "评论成功，但消息通知失败",
                            error: msgErr,
                        });
                    }

                    return res.status(200).json({
                        message: "评论发表成功，消息通知已发送",
                    });
                }
            );
        }
    );
});

// 根据id获取消息列表
router.get("/getMessages", (req, res) => {
    const { userId } = req.query;

    const sql = `
        SELECT 
            message.id AS messageId,
            MIN(comment.id) AS commentId,
            message.type,
            message.title,
            message.content,
            message.status,
            message.courseId,
            user.id AS userId,
            user.username AS username,
            user.avatar AS avatar
        FROM message
        JOIN user ON message.userId = user.id
        LEFT JOIN comment ON message.courseId = comment.courseId 
                        AND message.userId = comment.targetUserId
        WHERE message.userId = ?
        GROUP BY message.id;
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            return res.status(500).json({
                message: "消息列表获取失败",
                error: err,
            });
        }

        return res.status(200).json({
            message: "消息列表获取成功",
            data: result,
        });
    });
});

// 标记消息已读
router.post("/readMessage", (req, res) => {
    const { messageId } = req.body;

    const updateSql = `UPDATE message SET status = 1 WHERE id = ?`;

    db.query(updateSql, [messageId], (err) => {
        if (err) {
            return res.status(500).json({
                message: "标记消息已读失败",
                error: err,
            });
        }

        return res.status(200).json({
            message: "标记消息已读成功",
        });
    });
});

module.exports = router;
