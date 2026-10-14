# Stage 1: ビルド
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
# 依存関係の解決に必要なファイルだけ先にコピーする。
# ソースコードより先にこの層を作ることで、ソースだけを直した時は
# このレイヤーのキャッシュが効き、依存関係の再ダウンロードが走らない
COPY gradle/ gradle/
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon
COPY src/ src/
RUN ./gradlew bootJar --no-daemon

# Stage 2: 実行
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
