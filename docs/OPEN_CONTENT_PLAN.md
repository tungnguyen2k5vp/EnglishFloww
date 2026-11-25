# EnglishFlow: nguồn mở và hoàn thiện luồng học

Ngày triển khai: 2026-10-25. Đích: APK Android và bản web hiện có; giữ dữ liệu học, bộ từ và bản sao lưu 1.5.0.

## Bổ sung 1.7.0

Đã nhập tổng cộng 30 bộ/360 từ, 226 câu song ngữ (106 Tatoeba + 120 câu gốc), 35 audio người thật, 18 bài đọc trong catalog mở và 151 mục ghi công. Cộng bài gốc cũ: 22 bài đọc, 38 bài nghe/video. `content/expansion.json` giữ 20 bộ/240 từ, 120 câu, 12 bài đọc, 20 bài ngữ pháp, 12 đề viết và 12 hội thoại tự biên soạn của đợt bổ sung; ID ổn định, không tự thêm vào lịch ôn. 20 audio bổ sung đã duyệt độc lập giấy phép và thời lượng.

Writing tự động dùng từ điển chính tả trích nguồn CC BY-SA sẵn có và quy tắc cục bộ. Mô hình Wav2Vec2 Apache-2.0, lượng tử Q4, và từ điển âm CMU BSD-2-Clause được chuẩn bị bằng `scripts/prepare-assessment.py`. Revision/SHA-256 ghim trong `public/content/assessment-sources.json`; hai giấy phép nằm cùng thư mục và trong APK. Mô hình 241.691.639 byte chỉ đóng gói ở Android, không nằm trong web/precache. APK chạy không có quyền Internet.

Điều kiện phản hồi: chỉ số Writing có bốn tiêu chí minh bạch, không chấm lập luận/đủ ý hoặc band IELTS. Chỉ số âm vị dùng âm học thật, không lấy khớp văn bản STT làm điểm phát âm; chưa hiệu chuẩn bằng đánh giá con người, chưa đo ngữ điệu/trọng âm. Câu ngoài từ điển, quá dài, âm thanh quá nhỏ/vỡ trả lỗi rõ ràng. Những giới hạn này hiện ngay tại luồng học.

| Phần | Nội dung / chức năng triển khai | Điều kiện nhận |
| --- | --- | --- |
| Từ vựng | Bộ từ theo chủ đề, dùng dữ liệu Skypedia đã có; xem trước rồi thêm bộ | ID ổn định, không đổi lịch ôn cũ, nguồn CC BY-SA hiện rõ |
| Câu song ngữ, nghe | API Tatoeba, tác giả và giấy phép từng câu; audio có giấy phép cho phép tái sử dụng | Bản dịch trực tiếp hoặc bản dịch EnglishFlow ghi công, không bị đánh dấu lỗi; loại audio NC/ND/không rõ quyền; duyệt câu trước khi phát hành |
| Đọc hiểu | Bài song ngữ biên tập từ tài liệu NASA và Wikimedia; câu hỏi có lời giải | Nguồn, lịch sử/phiên bản, thay đổi và quyền sử dụng đi kèm |
| Ngữ pháp | Giáo trình tiếng Việt do EnglishFlow biên soạn, ví dụ và bài kiểm tra | Thay nội dung lấy từ APK chưa có quyền phân phối; không nhập HTML từ mạng vào UI |
| Writing | Đề tự biên soạn, lập dàn ý, bản nháp, bộ đếm giờ/từ, checklist và xuất bài | Lưu qua khởi động lại, có thể làm lại, không bịa điểm band |
| Nói | Tình huống có nhiều lượt, gợi ý, nghe mẫu và đường dẫn luyện ghi âm | Chủ đề đã chọn quyết định bài thật; không gọi luồng cố định là AI hội thoại |
| Lộ trình | Nhiệm vụ hằng ngày từ lịch ôn, bài đọc/nghe/ngữ pháp và lịch sử | Hoàn thành dựa trên sự kiện học thật; chuyển đúng màn |
| Nguồn và giấy phép | Trang trong app, credit tại bài, bản kê hash và pipeline có cache | Mọi nội dung nhập có URL gốc, tác giả, giấy phép, thời điểm và thay đổi |
| Phát hành | Kiểm tra dữ liệu, upgrade, backup, luồng, ngoại tuyến, Back/keyboard, APK và ảnh | Không coi compile là kiểm thử; ghi rõ nền tảng đã chạy |

## Quy tắc thu thập

1. Ưu tiên API/export chính thức. Giới hạn số bản ghi, tải tuần tự, có timeout, cache, retry giới hạn và hash. Tôn trọng robots/điều khoản; không vượt chặn hay tài khoản.
2. Chỉ đưa vào gói những nội dung có giấy phép cho phép phân phối và sửa đổi, hoặc nội dung tự biên soạn. Audio/ảnh có quyền riêng với văn bản; không suy quyền từ tên website.
3. CC BY/CC BY-SA giữ tác giả, nguồn, giấy phép và ghi thay đổi. Tác phẩm Gutenberg giữ bản nguồn/giấy phép, kiểm tra tác giả/bản dịch; tải tự động bổ sung từ mirror được phép thay vì crawl trang chính.
4. BBC, British Council, Cambridge, IELTS chính thức: liên kết tới tài nguyên gốc; không đóng gói đề/âm thanh khi chưa có giấy phép. VOA: chỉ dùng khi xác nhận từng hạng mục; không suy rằng mọi ảnh/tin/audio đều là public domain. OpenStax Writing hiện có điều khoản NC-SA: chưa đưa vào gói dùng chung.
5. Không phân phối logo/nhân vật/giáo trình lấy từ APK nếu không có quyền. Giữ chứng cứ tham chiếu trong docs; thay trong bản phát hành bằng tài sản riêng hoặc nguồn có giấy phép.

## Dịch vụ cần cấu hình riêng

AI hội thoại sinh nội dung, đồng bộ tài khoản và thi đấu mạng cần máy chủ, thông tin dịch vụ và chi phí vận hành. Phần lõi ngoại tuyến tiếp tục triển khai trong khi làm rõ lựa chọn này; không đưa khóa API vào APK và không gắn nhãn hoàn thành cho dịch vụ chưa chạy.

## Nguồn chính sách đã kiểm tra

- Tatoeba: https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus ; API https://api.tatoeba.org/openapi.json
- NASA: https://www.nasa.gov/nasa-brand-center/images-and-media/
- Wikimedia: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
- Gutenberg: https://www.gutenberg.org/policy/terms_of_use.html
- IELTS: https://ielts.org/legal/ielts-copyright-and-trade-mark-statement
- OpenStax Writing: https://openstax.org/books/writing-guide/pages/preface

Số lượng, dữ liệu được duyệt và kết quả thực tế được ghi trong manifest và báo cáo phát hành sau khi chạy pipeline.

## Kết quả triển khai 1.6.0

Đã chạy pipeline và tích hợp: 86 câu, 15 audio, 6 bài đọc mới, 10 bộ/120 từ; 108 mục ghi công. Thay giáo trình/tài sản APK trong bản phát hành, thêm Writing, hội thoại hướng dẫn, nhiệm vụ ngày và xuất bản kê. Người dùng đã chọn hoàn thiện ngoại tuyến trước, AI/cloud khi có dịch vụ. Refresh sau này cần duyệt ứng viên và giấy phép từng tài sản trước khi sửa danh sách được phép; APK không tự crawl nguồn. Kết quả kiểm thử và hạn chế nền tảng nằm trong TEST_RESULTS.md.
