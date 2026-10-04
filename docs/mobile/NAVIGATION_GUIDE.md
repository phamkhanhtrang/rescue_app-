# 📱 Hướng dẫn Điều hướng Sau Login (Login → HomeScreen)

## 🎯 Quy trình hoạt động

### 1. **Cấu trúc Navigation Hiện tại**

```
RootNavigator
├── userRole === null
│   └── AuthStack
│       ├── Welcome (chọn vai trò)
│       ├── CitizenLogin ⬅️ BẠN ĐANG Ở ĐÂY
│       ├── CitizenRegister
│       ├── RescuerLogin
│       └── RescuerRegister
│
├── userRole === 'CITIZEN'
│   └── CitizenStack
│       ├── CitizenTabs (BottomTabNavigator)
│       │   ├── Home 🏠 ← ĐIỀU HƯỚNG ĐẾN ĐÂY SAU LOGIN
│       │   ├── Map 🗺️
│       │   ├── Alerts ⚠️
│       │   └── Profile 👤
│       ├── SOSScreen (Modal)
│       └── SOSConfirmScreen (Modal)
│
└── userRole === 'RESCUER'
    └── RescuerStack
        ├── ...
```

### 2. **Các bước Login → HomeScreen**

```
┌─────────────────────────────────────────────────────────┐
│ User nhấn nút "ĐĂNG NHẬP" trên CitizenLoginScreen      │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Gọi API: API.auth.login({ login_input, password })     │
│ ✅ Response: { ok: true, data: { access, refresh, user } }
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Gọi signIn('CITIZEN', user, access)                     │
│ - Lưu user vào state: setUserInfo(user)                 │
│ - Lưu token vào AsyncStorage: 'userToken' = access      │
│ - Lưu user vào AsyncStorage: 'userData' = JSON user     │
│ - CỰC KỲ QUAN TRỌNG: Cập nhật role = 'CITIZEN'          │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ RootNavigator phát hiện userRole !== null              │
│ (từ AuthContext)                                       │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ AuthStack bị ẩn, CitizenStack được render              │
│ CitizenStack mặc định render CitizenTabs               │
│ CitizenTabs mặc định render Home tab = HomeScreen 🎉   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Chi tiết Implementation

### **AuthContext.js** - Quản lý trạng thái toàn app

```javascript
// State
const [userRole, setUserRole] = useState(null); // null | 'CITIZEN' | 'RESCUER'
const [userInfo, setUserInfo] = useState(null); // Thông tin user
const [userToken, setUserToken] = useState(null); // Access token
const [isLoading, setIsLoading] = useState(false);

// Hàm signIn
const signIn = async (role, info = {}, token) => {
  setIsLoading(true);
  try {
    // 1. Lưu vào bộ nhớ (AsyncStorage)
    if (token) {
      await AsyncStorage.setItem("userToken", token);
    }
    if (info) {
      await AsyncStorage.setItem("userData", JSON.stringify(info));
    }

    // 2. CẬP NHẬT STATE ← ĐÂY LÀ TRIGGER ĐIỀU HƯỚNG
    setUserToken(token);
    setUserInfo(info);
    setUserRole(role); // ← NÓI VỚI RootNavigator: "Render CitizenStack đi!"
  } finally {
    setIsLoading(false);
  }
};

// Hàm signOut
const signOut = async () => {
  setIsLoading(true);
  try {
    // 1. Xóa từ bộ nhớ
    await AsyncStorage.removeItem("userToken");
    await AsyncStorage.removeItem("userData");
    await AsyncStorage.removeItem("refreshToken");

    // 2. CẬP NHẬT STATE ← TRIGGER QUAY LẠI LOGIN
    setUserToken(null);
    setUserInfo(null);
    setUserRole(null); // ← NÓI VỚI RootNavigator: "Render AuthStack đi!"
  } finally {
    setIsLoading(false);
  }
};
```

### **RootNavigator.js** - Quyết định cái gì được render

```javascript
const RootNavigator = () => {
  const { userRole, isLoading } = useAuth();

  // Đang kiểm tra auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {userRole === null && <AuthStack />} {/* Chưa login */}
      {userRole === "CITIZEN" && <CitizenStack />}{" "}
      {/* ← RENDER CITIZEN STACK */}
      {userRole === "RESCUER" && <RescuerStack />} {/* Rescuer */}
    </NavigationContainer>
  );
};
```

### **CitizenLoginScreen.js** - Gọi signIn đúng cách

```javascript
const handleLogin = async () => {
  setLoading(true);
  try {
    // 1. Gọi API đăng nhập
    const result = await API.auth.login({
      login_input: data,
      password: password,
    });

    if (result.ok) {
      const { access, refresh, user } = result.data;

      // 2. GỌI signIn ← ĐỘC LẬP LƯU DỮ LIỆU VÀ TRIGGER ĐIỀU HƯỚNG
      await signIn("CITIZEN", user, access);

      // 3. Lưu refresh token nếu cần
      if (refresh) {
        await AsyncStorage.setItem("refreshToken", refresh);
      }
      // 🎉 Lúc này AuthContext sẽ cập nhật userRole → RootNavigator render CitizenStack
    } else {
      const errorMsg = result.data?.error || result.message;
      setError(errorMsg);
    }
  } catch (e) {
    setError("Sai thông tin đăng nhập.");
  } finally {
    setLoading(false);
  }
};
```

---

## ✅ Checklist

- [x] AuthContext có `signIn(role, info, token)` - lưu vào AsyncStorage + cập nhật state
- [x] CitizenLoginScreen gọi `signIn('CITIZEN', user, access)` sau khi API thành công
- [x] RootNavigator lắng nghe `userRole` từ AuthContext
- [x] Khi `userRole = 'CITIZEN'`, AuthStack bị ẩn, CitizenStack được render
- [x] CitizenStack mặc định render Home (HomeScreen)
- [x] Signout gọi `signOut()` để quay lại AuthStack

---

## 🧪 Kiểm Tra

### **Test 1: Login Demo**

1. Nhấn nút "⚡ Đăng nhập Demo (Bỏ qua)" trên CitizenLoginScreen
2. ✅ Kỳ vọng: Điều hướng ngay tới HomeScreen

### **Test 2: Login Thực Tế**

1. Nhập số điện thoại/email và mật khẩu
2. Nhấn "ĐĂNG NHẬP"
3. ✅ Kỳ vọng: Nếu API trả về `{ ok: true, data: {...} }`, điều hướng ngay tới HomeScreen

### **Test 3: Login Thất Bại**

1. Nhập thông tin sai
2. Nhấn "ĐĂNG NHẬP"
3. ✅ Kỳ vọng: Hiển thị lỗi, ở lại CitizenLoginScreen

### **Test 4: Logout**

1. Ở HomeScreen, nhấn nút logout (ở ProfileScreen)
2. ✅ Kỳ vọng: Quay lại AuthStack → WelcomeScreen

---

## 🎯 Tổng kết

| Bước | File                  | Hành động                                                         |
| ---- | --------------------- | ----------------------------------------------------------------- |
| 1️⃣   | CitizenLoginScreen.js | Gọi API + `signIn('CITIZEN', user, token)`                        |
| 2️⃣   | AuthContext.js        | `signIn()` lưu vào AsyncStorage + cập nhật `userRole = 'CITIZEN'` |
| 3️⃣   | RootNavigator.js      | Phát hiện `userRole !== null`, render CitizenStack                |
| 4️⃣   | CitizenStack.js       | Render CitizenTabs mặc định → Home tab                            |
| 5️⃣   | HomeScreen.js         | 🎉 Hiển thị Home                                                  |
