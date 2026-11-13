import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider } from './auth.jsx';
import Layout from './Layout.jsx';
import Home from './Home.jsx';
import Mentors from './Mentors.jsx';
import MentorProfile from './MentorProfile.jsx';
import Sessions, { SessionDetail } from './Sessions.jsx';
import Journal from './Journal.jsx';
import Post from './Post.jsx';
import Videos from './Videos.jsx';
import Community, { AskCommunity, QuestionPage } from './Community.jsx';
import Book from './Book.jsx';
import Unsubscribe from './Unsubscribe.jsx';
import Write from './Write.jsx';
import { Login, Signup, ForgotPassword, ResetPassword } from './AccountPages.jsx';
import NotFound from './NotFound.jsx';
// The dashboard and editor load only when opened, so public pages stay light.
const Dashboard = lazy(() => import('./Dashboard.jsx'));
const Editor = lazy(() => import('./Editor.jsx'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="mentors/:id" element={<MentorProfile />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="sessions/:key" element={<SessionDetail />} />
            <Route path="live-sessions" element={<Navigate to="/sessions" replace />} />
            <Route path="book/:id" element={<Book />} />
            <Route path="community" element={<Community />} />
            <Route path="community/ask" element={<AskCommunity />} />
            <Route path="community/:id" element={<QuestionPage />} />
            <Route path="unsubscribe" element={<Unsubscribe />} />
            <Route path="blogs" element={<Navigate to="/journal" replace />} />
            <Route path="become-mentor" element={<Navigate to="/signup?role=mentor" replace />} />
            <Route path="journal" element={<Journal />} />
            <Route path="journal/:slug" element={<Post />} />
            <Route path="videos" element={<Videos />} />
            <Route path="ask" element={<Navigate to="/community" replace />} />
            <Route path="write" element={<Write />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="dashboard" element={<Suspense fallback={<p className="wrap spinner">Loading…</p>}><Dashboard /></Suspense>} />
            <Route path="editor/:id" element={<Suspense fallback={<p className="wrap spinner">Loading…</p>}><Editor /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
