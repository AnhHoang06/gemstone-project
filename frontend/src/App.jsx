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
import "./assets/styles/thewayshop-gems.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account" element={<Account />} />

          {/* Sản phẩm lấy từ API (feature-product) */}
          <Route path="/products" element={<ProductListApi />} />
          <Route path="/products/:id" element={<ProductDetailApi />} />
        </Route>
        <Route path="/test-categories" element={<TestCategories />} />

        {/* Trang quản trị sản phẩm / danh mục */}
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/products/create" element={<AdminProductForm />} />
        <Route path="/admin/products/edit/:id" element={<AdminProductForm />} />
        <Route path="/admin/categories" element={<AdminCategories />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
