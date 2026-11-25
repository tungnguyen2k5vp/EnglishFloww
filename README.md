# EnglishFlow 1.7.0

Ứng dụng học tiếng Anh ngoại tuyến cho Android, dùng React + TypeScript + Vite trong WebView Android. Bản dựng độc lập, có nội dung tự biên soạn và nguồn mở ghi rõ tác giả/giấy phép. Không dùng máy chủ hay tài khoản của 4English.

## Cài thử

Build Android tạo `releases/EnglishFlow-Android-1.7.0.apk` để cài thử trên Android 9 trở lên. APK khoảng 308 MB vì đóng gói mô hình phát âm ngoại tuyến. Package `com.englishflow.mobile` dùng chữ ký debug. Cài đè bằng APK cùng chữ ký giữ dữ liệu học.

[Xem ảnh bản cài mới](releases/Learning-preview-1.7.0.jpg) · [Kết quả kiểm thử](docs/TEST_RESULTS.md) · [SHA-256 và bằng chứng](releases/verification-1.7.0.json).

## Có thể học ngay

- Từ điển 104.703 mục từ / 175.735 nghĩa, nhận diện dạng từ và chọn nghĩa khi nhập danh sách. UK/US TTS dùng giọng ngoại tuyến đã cài trong Android.
- 7 bộ từ ban đầu và 30 bộ chủ đề với 360 từ có nghĩa/ví dụ được biên tập. Xem trước rồi thêm vào thư viện; lọc theo trình độ. Nhập → tra → sửa/xóa/khôi phục từ nháp → nhấn Thêm từ mới lưu chính thức.
- Học từ mới, luyện nghe/viết/ngữ cảnh, flashcards và lịch ôn SM-2; phiên đang học khôi phục được, Back không lặp chi tiết–học.
- 22 bài đọc song ngữ có tra từ, dịch, đánh dấu và câu hỏi. Sáu bài tham khảo NASA/Wikimedia có nguồn và thay đổi; 12 bài bổ sung tự biên soạn về đời sống.
- 38 bài nghe/video: 3 bài gốc dùng lời đọc tổng hợp và 35 câu thu âm Tatoeba có giấy phép riêng. Transcript, tua, tốc độ, lặp, điền từ, trắc nghiệm, lọc trình độ/chủ đề và shadowing.
- 226 câu song ngữ theo chủ đề: tra từ, lọc trình độ, hiện/ẩn nghĩa, nghe bản thu khi có hoặc giọng hệ thống, tự gõ lại câu.
- 60 bài ngữ pháp trong 10 nhóm, giải thích, ví dụ, bài kiểm tra và lời giải do EnglishFlow biên soạn.
- 20 đề viết A2–B2: dàn ý, bản nháp tự lưu, đếm giờ/từ, nộp bài, bài minh họa và xuất văn bản. Chấm cục bộ bằng từ điển 84.921 từ và các quy tắc: chính tả, lỗi ngữ pháp phổ biến, độ dài, cấu trúc đo được và đa dạng từ. Áp dụng từng gợi ý rồi chấm lại. Chưa đánh giá sâu lập luận/đáp ứng đề hoặc quy đổi band IELTS.
- 18 hội thoại hướng dẫn, mỗi tình huống 4 lượt riêng. Ghi âm tối đa 30 giây và nghe lại. APK chấm bản ghi 0,4–15 giây bằng mô hình âm vị Wav2Vec2 + CMU, trả phản hồi từng từ/âm và lưu lịch sử luyện. Chỉ số thực nghiệm chưa hiệu chuẩn với giáo viên; không chấm ngữ điệu hay câu trả lời tự do. Bản ghi ở vùng riêng của app, bị bỏ khi đóng Activity hoặc mở lần sau; không tải lên mạng.
- Kế hoạch hằng ngày dựa trên trình độ, từ đến hạn và sự kiện học thật. Tiến độ, thời gian, chuỗi học, mục tiêu, giao diện sáng/tối, sao lưu/khôi phục có kiểm tra dữ liệu.
- Nối từ với máy hoặc hai người luân phiên trên một điện thoại. Ba sách văn học đầy đủ giữ thông báo nguồn Gutenberg.

AI sinh hội thoại, đồng bộ tài khoản và thi đấu mạng được để lại cho giai đoạn có dịch vụ, theo lựa chọn của người dùng. Các bài luyện kỹ năng IELTS là bài độc lập; liên kết tài nguyên chính thức mở trong trình duyệt.

