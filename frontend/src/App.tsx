import { Navigate, Route, Routes } from 'react-router'
import { FollowListPage } from './pages/FollowListPage'
import { LoginPage } from './pages/LoginPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { SignupPage } from './pages/SignupPage'
import { TimelinePage } from './pages/TimelinePage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GuestRoute } from './components/GuestRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        {/* 投稿検索（F-09）とユーザー検索（F-10）をタブで切り替える1つの画面 */}
        <Route path="/search" element={<SearchPage />} />
        {/* 編集画面のURLに username を入れないのは、編集対象がその username 自身のため。
            保存した瞬間にURLが古い名前を指す状態になるのを避ける */}
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/users/:username" element={<ProfilePage />} />
        {/* 一覧の中身が違うだけで画面構造は同じなので、mode を渡して1つのページで共用する */}
        <Route path="/users/:username/following" element={<FollowListPage mode="following" />} />
        <Route path="/users/:username/followers" element={<FollowListPage mode="followers" />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
