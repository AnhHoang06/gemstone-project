import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Account from "./pages/Account";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import TestCategories from "./pages/TestCategories";
import Wishlist from "./pages/Wishlist";
import ProductListApi from "./pages/ProductListApi";
import ProductDetailApi from "./pages/ProductDetailApi";
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
import ChangePassword from "./pages/ChangePassword";
import OrderHistory from "./pages/OrderHistory";
import OrderDetail from "./pages/OrderDetail";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={ <Products /> } />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          {/* Sản phẩm lấy từ API (feature-product) */}
          <Route path="/products" element={<ProductListApi />} />
          <Route path="/products/:id" element={<ProductDetailApi />} />
        </Route>

        <Route path="/test-categories" element={<TestCategories />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>}/>
        {/* Trang quản trị sản phẩm / danh mục */}
        <Route path="/admin/products" element={<AdminRoute> <AdminProducts /> </AdminRoute>} />
        <Route path="/admin/products/create" element={<AdminRoute> <AdminProductForm /> </AdminRoute>} />
        <Route path="/admin/products/edit/:id" element={<AdminRoute> <AdminProductForm /> </AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute> <AdminCategories /> </AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/orders/:id" element={<AdminRoute><AdminOrderDetail /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
