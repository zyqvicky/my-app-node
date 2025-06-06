from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)

@app.route("/recommend", methods=["POST"])
def recommend():
    try:
        data = request.get_json()
        user_id = data.get("userId")
        user_data = data.get("userInteractions")  # 当前用户交互数据
        all_courses = data.get("allCourses")  # 课程数据
        all_user_interactions = data.get("allUserInteractions")  # 所有用户交互数据

        if not user_data or len(user_data) < 2:
            return jsonify({
                "recommended_courses": [12, 1],
                "message": "数据不足，返回默认推荐"
            })

        # 数据处理
        df = pd.DataFrame(all_user_interactions)
        df.fillna(0, inplace=True)

        # 编码课程类别、标签和课程ID
        category_encoder = LabelEncoder()
        tag_encoder = LabelEncoder()
        course_encoder = LabelEncoder()

        df["category_encoded"] = category_encoder.fit_transform(df["category"])
        df["tag_encoded"] = tag_encoder.fit_transform(df["tag"])
        df["course_encoded"] = course_encoder.fit_transform(df["courseId"])

        # 计算综合评分
        df["composite_score"] = (df["clickCount"] * 0.3) + (df["duration"] * 0.5) + (df["rating"] * 0.2)

        # 计算协同过滤相似度
        user_matrix = df.pivot_table(index="userId", columns="courseId", values="composite_score").fillna(0)
        similarity_matrix = cosine_similarity(user_matrix)
        similarity_df = pd.DataFrame(similarity_matrix, index=user_matrix.index, columns=user_matrix.index)

        # 找到最相似的 2 个用户
        similar_users = similarity_df[user_id].sort_values(ascending=False).index[1:3] if user_id in similarity_df.index else []

        # 选取最近 5 次交互数据
        df_user = df[df["userId"] == user_id]
        if df_user.empty:
            return jsonify({"recommended_courses": [12, 1], "message": "数据不足，返回默认推荐"})

        user_recent_interactions = df_user.sort_values(by="lastClickTime", ascending=False).head(5)
        user_features = user_recent_interactions[["clickCount", "duration", "rating", "category_encoded", "tag_encoded"]].mean()
        user_features.fillna(0, inplace=True)

        # 训练决策树
        relevant_users = list(similar_users) + [user_id]
        df_filtered = df[df["userId"].isin(relevant_users)]
        X = df_filtered[["clickCount", "duration", "rating", "category_encoded", "tag_encoded"]]
        y = df_filtered["course_encoded"]

        if len(df_filtered["userId"].unique()) < 2:
            return jsonify({"recommended_courses": [12, 1], "message": "数据不足，返回默认推荐"})

        clf = DecisionTreeClassifier(max_depth=5, min_samples_split=2)
        clf.fit(X, y)

        # 预测 Top-3 课程
        user_features_df = pd.DataFrame([user_features], columns=["clickCount", "duration", "rating", "category_encoded", "tag_encoded"])
        course_probabilities = clf.predict_proba(user_features_df)[0]
        top_k = 3
        top_course_indices = np.argsort(course_probabilities)[-top_k:][::-1]
        predicted_courses = course_encoder.inverse_transform(top_course_indices)

        # 协同过滤推荐
        similar_users_courses = df[df["userId"].isin(similar_users)]["courseId"].unique()
        user_courses = df[df["userId"] == user_id]["courseId"].unique()
        collaborative_courses = [course for course in similar_users_courses if course not in user_courses][:3]

        # 合并推荐结果
        # 将预测课程和协同过滤课程的所有课程 ID 转换为 Python 原生 int
        predicted_courses = [int(course) for course in predicted_courses]
        collaborative_courses = [int(course) for course in collaborative_courses]
        # 合并并去重
        final_recommendations = list(set(predicted_courses + collaborative_courses))[:5]

        return jsonify({
            "recommended_courses": list(final_recommendations)
        })

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