## Nguồn dữ liệu

[Kế hoạch và điều kiện nhập](docs/OPEN_CONTENT_PLAN.md). [Danh mục](public/content/catalog.json), [bản kê truy xuất/hash/giấy phép](public/content/manifest.json), [từ điển và ghi công upstream](public/dictionary/ATTRIBUTION.md), [font OFL](public/fonts/OFL.txt).

Mô hình âm vị Apache-2.0 và CMU Dictionary BSD-2-Clause được ghim revision/hash trong [assessment-sources.json](public/content/assessment-sources.json). Trọng số chỉ nằm trong APK; web không tải mô hình Android. [Phương pháp và phạm vi kiểm thử](docs/TEST_RESULTS.md).

API Tatoeba cung cấp câu và audio có quyền độc lập. NASA chỉ dùng làm tài liệu sự kiện cho bài tự biên soạn; Wikimedia giữ ghi công và ShareAlike cho bản thích nghi. Không đóng gói đề IELTS/BBC/British Council/Cambridge hoặc ảnh/logos không được cấp phép. Tài sản trích APK cũ đã chuyển ra ngoài `public`, chỉ giữ trong thư mục chứng cứ cục bộ. Đồ họa mới do EnglishFlow vẽ; font Inter Tight lấy từ Google Fonts có OFL và commit/hash.

```powershell
# Tạo lại thư viện đã duyệt từ cache có hash
python scripts/import-open-content.py
# Chuẩn bị mô hình phát âm trước khi build Android (cần mạng ở máy build)
python scripts/prepare-assessment.py
# Lấy ứng viên từ API theo giới hạn; cần duyệt lại trước khi đưa vào editorial.json
python scripts/import-open-content.py --fetch
```

Không có crawler vô hạn hoặc lịch tải nền trong APK. Pipeline có allowlist HTTPS, timeout, giới hạn dung lượng/số lượng, cache, kiểm hash và retry giới hạn. Các ID và mức A2–B2 là lựa chọn biên tập, không phải chứng nhận CEFR.

## Chạy và kiểm thử

Node 22.19+/24.11+, npm; Chrome cho kiểm thử trình duyệt. Android cần JDK 17–22 và SDK 36.

Dữ liệu học đã có sẵn trong `public/`. Chạy script nhập nội dung khi cần biên tập lại thư viện. Để build Android lần đầu sau khi clone, chạy `python scripts/prepare-assessment.py` để tải mô hình đã ghim phiên bản và SHA-256.

```powershell
npm ci
npm run dev
# http://127.0.0.1:5178/mobile.html
npm test
npm run build
npm run preview
npm run test:learning
npm run test:assessment
npm run test:mobile
npm run test:vocabulary
npm run test:dictionary
npm run test:collection-editor
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-19'
python scripts/prepare-assessment.py
npm run build:android
# Trên máy ảo đã cài APK, không dùng các bài kiểm tra ghi dữ liệu này trên máy cá nhân:
$env:ANDROID_TEST_SERIAL = 'emulator-5556'
npm run test:assessment
npm run test:learning
npm run test:collection-editor
npm run test:android
```

Android đóng gói toàn bộ nội dung, không yêu cầu quyền Internet. Web production cache nội dung/media/font sau lần mở đầu; các shard từ điển web cache sau khi được tra. Bản Android có đầy đủ shard sẵn. Bản web desktop dùng chung dữ liệu; màn luyện viết/nói/kế hoạch mới ở `/mobile.html`.

## Dữ liệu và giới hạn đã biết

Android dùng SharedPreferences làm bản chuẩn, commit trước khi cập nhật UI; localStorage là cache. Trình duyệt dùng localStorage `englishflow.v1`. Backup phiên bản 1 vẫn đọc được; trường Writing là phần mở rộng có kiểm tra độ dài/kiểu dữ liệu. Hồ sơ, từ và bài viết nằm cục bộ; không tự đồng bộ thiết bị.

Kết quả thực chạy, nền tảng, SHA-256 và ảnh: [báo cáo kiểm thử](docs/TEST_RESULTS.md), [trạng thái triển khai](docs/IMPLEMENTATION_STATUS.md). Chưa kiểm thử iOS, TalkBack, xoay màn hình và Android API 28 trong cập nhật này; giọng TTS phụ thuộc gói giọng cài trên máy. Nội dung và ghi âm cần rà soát sư phạm thêm khi mở rộng phát hành công khai.
