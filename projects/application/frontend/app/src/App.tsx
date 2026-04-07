import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppLayout, LayoutProvider } from "./features/layouts";
import { Login, ProtectedRoute } from "./features/keycloak-auth";
import SmokeTests from "./features/testing-tools/pages/SmokeTests";
import { UsersPage, UserPage } from "./features/user-management";

export default function App() {
  return (
    <Router>
      <LayoutProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SmokeTests />} />
            <Route path="smoke-tests" element={<SmokeTests />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/users/new" element={<UserPage />} />
            <Route path="admin/users/:id" element={<UserPage />} />
          </Route>
        </Routes>
      </LayoutProvider>
    </Router>
  );
}
