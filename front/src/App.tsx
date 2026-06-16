import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { adminApi, getAdminContext } from "./lib/admin-api";
import { authClient } from "./lib/auth-client";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ItemDetailPage } from "./pages/ItemDetailPage";
import { ItemAdminPage } from "./pages/ItemAdminPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import type { AdminSecurityContext, ManagedUser } from "./types/admin";
import { unwrapAuthResult } from "./utils/auth-client-result";
import { AuthModalProvider, useAuthModal } from "./context/AuthModalContext";
import { AuthModal } from "./components/AuthModal";

function AppRoutes() {
    const { data: session, isPending, refetch } = authClient.useSession();
    const [adminContext, setAdminContext] = useState<AdminSecurityContext | null>(null);
    const currentUser = session?.user as ManagedUser | undefined;
    const currentUserId = session?.user?.id;
    const isImpersonating = Boolean((session?.session as { impersonatedBy?: string } | undefined)?.impersonatedBy);
    const { setOpen } = useAuthModal();

    useEffect(() => {
        let ignore = false;
        if (!currentUserId) return;
        getAdminContext()
            .then((context) => {
                if (!ignore) setAdminContext(context);
            })
            .catch(() => {
                if (!ignore) setAdminContext(null);
            });
        return () => {
            ignore = true;
        };
    }, [currentUserId]);

    async function handleLogout() {
        await authClient.signOut();
        await refetch();
    }

    async function handleStopImpersonating() {
        await unwrapAuthResult(adminApi.stopImpersonating());
        await refetch();
    }

    if (isPending) {
        return <main className="center-screen">Загрузка...</main>;
    }

    return (
        <>
            <Routes>
                <Route
                    element={
                        <AppShell
                            currentUser={currentUser}
                            adminContext={adminContext}
                            isImpersonating={isImpersonating}
                            onLogout={handleLogout}
                            onStopImpersonating={handleStopImpersonating}
                            onOpenAuthModal={() => setOpen(true)}
                        />
                    }
                >
                    <Route index element={<HomePage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="catalog" element={<CatalogPage />} />
                    <Route path="catalog/:type/:id" element={<ItemDetailPage />} />
                    <Route path="profile" element={<ProfilePage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin" element={<AdminPage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/catalog" element={<ItemAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/users/:userId" element={<AdminPage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="reset-password" element={<ResetPasswordPage />} />
            </Routes>
            <AuthModal onSuccess={refetch} />
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthModalProvider>
                <AppRoutes />
            </AuthModalProvider>
        </BrowserRouter>
    );
}

export default App;
