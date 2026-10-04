1\. Quản lý Người dùng và Phân quyền (Users \& Roles)

Bảng này lưu trữ thông tin chung cho cả ba đối tượng: Người dân, Đội cứu trợ và Admin

.

CREATE TABLE Users (

&#x20;   user\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   phone\_number VARCHAR(15) UNIQUE NOT NULL,

&#x20;   full\_name VARCHAR(100),

&#x20;   email VARCHAR(100) UNIQUE,

&#x20;   password\_hash VARCHAR(255), -- Cho Admin/Đội cứu trợ

&#x20;   role ENUM('CITIZEN', 'RELIEF\_TEAM', 'ADMIN') NOT NULL,

&#x20;   is\_verified BOOLEAN DEFAULT FALSE, -- Phê duyệt đội cứu trợ \[3, 5]

&#x20;   emergency\_contact VARCHAR(15), -- Liên hệ khẩn cấp cho người dân \[6, 7]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP

);

2\. Quản lý Đội cứu trợ (Relief Teams)

Lưu trữ thông tin chuyên biệt về năng lực và phương tiện của các đội

.

CREATE TABLE ReliefTeams (

&#x20;   team\_id INT PRIMARY KEY,

&#x20;   user\_id INT,

&#x20;   organization\_name VARCHAR(150),

&#x20;   vehicle\_type EN\_VEHICLE (TRUCK, CANOE, BOAT, AMBULANCE), -- Loại phương tiện \[9, 10]

&#x20;   transport\_capacity TEXT, -- Khả năng vận chuyển

&#x20;   current\_lat DECIMAL(10, 8), -- Vị trí GPS realtime \[11, 12]

&#x20;   current\_lng DECIMAL(11, 8),

&#x20;   status ENUM('AVAILABLE', 'MOVING', 'RESPONDING', 'OFFLINE') DEFAULT 'AVAILABLE',

&#x20;   FOREIGN KEY (user\_id) REFERENCES Users(user\_id)

);

3\. Vùng cứu hộ (Rescue Zones)

Đây là thực thể trung tâm của hệ thống, nơi gom cụm các yêu cầu SOS đơn lẻ

.

CREATE TABLE RescueZones (

&#x20;   zone\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   zone\_name VARCHAR(100),

&#x20;   center\_lat DECIMAL(10, 8),

&#x20;   center\_lng DECIMAL(11, 8),

&#x20;   radius\_meters INT DEFAULT 300, -- Bán kính gom cụm AI \[17, 18]

&#x20;   severity\_level ENUM('RED', 'YELLOW', 'GREEN') DEFAULT 'YELLOW', -- Mức độ nghiêm trọng \[15, 19, 20]

&#x20;   status ENUM('WAITING\_FOR\_TEAM', 'RESPONDING', 'PARTIALLY\_STABILIZED', 'STABILIZED', 'NEEDS\_MORE\_SUPPORT') DEFAULT 'WAITING\_FOR\_TEAM', \[5, 21, 22]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   updated\_at TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP

);

4\. Yêu cầu cứu hộ SOS (SOS Requests)

Lưu trữ các tín hiệu cầu cứu từ người dân

.

CREATE TABLE SOSRequests (

&#x20;   sos\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   user\_id INT NULL, -- Có thể NULL nếu gửi ẩn danh \[1, 7]

&#x20;   zone\_id INT, -- Liên kết vào vùng cứu hộ sau khi AI/Admin xử lý \[23, 24]

&#x20;   latitude DECIMAL(10, 8) NOT NULL,

&#x20;   longitude DECIMAL(11, 8) NOT NULL,

&#x20;   need\_type SET('RESCUE', 'FOOD', 'MEDICAL') NOT NULL, -- Loại nhu cầu \[6, 25]

&#x20;   description TEXT,

&#x20;   image\_url VARCHAR(255), -- Hình ảnh hiện trường \[23, 25]

&#x20;   is\_offline\_sent BOOLEAN DEFAULT FALSE, -- Đánh dấu nếu gửi từ chế độ Offline \[26, 27]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (user\_id) REFERENCES Users(user\_id),

&#x20;   FOREIGN KEY (zone\_id) REFERENCES RescueZones(zone\_id)

);

