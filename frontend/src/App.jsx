import Contact from './pages/Contact';
import AdminContacts from './pages/admin/AdminContacts';
import AdminContactDetail from './pages/admin/AdminContactDetail';
import AdminReviews from './pages/admin/AdminReviews';
import OrderReview from './engagement/OrderReview';
import './styles/engagement.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CartToast from "./components/CartToast";
import WishlistToast from "./components/WishlistToast";
import MainLayout from "./layouts/MainLayout";
import Account from "./pages/Account";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import TestCategories from "./pages/TestCategories";
import Wishlist from "./pages/Wishlist";
import LegacyProductRedirect from "./components/LegacyProductRedirect";
import PlaceholderPage from "./pages/PlaceholderPage";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import "./assets/styles/thewayshop-gems.css";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AdminRoute from "./components/AdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import ChangePassword from "./pages/ChangePassword";
import OrderHistory from "./pages/OrderHistory";
import OrderDetail from "./pages/OrderDetail";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";

function App() {
  return (
    <BrowserRouter>
      <div className="cart-toast-region"><CartToast /><WishlistToast /></div>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          {[['/kien-thuc', 'Kiến thức'], ['/hen-lich', 'Hẹn lịch'], ['/ho-tro', 'Hỗ trợ']].map(([path, title]) => <Route key={path} path={path} element={<PlaceholderPage title={title} />} />)}
          <Route path="/lien-he" element={<Contact />} />
          <Route path="/shop" element={ <Products /> } />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/payment/:id" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/review-product/:id" element={<ProtectedRoute><OrderReview /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          {/* Sản phẩm lấy từ API (feature-product) */}
          <Route path="/products" element={<LegacyProductRedirect />} />
          <Route path="/products/:id" element={<LegacyProductRedirect />} />
        </Route>

        <Route path="/test-categories" element={<TestCategories />} />
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>}/>
        {/* Trang quản trị sản phẩm / danh mục */}
        <Route path="/admin/products" element={<AdminRoute> <AdminProducts /> </AdminRoute>} />
        <Route path="/admin/products/create" element={<AdminRoute> <AdminProductForm /> </AdminRoute>} />
        <Route path="/admin/products/edit/:id" element={<AdminRoute> <AdminProductForm /> </AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute> <AdminCategories /> </AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/contacts" element={<AdminRoute><AdminContacts /></AdminRoute>} />
        <Route path="/admin/contacts/:id" element={<AdminRoute><AdminContactDetail /></AdminRoute>} />
        <Route path="/admin/reviews" element={<AdminRoute><AdminReviews /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/orders/:id" element={<AdminRoute><AdminOrderDetail /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
