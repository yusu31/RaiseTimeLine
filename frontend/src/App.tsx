import { Navigate, Route, Routes } from 'react-router'
import { FollowListPage } from './pages/FollowListPage'
import { LoginPage } from './pages/LoginPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfilePage } from './pages/ProfilePage'
import { SignupPage } from './pages/SignupPage'
import { TimelinePage } from './pages/TimelinePage'
import { UserSearchPage } from './pages/UserSearchPage'
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
        <Route path="/search" element={<UserSearchPage />} />
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
