# AppAI/Dockerfile (Phiên bản đơn giản hóa, 1 stage)

# Sử dụng một base image Python gọn nhẹ
FROM python:3.9-slim






RUN apt-get update && \
    apt-get install -y curl libgl1

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép file requirements.txt trước
COPY requirements.txt .

# Cài đặt các thư viện cần thiết. 
# Bước này sẽ cài cả thư viện và file thực thi (gunicorn) vào đúng chỗ.
RUN pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn và các model của ứng dụng AI
COPY . .

# Mở cổng 5001
EXPOSE 5001

# Lệnh để chạy ứng dụng (sẽ hoạt động vì gunicorn đã được cài đặt vào $PATH)
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "ai_service:app"]