5\. Điều phối và Tham gia (Participation \& Coordination)

Quản lý việc đội cứu trợ tham gia vào các vùng theo vai trò cụ thể

.

CREATE TABLE ZoneParticipation (

&#x20;   participation\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   team\_id INT,

&#x20;   zone\_id INT,

&#x20;   assigned\_role ENUM('RESCUE', 'SUPPLY', 'MEDICAL') NOT NULL, -- Vai trò cụ thể \[19, 28]

&#x20;   joined\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   status ENUM('ON\_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED') DEFAULT 'ON\_WAY',

&#x20;   FOREIGN KEY (team\_id) REFERENCES ReliefTeams(team\_id),

&#x20;   FOREIGN KEY (zone\_id) REFERENCES RescueZones(zone\_id)

);

6\. Cập nhật trạng thái và Theo dõi (Tracking \& Updates)

Lưu trữ các bản tin cập nhật định kỳ từ hiện trường

.

CREATE TABLE StatusUpdates (

&#x20;   update\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   zone\_id INT,

&#x20;   team\_id INT,

&#x20;   reported\_status ENUM('UNREACHABLE', 'RESPONDING', 'PARTIALLY\_STABILIZED', 'STABILIZED', 'NEED\_SUPPORT'), \[31-33]

&#x20;   note TEXT, -- Ghi chú nhanh \[32]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (zone\_id) REFERENCES RescueZones(zone\_id),

&#x20;   FOREIGN KEY (team\_id) REFERENCES ReliefTeams(team\_id)

);



**-- Theo dõi lịch sử di chuyển GPS để Admin giám sát \[11, 12, 20]**

CREATE TABLE GPSHistory (

&#x20;   history\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   team\_id INT,

&#x20;   latitude DECIMAL(10, 8),

&#x20;   longitude DECIMAL(11, 8),

&#x20;   recorded\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (team\_id) REFERENCES ReliefTeams(team\_id)

);

7\. Tương tác cộng đồng và Thông báo (Community \& Notifications)

Hỗ trợ xác thực thông tin và gửi cảnh báo

.

CREATE TABLE CommunityVerifications (

&#x20;   verification\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   zone\_id INT,

&#x20;   user\_id INT,

&#x20;   is\_accurate BOOLEAN, -- Xác nhận tin SOS đúng hay sai \[36, 37]

&#x20;   current\_condition ENUM('DANGEROUS', 'ASSISTED', 'STABILIZED'), -- Tình trạng thực tế \[36, 37]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (zone\_id) REFERENCES RescueZones(zone\_id),

&#x20;   FOREIGN KEY (user\_id) REFERENCES Users(user\_id)

);



CREATE TABLE Notifications (

&#x20;   notification\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   receiver\_id INT, -- ID người nhận (NULL nếu gửi toàn hệ thống) \[38, 39]

&#x20;   target\_zone\_id INT NULL, -- Thông báo theo vùng \[3, 38, 39]

&#x20;   title VARCHAR(200),

&#x20;   message TEXT,

&#x20;   priority ENUM('URGENT', 'NORMAL') DEFAULT 'NORMAL', -- Mức độ ưu tiên \[39, 40]

&#x20;   created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,

&#x20;   FOREIGN KEY (receiver\_id) REFERENCES Users(user\_id)

);

**8. Minh bạch và Blockchain (Transparency Logs)**

Lưu trữ các bản ghi để đối soát trên Blockchain

.

CREATE TABLE BlockchainLogs (

&#x20;   log\_id INT PRIMARY KEY AUTO\_INCREMENT,

&#x20;   transaction\_hash VARCHAR(255), -- Mã giao dịch trên Blockchain

&#x20;   entity\_type ENUM('SOS\_REQUEST', 'ZONE\_STABILIZED', 'RESOURCE\_ALLOCATED'),

&#x20;   entity\_id INT, -- ID của bản ghi tương ứng trong DB

&#x20;   action\_description TEXT,

&#x20;   timestamp TIMESTAMP DEFAULT CURRENT\_TIMESTAMP

);

