import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { adminApi, getAdminContext } from "./lib/admin-api";
import { authClient } from "./lib/auth-client";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import type { AdminSecurityContext, ManagedUser } from "./types/admin";
import { unwrapAuthResult } from "./utils/auth-client-result";
import { AuthModalProvider, useAuthModal } from "./context/AuthModalContext";
import { AuthModal } from "./components/AuthModal";
import { CookieBanner } from "./components/CookieBanner";
import { postMapLinkingEnabled } from "./lib/features";

const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage").then((module) => ({ default: module.AdminOverviewPage })));
const PrivacyPolicyPage = lazy(() => import("./pages/legal/PrivacyPolicyPage").then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsOfUsePage = lazy(() => import("./pages/legal/TermsOfUsePage").then((module) => ({ default: module.TermsOfUsePage })));
const RulesPage = lazy(() => import("./pages/legal/RulesPage").then((module) => ({ default: module.RulesPage })));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage").then((module) => ({ default: module.AdminAuditPage })));
const AuthorProfilePage = lazy(() => import("./pages/AuthorProfilePage").then((module) => ({ default: module.AuthorProfilePage })));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage").then((module) => ({ default: module.CalculatorPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const CatalogHomePage = lazy(() => import("./pages/CatalogHomePage").then((module) => ({ default: module.CatalogHomePage })));
const BaitCatalogPage = lazy(() => import("./pages/BaitCatalogPage").then((module) => ({ default: module.BaitCatalogPage })));
const FishCatalogPage = lazy(() => import("./pages/FishCatalogPage").then((module) => ({ default: module.FishCatalogPage })));
const FeedPage = lazy(() => import("./pages/FeedPage").then((module) => ({ default: module.FeedPage })));
const FishAdminPage = lazy(() => import("./pages/FishAdminPage").then((module) => ({ default: module.FishAdminPage })));
const ItemAdminPage = lazy(() => import("./pages/ItemAdminPage").then((module) => ({ default: module.ItemAdminPage })));
const ItemDetailPage = lazy(() => import("./pages/ItemDetailPage").then((module) => ({ default: module.ItemDetailPage })));
const ModerationQueuePage = lazy(() => import("./pages/ModerationQueuePage").then((module) => ({ default: module.ModerationQueuePage })));
const MapModerationPage = lazy(() => import("./pages/MapModerationPage").then((module) => ({ default: module.MapModerationPage })));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage").then((module) => ({ default: module.PostDetailPage })));
const PostEditorPage = lazy(() => import("./pages/PostEditorPage").then((module) => ({ default: module.PostEditorPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage").then((module) => ({ default: module.ProfileSettingsPage })));
const ReferenceAdminPage = lazy(() => import("./pages/ReferenceAdminPage").then((module) => ({ default: module.ReferenceAdminPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const WaterbodyAdminPage = lazy(() => import("./pages/WaterbodyAdminPage").then((module) => ({ default: module.WaterbodyAdminPage })));
const BaitAdminPage = lazy(() => import("./pages/BaitAdminPage").then((module) => ({ default: module.BaitAdminPage })));
const WaterbodyListPage = lazy(() => import("./pages/WaterbodyListPage").then((module) => ({ default: module.WaterbodyListPage })));
const WaterbodyMapPage = lazy(() => import("./pages/WaterbodyMapPage").then((module) => ({ default: module.WaterbodyMapPage })));

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
            <Suspense fallback={<main className="center-screen">Загрузка...</main>}>
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
                    <Route path="catalog" element={<CatalogHomePage />} />
                    <Route path="catalog/reels" element={<CatalogPage initialType="reels" />} />
                    <Route path="catalog/rods" element={<CatalogPage initialType="rods" />} />
                    <Route path="catalog/baits" element={<BaitCatalogPage />} />
                    <Route path="catalog/fish" element={<FishCatalogPage />} />
                    <Route path="catalog/:type/:id" element={<ItemDetailPage />} />
                    <Route path="calculator" element={<CalculatorPage />} />
                    <Route path="waterbodies" element={<WaterbodyListPage />} />
                    <Route path="waterbodies/:id" element={<WaterbodyMapPage currentUser={currentUser} adminContext={adminContext} />} />
                    <Route path="feed" element={<FeedPage currentUser={currentUser} adminContext={adminContext} />} />
                    {/* /posts retired — link goes to profile where MyPostsPage is now embedded. */}
                    <Route path="posts" element={<Navigate to="/profile" replace />} />
                    <Route path="posts/new" element={<PostEditorPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="posts/author/:authorId" element={<AuthorProfilePage />} />
                    <Route path="posts/:id" element={<PostDetailPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="posts/:id/edit" element={<PostEditorPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="posts/:id/moderate" element={<PostEditorPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} mode="moderate" />} />
                    <Route path="moderation" element={<ModerationQueuePage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    {postMapLinkingEnabled && <Route path="moderation/map" element={<MapModerationPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />}
                    <Route path="moderation/reports" element={<ReportsPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="profile" element={<ProfilePage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="profile/settings" element={<ProfileSettingsPage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin" element={<AdminOverviewPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/users" element={<AdminPage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/audit" element={<AdminAuditPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/reference" element={<ReferenceAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/catalog" element={<ItemAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/fish" element={<FishAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/waterbodies" element={<WaterbodyAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/baits" element={<BaitAdminPage currentUser={currentUser} adminContext={adminContext} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="admin/users/:userId" element={<AdminPage currentUser={currentUser} adminContext={adminContext} onSessionRefresh={refetch} onOpenAuthModal={() => setOpen(true)} />} />
                    <Route path="legal/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="legal/terms" element={<TermsOfUsePage />} />
                    <Route path="legal/rules" element={<RulesPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                    </Route>
                    <Route path="reset-password" element={<ResetPasswordPage />} />
                </Routes>
            </Suspense>
            <AuthModal onSuccess={refetch} />
            <CookieBanner />
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
