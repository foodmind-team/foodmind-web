import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { LoginPage, RegisterPage } from '../../routes/AuthRoutes'
import { NotFoundPage } from '../../routes/NotFoundPage'
import { ProtectedRoute, PublicOnlyRoute } from './protected-route'
import { RouteErrorBoundary } from './route-error-boundary'

const hydrateFallback = <main className="auth-check" aria-busy="true"><p>Opening FoodMind…</p></main>

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    hydrateFallbackElement: hydrateFallback,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    hydrateFallbackElement: hydrateFallback,
    errorElement: <RouteErrorBoundary />,
    children: [{
      element: <AppShell />,
      children: [
        { index: true, lazy: async () => ({ Component: (await import('../../routes/HomeRoutes')).HomePage }) },
        { path: 'recommendation-context', lazy: async () => ({ Component: (await import('../../routes/HomeRoutes')).RecommendationContextPage }) },
        { path: 'recommendations/:sessionId', lazy: async () => ({ Component: (await import('../../routes/HomeRoutes')).RecommendationDetailPage }) },
        { path: 'history', lazy: async () => ({ Component: (await import('../../routes/RecordRoutes')).HistoryPage }) },
        { path: 'records/new', lazy: async () => ({ Component: (await import('../../routes/RecordRoutes')).RecordComposerPage }) },
        { path: 'records/:recordType', lazy: async () => ({ Component: (await import('../../routes/RecordRoutes')).RecordCollectionPage }) },
        { path: 'records/:recordType/:id', lazy: async () => ({ Component: (await import('../../routes/RecordRoutes')).RecordDetailPage }) },
        { path: 'records/:recordType/:id/edit', lazy: async () => ({ Component: (await import('../../routes/RecordRoutes')).RecordEditorPage }) },
        { path: 'groups', lazy: async () => ({ Component: (await import('../../routes/GroupRoutes')).GroupsPage }) },
        { path: 'groups/join', lazy: async () => ({ Component: (await import('../../routes/GroupRoutes')).JoinGroupPage }) },
        { path: 'groups/:groupId', lazy: async () => ({ Component: (await import('../../routes/GroupRoutes')).GroupWorkspacePage }) },
        { path: 'explore', lazy: async () => ({ Component: (await import('../../routes/ExploreRoutes')).ExplorePage }) },
        { path: 'saved', lazy: async () => ({ Component: (await import('../../routes/ExploreRoutes')).SavedPage }) },
        { path: 'saved/recipes', lazy: async () => ({ Component: (await import('../../routes/RecipeRoutes')).RecipeLibraryPage }) },
        { path: 'saved/recipes/new', lazy: async () => ({ Component: (await import('../../routes/RecipeImportRoutes')).RecipeImportStartPage }) },
        { path: 'saved/recipes/manual', lazy: async () => ({ Component: (await import('../../routes/RecipeRoutes')).RecipeEditorPage }) },
        { path: 'saved/recipes/:recipeId/edit', lazy: async () => ({ Component: (await import('../../routes/RecipeRoutes')).RecipeEditorPage }) },
        { path: 'saved/cooking-plans', lazy: async () => ({ Component: (await import('../../routes/CookingRoutes')).SavedCookingPlansPage }) },
        { path: 'cooking', lazy: async () => ({ Component: (await import('../../routes/CookingSelectionPage')).CookingSelectPage }) },
        { path: 'cooking/import', lazy: async () => ({ Component: (await import('../../routes/RecipeImportRoutes')).RecipeImportStartPage }) },
        { path: 'cooking/import/:importId', lazy: async () => ({ Component: (await import('../../routes/RecipeImportRoutes')).RecipeImportSessionPage }) },
        { path: 'cooking/history', lazy: async () => ({ Component: (await import('../../routes/CookingRoutes')).CookingHistoryPage }) },
        { path: 'cooking/settings', lazy: async () => ({ Component: (await import('../../routes/CookingRoutes')).CookingSettingsPage }) },
        { path: 'cooking/recipes/new', lazy: async () => ({ Component: (await import('../../routes/RecipeImportRoutes')).RecipeImportStartPage }) },
        { path: 'cooking/recipes/:recipeId/edit', lazy: async () => ({ Component: (await import('../../routes/RecipeRoutes')).RecipeEditorPage }) },
        { path: 'inventory', lazy: async () => ({ Component: (await import('../../routes/InventoryRoutes')).InventoryPage }) },
        { path: 'shopping-lists', lazy: async () => ({ Component: (await import('../../routes/ShoppingRoutes')).ShoppingListIndexPage }) },
        { path: 'shopping-lists/:shoppingListId', lazy: async () => ({ Component: (await import('../../routes/ShoppingRoutes')).ShoppingListDetailPage }) },
        { path: 'cooking/:planId', lazy: async () => ({ Component: (await import('../../routes/CookingRoutes')).CookingDetailPage }) },
        { path: 'chat', lazy: async () => ({ Component: (await import('../../routes/ChatRoutes')).ChatIndexPage }) },
        { path: 'chat/:sessionId', lazy: async () => ({ Component: (await import('../../routes/ChatRoutes')).ChatConversationPage }) },
        { path: 'dashboard', lazy: async () => ({ Component: (await import('../../routes/AnalyticsRoutes')).DashboardPage }) },
        { path: 'weekly-recaps/:weekStart', lazy: async () => ({ Component: (await import('../../routes/AnalyticsRoutes')).WeeklyRecapPage }) },
        { path: 'me', lazy: async () => ({ Component: (await import('../../routes/ProfileRoutes')).ProfilePage }) },
        { path: 'me/preferences', lazy: async () => ({ Component: (await import('../../routes/ProfileRoutes')).PreferencesPage }) },
        { path: 'catalogue/:sourceType/:sourceId', lazy: async () => ({ Component: (await import('../../routes/CatalogueRoute')).CatalogueDetailPage }) },
        { path: '*', element: <NotFoundPage /> },
      ],
    }],
  },
])
